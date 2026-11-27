/**
 * Two tokens: the ingest token lets the Pi write, the display token lets a display read. A display
 * can't write, and a leaked Pi token can't read. Reading needs a token at all because the current
 * state says what's playing in the house, and that someone is home.
 *
 * Tokens travel in `Authorization: Bearer`. A browser can't set headers on a WebSocket, so the web
 * page sends its token as the second WebSocket subprotocol (`now-spinning.v1, <token>`), which is
 * why tokens are hex: a subprotocol can't contain the `/` or `=` that base64 produces. Never in a
 * query string, which ends up in logs.
 *
 * Spec: docs/specs/implemented/global-now-spinning/global-now-spinning-spec.md §Auth and secrets
 */

export const SUBPROTOCOL = "now-spinning.v1";

/** Constant-time comparison: how long it takes says nothing about how much of the token matched. */
export function sameToken(given: string | null | undefined, expected: string): boolean {
  const enc = new TextEncoder();
  const a = enc.encode(given ?? "");
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0 && b.length > 0;
}

/** The token a request carries: the Bearer header, or for a WebSocket, the second subprotocol. */
export function tokenOf(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  const protocols = (req.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").map((p) => p.trim());
  if (protocols[0] === SUBPROTOCOL && protocols[1]) return protocols[1];
  return null;
}

/** Did the client ask for our subprotocol? Then the answer must name it (and only it). */
export function wantsSubprotocol(req: Request): boolean {
  return (req.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").map((p) => p.trim()).includes(SUBPROTOCOL);
}
