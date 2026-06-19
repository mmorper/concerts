// "Ask the Archive" in-app chat backend (Epic #138, issue #139). Sibling worker to
// morperhaus-mcp; reuses its pure tool fns + data layer. SSE streaming, tool-grounded agent
// loop, atomic DO cost cap, phone-flippable kill switch.
//
// Routes (under concerts.morperhaus.org/api/ask*):
//   POST /api/ask/chat    — run a turn, stream the answer as SSE
//   GET  /api/ask/status  — current mode + today's spend (JSON)
//
// SSE events from /api/ask/chat (consumed by #140 frontend):
//   token    { text }        — prose delta (stream into the exhibit's stable frame)
//   tool     { name }        — a tool is being consulted ("consulting…")
//   exhibit  <Exhibit>       — the composed card to render (kind + slugs; see exhibits.ts).
//                              Emitted once, after prose, before `done`. Thin: frontend hydrates
//                              photo/genre/map/chips from the SPA's local data via the slugs/ids.
//   refusal  { message }     — kill-switch / cap / backstop, graceful (never a 500)
//   done     { fraction }    — turn complete (spend fraction of the daily cap)
//   error    { message }     — unexpected failure
//
// SHIPS BEHIND A FLAG, NO END-USER UI. The Turnstile session gate + per-session/IP rate
// limits + /admin control page are the next layer (#139 remaining scope) and must land
// before this route is exposed publicly.

import type { Env } from "./types.js";
import { getMode } from "./control.js";
import { reserveTurn, commitTurn, releaseTurn, type ReserveTicket } from "./cost.js";
import { runAgentTurn } from "./agent-loop.js";
import { dispatchTool, pickDeterministicTool, readerProse } from "./tools-bridge.js";
import { pickPrimaryExhibit } from "./exhibits.js";
import { issueSession, verifySession } from "./session.js";
import { allow } from "./ratelimit.js";
import { maybeTripwire } from "./notify.js";
import { logTurn, type TurnOutcome } from "./telemetry.js";
import type { AnthropicUsage } from "./cost.js";
import { handleAdmin } from "./admin.js";

export { SpendCounter } from "./spend-counter.js";

const MAX_INPUT_CHARS = 2000; // single-message length cap
const MAX_TURNS = 24; // transcript length cap (session-ephemeral; client sends the history)

// CORS is scoped to the first-party site (plus localhost for the dev SPA), not `*` — there's no
// reason for a third-party page to script the public LLM endpoint through a visitor's browser.
// A browser sets `Origin` to the real page origin, so echoing only allowlisted origins keeps
// other sites out while same-origin prod requests (no Origin) still work.
const SITE_ORIGIN = "https://concerts.morperhaus.org";
// This project's Cloudflare Pages domain — preview deployments are <hash|branch>.<this>, so
// allowing the suffix lets PR previews exercise the real backend. Scoped to OUR project (a
// different account's pages.dev project is a different subdomain), so it stays first-party.
const PAGES_DOMAIN = "concerts-9xp.pages.dev";

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === SITE_ORIGIN) return true;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    return u.hostname === PAGES_DOMAIN || u.hostname.endsWith(`.${PAGES_DOMAIN}`);
  } catch {
    return false;
  }
}

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : SITE_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-ask-session",
    Vary: "Origin",
  };
}

interface Turn {
  role: "user" | "assistant";
  text: string;
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Map the client's session-ephemeral transcript to Anthropic messages. The client persists
// only user/assistant prose (tool_use/tool_result stay inside a turn), so the history is
// small and cache-friendly.
function toMessages(turns: Turn[]): unknown[] {
  return turns
    .filter((t) => (t.role === "user" || t.role === "assistant") && t.text.trim())
    .map((t) => ({ role: t.role, content: t.text }));
}

function validate(turns: unknown): { ok: true; turns: Turn[] } | { ok: false; reason: string } {
  if (!Array.isArray(turns) || turns.length === 0) return { ok: false, reason: "No message." };
  if (turns.length > MAX_TURNS) return { ok: false, reason: "This conversation has gone long — start a fresh one." };
  const last = turns[turns.length - 1] as Turn;
  if (!last || last.role !== "user" || typeof last.text !== "string" || !last.text.trim())
    return { ok: false, reason: "No question to answer." };
  if (last.text.length > MAX_INPUT_CHARS) return { ok: false, reason: "That's a long one — try a shorter question." };
  return { ok: true, turns: turns as Turn[] };
}

async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let body: { turns?: unknown };
  try {
    body = (await request.json()) as { turns?: unknown };
  } catch {
    return Response.json({ error: "Bad JSON." }, { status: 400, headers: cors(request) });
  }
  const v = validate(body.turns);
  if (!v.ok) return Response.json({ error: v.reason }, { status: 400, headers: cors(request) });

  // Gate: a valid, unexpired Turnstile-issued session bound to a session id, then per-session
  // + per-IP rate limits (the PRIMARY abuse defense). All before a single token is spent.
  const session = await verifySession(env, request.headers.get("x-ask-session"));
  if (!session.valid) {
    return Response.json({ error: "session_required" }, { status: 401, headers: cors(request) });
  }
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const okSession = await allow(env.SESSION_LIMITER, `sess:${session.sid}`, "session");
  const okIp = await allow(env.IP_LIMITER, `ip:${ip}`, "ip");
  if (!okSession || !okIp) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: cors(request) });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (event: string, data: unknown) => writer.write(enc.encode(sseEvent(event, data)));

  const pump = async () => {
    let ticket: ReserveTicket | undefined;
    // Per-turn telemetry, accumulated through the branches and written once in `finally` (one row
    // per turn, every exit path). Defaults assume the worst; each success path refines them.
    const lastUserText = (v.turns[v.turns.length - 1] as Turn).text;
    const day = new Date().toISOString().slice(0, 10);
    let outcome: TurnOutcome = "error";
    let usage: AnthropicUsage = {};
    let exhibitKind = "none";
    let fraction = 0;
    try {
      if (!env.ANTHROPIC_API_KEY) {
        outcome = "paused";
        await send("refusal", { message: "Ask is resting just now — try one of the scenes." });
        return;
      }

      const mode = await getMode(env);
      if (mode === "paused") {
        outcome = "paused";
        await send("refusal", { message: "Ask is resting just now. The archive's still here — wander the scenes." });
        return;
      }
      if (mode === "deterministic-only") {
        // Middle kill-switch tier: keep answering from the cheap tools with NO LLM call (and no
        // spend) during an LLM-specific incident. Route to one tool, show its grounded answer +
        // the rich exhibit card. The agent loop stays suppressed.
        const lastText = (v.turns[v.turns.length - 1] as Turn).text;
        try {
          const choice = await pickDeterministicTool(env, lastText);
          const result = await dispatchTool(env, choice.name, choice.input);
          const prose = readerProse(result.text);
          const exhibit = result.exhibit ?? { kind: "plain" as const };
          exhibitKind = exhibit.kind;
          // No prose AND no real card → a graceful refusal, never a blank exhibit (mirror the LLM
          // path's empty-answer guard below).
          if (!prose && exhibit.kind === "plain") {
            outcome = "refused";
            await send("refusal", { message: "I got a little tangled chasing that one down — try asking it a different way." });
            await send("done", { fraction: 0, deterministic: true });
            return;
          }
          outcome = "deterministic";
          if (prose) await send("token", { text: prose });
          await send("exhibit", exhibit);
          await send("done", { fraction: 0, deterministic: true });
        } catch (err) {
          console.error("deterministic turn failed:", err);
          await send("refusal", { message: "Ask is in quiet mode right now — explore the scenes, and try again soon." });
        }
        return;
      }

      const reservation = await reserveTurn(env, ip);
      if (!reservation.ok) {
        outcome = "cap";
        fraction = reservation.status.fraction;
        // Per-IP slice exhausted = this visitor specifically; global cap = the whole archive.
        const message =
          reservation.scope === "ip"
            ? "You've asked a good many today — give the archive a rest and come back tomorrow."
            : "Today's questions have worn me out — the archive's still here to wander. Try again tomorrow.";
        await send("refusal", { message });
        await send("done", { capHit: true, fraction: reservation.status.fraction });
        return;
      }
      ticket = reservation.ticket;

      const result = await runAgentTurn(env, toMessages(v.turns), {
        onText: (text) => void send("token", { text }),
        onTool: (name) => void send("tool", { name }),
      });

      // Best-effort: the answer already streamed, so a transient cost-counter failure must NOT
      // fail the turn (that would send an `error` event and drop the exhibit on a good answer).
      // Fall back to the reservation's status; a truly-uncommitted reservation self-heals via the
      // DO's TTL prune.
      let status = reservation.status;
      try {
        status = await commitTurn(env, ticket!, result.usage);
      } catch (err) {
        console.error("cost commit failed (answer already produced):", err);
      }
      ticket = undefined;
      usage = result.usage;
      fraction = status.fraction;

      // The composed exhibit: pick the primary descriptor from the turn's tool trace. The
      // frontend scaffolds this card kind and hydrates its atoms (photo/genre/map/chips) from
      // the SPA's local data using the slugs/ids here (see exhibits.ts thin-envelope contract).
      const exhibit = pickPrimaryExhibit(result.exhibits);
      exhibitKind = exhibit.kind;

      // Empty prose = the tool loop hit its backstop. If a real entity card was still resolved,
      // render it (a wrong-shaped answer with a good card beats a flat refusal); only refuse when
      // there's nothing to show at all.
      if (!result.text.trim() && exhibit.kind === "plain") {
        outcome = "refused";
        await send("refusal", { message: "I got a little tangled chasing that one down — try asking it a different way." });
        await send("done", { fraction: status.fraction });
        return;
      }

      outcome = "answered";
      await send("exhibit", exhibit);

      // Crossing a budget milestone (50/75/100%) → push a deep link to /ask/admin (once/day each).
      // Backgrounded.
      ctx.waitUntil(maybeTripwire(env, status, ctx));
      await send("done", { fraction: status.fraction });
    } catch (err) {
      console.error("chat turn failed:", err);
      if (ticket) ctx.waitUntil(releaseTurn(env, ticket)); // charge nothing for a failed turn
      await send("error", { message: "Something went sideways — try that again." });
    } finally {
      // One ledger row per turn, whatever happened (Analytics Engine; no-op if unbound).
      logTurn(env, { day, query: lastUserText, outcome, exhibitKind, usage, fraction });
      await writer.close();
    }
  };

  ctx.waitUntil(pump());

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      ...cors(request),
    },
  });
}

// Public status: mode only (so the frontend can collapse the dock when Ask is resting).
// Spend $ is NOT exposed here — that lives behind Access on /ask/admin.
async function handleStatus(request: Request, env: Env): Promise<Response> {
  const mode = await getMode(env);
  return Response.json({ mode }, { headers: cors(request) });
}

// Exchange a Turnstile token for a signed session token (required by /chat).
async function handleSession(request: Request, env: Env): Promise<Response> {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return Response.json({ error: "Bad JSON." }, { status: 400, headers: cors(request) });
  }
  const ip = request.headers.get("CF-Connecting-IP");
  const result = await issueSession(env, body.token ?? "", ip);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 403, headers: cors(request) });
  return Response.json({ session: result.token }, { headers: cors(request) });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...cors(request), "Access-Control-Allow-Headers": "Content-Type, Authorization, x-ask-session" } });
    }

    // Admin (behind Cloudflare Access; fail-closed inside handleAdmin).
    if (url.pathname === "/api/ask/admin" || url.pathname === "/api/ask/admin/mode") {
      return handleAdmin(request, env, url);
    }

    if (url.pathname === "/api/ask/session" && request.method === "POST") {
      return handleSession(request, env);
    }
    if (url.pathname === "/api/ask/chat" && request.method === "POST") {
      return handleChat(request, env, ctx);
    }
    if (url.pathname === "/api/ask/status" && request.method === "GET") {
      return handleStatus(request, env);
    }

    return new Response("Not found", { status: 404, headers: cors(request) });
  },
};
