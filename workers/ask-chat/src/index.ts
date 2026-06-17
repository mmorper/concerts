// "Ask the Archive" in-app chat backend (Epic #138, issue #139). Sibling worker to
// morperhaus-mcp; reuses its pure tool fns + data layer. SSE streaming, tool-grounded agent
// loop, atomic DO cost cap, phone-flippable kill switch.
//
// Routes (under concerts.morperhaus.org/api/ask*):
//   POST /api/ask/chat    — run a turn, stream the answer as SSE
//   GET  /api/ask/status  — current mode + today's spend (JSON)
//
// SHIPS BEHIND A FLAG, NO END-USER UI. The Turnstile session gate + per-session/IP rate
// limits + /admin control page are the next layer (#139 remaining scope) and must land
// before this route is exposed publicly.

import type { Env } from "./types.js";
import { getMode } from "./control.js";
import { reserveTurn, commitTurn, releaseTurn, spendStatus } from "./cost.js";
import { runAgentTurn } from "./agent-loop.js";

export { SpendCounter } from "./spend-counter.js";

const MAX_INPUT_CHARS = 2000; // single-message length cap
const MAX_TURNS = 24; // transcript length cap (session-ephemeral; client sends the history)
const TRIPWIRE_FRACTION = 0.8; // ≥80% of cap → alert (push notification is #6)

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
    return Response.json({ error: "Bad JSON." }, { status: 400, headers: CORS });
  }
  const v = validate(body.turns);
  if (!v.ok) return Response.json({ error: v.reason }, { status: 400, headers: CORS });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (event: string, data: unknown) => writer.write(enc.encode(sseEvent(event, data)));

  const pump = async () => {
    let reservationId: string | undefined;
    try {
      if (!env.ANTHROPIC_API_KEY) {
        await send("refusal", { message: "Ask is resting just now — try one of the scenes." });
        return;
      }

      const mode = await getMode(env);
      if (mode === "paused") {
        await send("refusal", { message: "Ask is resting just now. The archive's still here — wander the scenes." });
        return;
      }
      if (mode === "deterministic-only") {
        // TODO(#139): answer straight from the tools with no LLM. v1 degrades gracefully.
        await send("refusal", { message: "Ask is in quiet mode right now — explore the scenes, and try again soon." });
        return;
      }

      const reservation = await reserveTurn(env);
      if (!reservation.ok) {
        await send("refusal", { message: "Today's questions have worn me out — the archive's still here to wander. Try again tomorrow." });
        await send("done", { capHit: true, fraction: reservation.status.fraction });
        return;
      }
      reservationId = reservation.id;

      const result = await runAgentTurn(env, toMessages(v.turns), {
        onText: (text) => void send("token", { text }),
        onTool: (name) => void send("tool", { name }),
      });

      const status = await commitTurn(env, reservationId!, result.usage);
      reservationId = undefined;

      if (status.fraction >= TRIPWIRE_FRACTION) {
        // #6: this is where the ≥80% push notification fires. For now it's a logged tripwire.
        console.warn(`ask spend tripwire: ${(status.fraction * 100).toFixed(0)}% of daily cap`);
      }
      await send("done", { fraction: status.fraction });
    } catch (err) {
      console.error("chat turn failed:", err);
      if (reservationId) ctx.waitUntil(releaseTurn(env, reservationId)); // charge nothing for a failed turn
      await send("error", { message: "Something went sideways — try that again." });
    } finally {
      await writer.close();
    }
  };

  ctx.waitUntil(pump());

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      ...CORS,
    },
  });
}

async function handleStatus(env: Env): Promise<Response> {
  const [mode, spend] = await Promise.all([getMode(env), spendStatus(env)]);
  return Response.json({ mode, spend }, { headers: CORS });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/api/ask/chat" && request.method === "POST") {
      return handleChat(request, env, ctx);
    }
    if (url.pathname === "/api/ask/status" && request.method === "GET") {
      return handleStatus(env);
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
