// Dev-only: mint a session token the chat endpoint will accept, WITHOUT going through
// Turnstile. Signs {sid, exp} with the same HMAC scheme as src/session.ts so a local
// `wrangler dev` accepts it. Use only for local testing.
//
// Usage:
//   node scripts/mint-dev-session.mjs "<SESSION_HMAC_KEY from .dev.vars>"
//
// Prints a token; send it as the `x-ask-session` header to /api/ask/chat.

import { createHmac } from "node:crypto";

const key = process.argv[2];
if (!key) {
  console.error('Pass the SESSION_HMAC_KEY: node scripts/mint-dev-session.mjs "<key>"');
  process.exit(1);
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const payloadObj = { sid: "dev-" + Date.now(), exp: Date.now() + 30 * 60 * 1000 };
const payload = b64url(JSON.stringify(payloadObj));
const sig = b64url(createHmac("sha256", key).update(payload).digest());

console.log(`${payload}.${sig}`);
