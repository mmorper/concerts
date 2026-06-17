// Cloudflare Access (Zero Trust) JWT validation for /ask/admin.
//
// FAIL-CLOSED: the admin controls flip the kill switch, so they must NEVER be reachable
// without a valid Access identity. The edge Access policy is the first gate, but the worker
// independently verifies the `Cf-Access-Jwt-Assertion` header (RS256 signature + aud + exp)
// so a removed/misconfigured Access app can't silently expose the page. Any missing config or
// validation failure → denied.

import type { Env } from "./types.js";

interface Jwk {
  kid: string;
  n: string;
  e: string;
  kty: string;
  alg?: string;
}

// Module-cached Access signing keys (rotate rarely; refetch on cache miss / unknown kid).
let certCache: { keys: Record<string, CryptoKey>; at: number } | null = null;
const CERT_TTL_MS = 60 * 60 * 1000;

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importJwk(jwk: Jwk): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

async function getCerts(teamDomain: string, force: boolean): Promise<Record<string, CryptoKey>> {
  if (!force && certCache && Date.now() - certCache.at < CERT_TTL_MS) return certCache.keys;
  const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Access certs fetch ${res.status}`);
  const data = (await res.json()) as { keys: Jwk[] };
  const keys: Record<string, CryptoKey> = {};
  for (const jwk of data.keys) keys[jwk.kid] = await importJwk(jwk);
  certCache = { keys, at: Date.now() };
  return keys;
}

export interface AccessIdentity {
  ok: boolean;
  email?: string;
}

// Validate the Access JWT. Returns ok:true only on a fully verified, unexpired token whose
// aud matches the configured application. Everything else → ok:false (fail closed).
export async function verifyAccess(env: Env, request: Request): Promise<AccessIdentity> {
  const team = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!team || !aud) {
    console.error("Access not configured (ACCESS_TEAM_DOMAIN / ACCESS_AUD) — denying admin.");
    return { ok: false };
  }
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return { ok: false };

  const parts = jwt.split(".");
  if (parts.length !== 3) return { ok: false };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { kid?: string; alg?: string };
  let payload: { aud?: string | string[]; exp?: number; email?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return { ok: false };
  }
  if (header.alg !== "RS256" || !header.kid) return { ok: false };

  // Verify signature, refetching certs once if the kid is unknown (key rotation).
  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = b64urlToBytes(sigB64);
  let verified = false;
  for (const force of [false, true]) {
    let keys: Record<string, CryptoKey>;
    try {
      keys = await getCerts(team, force);
    } catch (e) {
      console.error("Access certs unavailable — denying admin.", e);
      return { ok: false };
    }
    const key = keys[header.kid];
    if (!key) continue; // unknown kid — try a forced refetch
    verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, signed);
    break;
  }
  if (!verified) return { ok: false };

  // Claims: audience must include our app, token must be unexpired.
  const auds = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!auds.includes(aud)) return { ok: false };
  if (!payload.exp || Date.now() / 1000 > payload.exp) return { ok: false };

  return { ok: true, email: payload.email };
}
