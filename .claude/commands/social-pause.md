# /social-pause — Stop (or resume) all outbound social posting

Engage or release the syndication kill switch. Nothing reaches Bluesky,
Mastodon, Instagram or X while it is engaged.

**Usage:** `/social-pause [reason]` · `/social-pause resume` · `/social-pause status`

---

## What the switch actually is

`data/syndication-pause.json`, committed. **A slash command cannot stop a cron**
— the workflows run on GitHub's schedule whether or not anyone is in a Claude
session, so the switch has to be a file in the repository that the scheduled run
reads. This command is a convenient way to flip it; the file is the mechanism.

Two independent layers honour it:

1. `.github/workflows/syndicate.yml` gates the whole step on it, so a paused
   repo cannot post even if the run loop is changed or bypassed.
2. `scripts/syndication/run.ts` checks it before anything reaches an adapter.

## The rule that matters

**The change only takes effect once it is committed and pushed.** The scheduled
workflow reads the file from the repository, not from anyone's machine. A pause
that lives only in a working copy stops nothing.

---

## Steps

### `/social-pause [reason]`

1. Run `npm run syndicate -- --pause "<reason>"`. If no reason was given, ask
   for one — a switch with no explanation is one nobody dares touch later.
2. `git add data/syndication-pause.json`
3. Commit: `chore: pause social syndication — <reason>`
4. **Push.** Say plainly that it is not in effect until this lands.
5. Confirm with `npm run syndicate -- --status`.

### `/social-pause resume`

1. **Ask the owner to confirm.** Resuming makes the archive start posting
   publicly again, possibly within the hour, and it is not obviously reversible
   once something is live. Never resume on inference — only on a clear "yes,
   resume".
2. Run `npm run syndicate -- --resume`, then commit and push as above.
3. Say when the next scheduled run is, so nobody is surprised: On This Day
   07:00 UTC daily, Liner Notes 08:00 UTC Mondays, Syndicate 10:00 UTC daily.
4. Suggest `npm run syndicate -- --dry-run` first, to see what is queued before
   it goes out. After a long pause the backlog can be larger than expected.

### `/social-pause status`

Run `npm run syndicate -- --status` and report it. Also check whether the
committed file agrees with the working copy — a local-only change is the one
failure mode this command exists to prevent.

---

## Belt and braces

For an immediate stop that does not wait on CI, also disable the **Syndicate**
workflow in the GitHub Actions UI. Mention it, but do not treat it as the
mechanism: a workflow disabled in a web UI is invisible in the repository, and
six months later nobody knows why it happened or that it did.

## Do not

- **Do not resume without an explicit instruction.** Ambiguity means stay paused.
- **Do not delete** `data/syndication-pause.json` to resume. `paused: false`
  keeps the audit trail; a missing file is indistinguishable from never having
  paused.
- **Do not touch the ledger** (`data/syndication-log.json`) to stop posting.
  Different mechanism, different purpose — editing it would corrupt the
  idempotency record and risk double-posting later.
