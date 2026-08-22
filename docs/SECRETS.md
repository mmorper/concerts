# Secrets & Credential Management

How secrets are stored across this project and how to rotate them safely. This is the
**operational** companion to [`api-setup.md`](./api-setup.md) — that doc explains how to
*obtain* each key; this one explains *where each lives* and *how to rotate it*.

> **Why this doc exists:** secrets are sprawled across several stores. On 2026-06-17 the
> Anthropic key was rotated but only one of its six homes was updated; because the old key
> was already revoked, a production worker and both CI workflows silently ran on a dead key
> until the gap was found. The matrix below is the inventory that prevents a repeat.

---

## The golden rules

1. **Update every home _before_ revoking the old credential.** Revoking first = guaranteed
   outage. Order is always: rotate-new → propagate to all homes → verify → *then* revoke old.
2. **Never print a secret value.** Compare across files by fingerprint, never by `cat`:
   ```bash
   grep -i '^ANTHROPIC_API_KEY' <file> | sed 's/^[^=]*=//' | tr -d '"' | xargs printf '%s' | shasum -a 256 | cut -c1-12
   ```
   Same 12-char hash = same value. (Also compare `last6` of the value as a sanity check.)
3. **Pipe, don't paste.** When setting a remote secret, stream it from the local file so the
   value never appears in your terminal, shell history, or this transcript (see commands below).
4. **Local secret files are gitignored** (`.env`, `**/.dev.vars`). Never commit them; never
   add a real value to a `*.example` file.
5. **`VITE_`-prefixed vars are NOT secret** — Vite compiles them into the public client bundle.
   Anything truly secret must never carry the `VITE_` prefix.

---

## Secret → store matrix

Every secret and every place it must be set. "Local" = gitignored file for dev; "Prod" =
the live runtime store; "CI" = GitHub Actions repo secret.

### Anthropic API key — **6 homes** (the one that bit us)

| Home | Store | Used by |
|------|-------|---------|
| root `.env` | local | `scripts/` — liner-notes pipeline, narration generation |
| `workers/ask-chat/.dev.vars` | local | ask-chat dev server |
| ask-chat | **prod** `wrangler secret` | ask-chat agent loop (`/api/ask/chat`) |
| `workers/mcp-server/.dev.vars` | local | mcp-server dev server |
| mcp-server | **prod** `wrangler secret` | MCP `query` tool (`/mcp`) |
| GitHub Actions | **CI** repo secret | `liner-notes.yml`, `data-refresh.yml` |

> meta-injector does **not** use the Anthropic key.

### Worker-only secrets (ask-chat) — prod `wrangler secret` + local `.dev.vars`

| Secret | Purpose | Notes |
|--------|---------|-------|
| `SESSION_HMAC_KEY` | signs the short-lived Turnstile→session token | local dev mints sessions with `scripts/mint-dev-session.mjs` using the **same** value |
| `TURNSTILE_SECRET` | Turnstile server-side verification (session issuance) | public **site** key is separate (frontend, not secret) |
| `NOTIFY_WEBHOOK_URL` | optional ≥80%-cap tripwire push | optional — tripwire logs only if unset |

`ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` in `ask-chat/wrangler.toml` `[vars]` are **identifiers,
not secrets** — they identify the Cloudflare Access app; knowing them grants nothing.

### Worker-only secrets (dashboard-refresh) — prod `wrangler secret` (single home each)

The operator dashboard's daily snapshot builder. Each has **one home** (the prod worker) — they
were set straight to prod, so there is normally no `.dev.vars` for this worker. See
[`DASHBOARD_OPERATIONS.md`](./DASHBOARD_OPERATIONS.md) for how they're used.

| Secret | Purpose | Notes |
|--------|---------|-------|
| `CF_API_TOKEN` | Cloudflare GraphQL (traffic/5xx) + Analytics Engine SQL (`ask_turns`/`mcp_queries`) | Account token, **Account Analytics: Read**. Rotate at Cloudflare → My Profile → API Tokens. |
| `GA_SA_KEY_JSON` | GA4 service-account key (full JSON) for sessions/engagement | **Shared with the Pitch dashboard** (`pitch-dashboard-ga@pitch-analytics-mcp…`). Rotating the SA key affects **both** dashboards — update Pitch too. |
| `GA_IMPERSONATE_SUBJECT` | domain-wide-delegation subject the SA impersonates (`mike@morper.net`) | identifier-ish, not a credential; required because GA access is via DWD |
| `GA_PROPERTY` | numeric GA4 property id (`343639505`) | not secret (an identifier); stored as a secret for convenience |
| `REFRESH_KEY` | gates the manual-refresh endpoint (`GET /?key=…`) | optional; any random string. Rotate by `wrangler secret put` + re-share. |
| `GH_TOKEN` | fine-grained PAT (`mmorper/concerts`, read Contents/Issues/PRs) for the Development tab | optional; expires — re-mint on the GitHub PAT page and re-put |

### Data-pipeline secrets — root `.env` (local) + GitHub Actions (CI)

Google OAuth + Maps/Places + music APIs, consumed by `scripts/` locally and by the
`data-refresh.yml` / `liner-notes.yml` workflows in CI:

`GOOGLE_SHEET_ID` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_REDIRECT_URI` ·
`GOOGLE_REFRESH_TOKEN` · `GOOGLE_MAPS_API_KEY` · `GOOGLE_PLACES_API_KEY` · `SHEET_RANGE` ·
`THEAUDIODB_API_KEY` · `LASTFM_API_KEY`

Build-time / public (compiled into the client bundle — **not secret**, but set in CI for the
build): `VITE_SETLISTFM_API_KEY` · `VITE_GA_MEASUREMENT_ID`.

### Syndication credentials — root `.env` (local) + GitHub Actions (CI)

Consumed by `scripts/syndication/` locally and by the `syndicate.yml` workflow in CI.
Two homes each, no prod store: nothing in the Workers or the client bundle ever holds these.

| Secret | Store | Used by | Notes |
|--------|-------|---------|-------|
| `BLUESKY_IDENTIFIER` | local + CI | Bluesky adapter | The handle — currently `concertsmorperhaus.bsky.social`. Not secret on its own; kept alongside the password so both rotate together. Changing the handle to `concerts.morperhaus.org` via DNS TXT means updating this value too. |
| `BLUESKY_APP_PASSWORD` | local + CI | Bluesky adapter | **An app password, never the account password.** Scoped, revocable, and — unusually — it does not expire. Generated at Settings → Privacy and Security → App Passwords. |
| `MASTODON_BASE_URL` | local + CI | Mastodon adapter | The instance — `https://mastodon.social`. An identifier, not a secret, but the adapter is useless without it. |
| `MASTODON_ACCESS_TOKEN` | local + CI | Mastodon adapter | Settings → Development → your app. No expiry. Needs `write:statuses` and `write:media`. |

`BLUESKY_SERVICE` overrides the PDS host (default `https://bsky.social`) and is
configuration, not a secret — set it only when pointing at a different service.

**The account handles, for reference** (public, not secrets):

| Channel | Handle | Note |
|---------|--------|------|
| Mastodon | `@concertsmorperhaus@mastodon.social` | Verified from the site via `rel="me"` in `index.html`. |
| Bluesky | `@concertsmorperhaus.bsky.social` | |
| Instagram | `@concertsmorperhaus` | Phase 3 (#334). |
| X | `@concertsmorps` | **Deliberately different.** X caps handles at 15 characters and `concertsmorperhaus` is 18. Not a typo — do not "correct" it. Phase 3 (#335). |

The **bio copy and Mastodon metadata fields** for these accounts are recorded in
`docs/specs/future/global-social-syndication.md` §"Account Setup" — the profiles
live on servers we do not control, so the repo holds the source of truth.

**A missing credential is not an error.** `configured()` returns false, the run
skips that channel with a notice, and the other channel still posts. Adding
Mastodon a week after Bluesky must not be a broken run.

**Revoking beats rotating here.** Both credentials are revocable from the
account's own settings, and neither has an expiry to race — so if either leaks,
revoke it in the platform UI first and generate a new one, rather than
following the rotate-then-revoke order the golden rules impose on API keys with
no revocation surface.

---

## Rotation runbook

Replace `<NAME>` with the secret. Example shown for `ANTHROPIC_API_KEY`; adapt the home list
from the matrix above for any other secret.

**1. Mint the new credential** in the provider console (Anthropic / Google / etc.).
**Do not revoke the old one yet.**

**2. Update every LOCAL home.** Edit each gitignored file by hand, or propagate from one
known-good file. Confirm convergence by fingerprint (never by printing):

```bash
for f in .env workers/ask-chat/.dev.vars workers/mcp-server/.dev.vars; do
  v=$(grep -i '^ANTHROPIC_API_KEY' "$f" | sed 's/^[^=]*=//' | tr -d '"' | xargs printf '%s')
  printf '%-40s %s\n' "$f" "$(printf '%s' "$v" | shasum -a 256 | cut -c1-12)"
done
# all three hashes must match
```

**3. Update every PROD home** — stream from the local file so the value is never printed:

```bash
# ask-chat prod
( cd workers/ask-chat && grep '^ANTHROPIC_API_KEY' .dev.vars | sed 's/^[^=]*=//' | tr -d '"' \
  | xargs printf '%s' | npx wrangler secret put ANTHROPIC_API_KEY )

# mcp-server prod
( cd workers/mcp-server && grep '^ANTHROPIC_API_KEY' .dev.vars | sed 's/^[^=]*=//' | tr -d '"' \
  | xargs printf '%s' | npx wrangler secret put ANTHROPIC_API_KEY )
```

`wrangler secret put` takes effect immediately — **no redeploy needed**; the running worker
picks it up on the next request.

**4. Update CI** — stream into the GitHub repo secret:

```bash
grep '^ANTHROPIC_API_KEY' .env | sed 's/^[^=]*=//' | tr -d '"' | xargs printf '%s' \
  | gh secret set ANTHROPIC_API_KEY
gh secret list | grep ANTHROPIC   # confirm the "Updated" timestamp is now
```

**5. Verify before revoking.**
- Prod MCP: call the `query` tool against `concerts.morperhaus.org/mcp` (a 401/auth error
  means a stale key somewhere).
- Prod ask-chat: `GET /api/ask/status` → `{mode}`; then a real `/api/ask/chat` turn.
- CI: `gh workflow run liner-notes.yml` (or wait for the next scheduled run).

**6. Now revoke the old credential** in the provider console. Done.

---

## Incident shortcut (leaked key)

If a key **leaks** (e.g. surfaces in a transcript/log), the old key is compromised and must
die — but the runbook order still holds to avoid an outage:

1. Mint new → propagate to **all** homes (steps 2–4) as fast as possible.
2. Verify (step 5).
3. Revoke the leaked key (step 6).

If you must revoke *immediately* (active abuse) and accept downtime, do so first — then expect
mcp-server `/mcp` and CI to fail until every home is updated. Know the matrix before choosing.

---

## See also

- [`api-setup.md`](./api-setup.md) — how to obtain each API key/credential.
- `workers/ask-chat/wrangler.toml` — inline secret list + Access identifiers.
- `docs/specs/future/global-ask-the-archive-chat/SPEC.md` §"Kill switch" — the ask-chat
  cost/abuse controls those secrets gate.
