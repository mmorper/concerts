// /ask/admin — the phone-first control page (spec §"Phone-first control"). Behind Cloudflare
// Access (verified fail-closed in access.ts). Shows current mode + today's spend and offers
// On / Deterministic-only / Pause. Bookmark to the home screen = a 3-tap break-glass app.

import type { Env, AskMode, SpendStatus } from "./types.js";
import { verifyAccess } from "./access.js";
import { getMode, setMode } from "./control.js";
import { spendStatus } from "./cost.js";

const MODES: AskMode[] = ["on", "deterministic-only", "paused"];
const MODE_LABEL: Record<AskMode, string> = {
  on: "On",
  "deterministic-only": "Deterministic-only",
  paused: "Pause",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function renderPage(mode: AskMode, spend: SpendStatus, email?: string): string {
  const usd = (spend.committedMicroUsd / 1_000_000).toFixed(2);
  const cap = (spend.capMicroUsd / 1_000_000).toFixed(2);
  const pct = Math.round(spend.fraction * 100);
  const bar = Math.min(100, pct);
  const buttons = MODES.map((m) => {
    const active = m === mode;
    return `<button class="mode ${m} ${active ? "active" : ""}" ${active ? "disabled" : ""}
      formaction="/api/ask/admin/mode?to=${m}">${MODE_LABEL[m]}${active ? " ✓" : ""}</button>`;
  }).join("");

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ask · admin</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 16px/1.5 -apple-system, system-ui, sans-serif; background: #0c0c0f; color: #e7e7ea; padding: 24px; }
  main { max-width: 480px; margin: 0 auto; }
  h1 { font-size: 1.1rem; letter-spacing: .04em; text-transform: uppercase; color: #a7a7b0; }
  .spend { background: #16161c; border: 1px solid #26262f; border-radius: 14px; padding: 18px; margin: 16px 0 24px; }
  .spend .big { font-size: 1.6rem; font-weight: 600; }
  .track { height: 8px; background: #26262f; border-radius: 99px; margin-top: 12px; overflow: hidden; }
  .fill { height: 100%; background: ${pct >= 80 ? "#e0533d" : "#5a7fd6"}; width: ${bar}%; }
  .muted { color: #80808c; font-size: .85rem; }
  .modes { display: grid; gap: 10px; }
  button.mode { font: inherit; padding: 16px; min-height: 56px; border-radius: 12px; border: 1px solid #33333f; background: #1b1b22; color: #e7e7ea; cursor: pointer; }
  button.mode.active { outline: 2px solid #5a7fd6; }
  button.mode.paused.active { outline-color: #e0533d; }
  button.mode:disabled { opacity: .7; cursor: default; }
  footer { margin-top: 28px; }
</style></head><body><main>
  <h1>Ask the Archive · control</h1>
  <div class="spend">
    <div class="muted">Today (${escapeHtml(spend.day)})</div>
    <div class="big">$${usd} <span class="muted">/ $${cap} · ${pct}%</span></div>
    <div class="track"><div class="fill"></div></div>
    <div class="muted" style="margin-top:8px">Reserved in flight: $${(spend.reservedMicroUsd / 1_000_000).toFixed(2)}</div>
  </div>
  <form method="post" class="modes">${buttons}</form>
  <footer class="muted">
    Current mode: <strong>${escapeHtml(mode)}</strong>.
    ${email ? `Signed in as ${escapeHtml(email)}.` : ""}
    <br>Pause stops the LLM loop (graceful “resting” reply). Deterministic-only keeps tool answers, no model.
  </footer>
</main></body></html>`;
}

function deny(): Response {
  // No detail — fail closed and don't hint at the surface.
  return new Response("Forbidden", { status: 403 });
}

export async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const identity = await verifyAccess(env, request);
  if (!identity.ok) return deny();

  // Flip the mode.
  if (url.pathname === "/api/ask/admin/mode" && request.method === "POST") {
    const to = url.searchParams.get("to") as AskMode | null;
    if (to && MODES.includes(to)) {
      await setMode(env, to);
    }
    // Re-render the page (PRG: redirect back to the dashboard).
    return new Response(null, { status: 303, headers: { Location: "/api/ask/admin" } });
  }

  // Render the dashboard.
  if (url.pathname === "/api/ask/admin" && request.method === "GET") {
    const [mode, spend] = await Promise.all([getMode(env), spendStatus(env)]);
    return new Response(renderPage(mode, spend, identity.email), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return new Response("Not found", { status: 404 });
}
