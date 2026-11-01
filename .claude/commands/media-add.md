# /media-add — Add a show's photos and videos from chat

Take one show from Photos to a pull request, with Claude running every command.
The owner judges in the review page, frames in the crop page, and does nothing
in a terminal.

**Usage:** `/media-add <YYYY-MM-DD>` · `/media-add <artist>` · `/media-add`

Read `.claude/skills/media-pipeline/SKILL.md` first. This command is the order of
work; that skill holds the safety rules and the findings behind them.

---

## The division of labour

**Chat replaces the terminal. It does not replace the pages.**

| Who | Does what |
|---|---|
| Owner | Every verdict, every act credit, every clip mark, every hero, signature and crop |
| Claude | Every command, every check of the output, the commit and the PR |

Claude does not pick photographs, even when asked to narrow them down. Every
automatic attempt at judging a photograph in this pipeline has failed. Claude may
look at frames to check orientation, duplicates or credits, and reports what it
sees for the owner to decide.

---

## How to run things

- **Library commands go in the Terminal panel** (`run_in_terminal`), not Bash. The
  owner can see them and any prompt they raise.
- **Say so before every library read.** macOS may put up a permission prompt, and a
  read stalls silently behind it. If the owner is not at the Mac, wait.
- **Open the pages in the browser pane** with `navigate`. They load slowly, so a
  blank page in the first screenshot is not a failure. Look again before diagnosing.
- **Close each tab when its step ends.** The review server holds port 8787 and the
  crop server holds 8788.
- **Check progress, not time.** If a command looks stuck, use the 60-second CPU
  check in the media-pipeline skill.
- **`npm run media <date>` is the source of truth for what is next.** It waits for
  input, so pipe `q` into it to read the state without choosing anything.

---

## Steps

### 1. Find the show

Match the argument against `public/data/concerts.json`. If an artist has several
shows, ask which one. If the owner names a recent trip, confirm the dates.

Say the bill out loud. Every act on it needs its own credit.

**Do not use the `npm run media` picker for a new show.** It only lists shows the
audit knows about, and the audit may predate the show. Go straight to the date.

### 2. Branch

Start from the latest `origin/main`, because local `main` is often behind:

```bash
git fetch origin main
git switch -c data/media-<artist>-<YYYY-MM> origin/main
```

Several shows from one trip can share a branch and a PR.

### 3. Confirm the library has synced

**A partial sync gives no error.** It looks like a show with few photos. One show
came back as 6 photos and no video, and held 81 assets after an overnight sync.

Ask the owner whether Photos says it is up to date. If this Mac is new or was
offline, check the library total:

```bash
concert-photos-audit/bin/osxphotos query --count --quiet
```

It was 59,269 on 2026-11-01, and takes about two minutes. A total far below that
means the sync is not finished. Stop and wait.

### 4. Open the review page

```bash
npm run media:review <YYYY-MM-DD>
```

This holds its tab until stopped. Then check what came back before handing over:

- Read `concert-photos-audit/review/<date>/all.json`. Report the number of photos
  and clips, and the time span.
- **Compare `IMG_` numbers.** Sort them and look for runs of missing numbers. Keep
  the camera ranges apart, since two phones can run different sequences.
- **If a long run is missing, say so before the owner judges.** Check for a sync
  gap first. A number from outside the 17:00 to 04:00 window is a normal gap. So is
  one that is not in the library at all, which usually means it was deleted.
- If nothing came back at all, do not fall back to the inbox without asking. That
  route skips the review page and the on-screen credits.

Tell the owner what to do, including which acts to credit, and open the page.

### 5. Check the verdicts, then write them

When the owner says they are done, read `verdicts.json` and check, before anything
is ingested:

- **All judged.** Name anything left unjudged.
- **Every keeper has an act,** unless its subject is venue, crowd or stub.
- **No duplicate keepers.** Group keepers by filename without the extension. The
  library often holds a DNG or HEIC beside an edited `.jpg` of the same shot, and
  both publish if both are kept. If a pair exists, stop and ask. Fixing this after
  ingest means hand-editing the index.
- **Times fit the bill.** On a multi-act night, openers should come first. Report
  anything that looks wrong and leave the credit to the owner.
- **Unmarked clips.** Name any kept clip with no marks. It falls back to automatic
  frame picking, and those frames need judging afterwards.

If the show already holds a signature, add `"signature": true` to that asset in
`verdicts.json` first, or the next ingest clears it. Then:

```bash
npm run media:review <YYYY-MM-DD> -- --finish
```

### 6. Mine the kept clips

Skip this if no clips were kept.

```bash
npm run media:frames <YYYY-MM-DD>
```

Only kept clips are downloaded. In and out points produce a video and no stills. A
single marked moment produces a still that is accepted automatically. An unmarked
clip produces frames to judge.

**If frames were staged,** reload the review page, have the owner judge them, and
run `--finish` again. Finishing twice is correct, because mining created stills
that did not exist the first time.

A kept clip whose frames were all rejected publishes nothing. That is a normal end
state, not missing work.

### 7. Ingest

Stop the review server first, then run:

```bash
npm run media:ingest <YYYY-MM-DD>
```

The `.MOV` lines under "Skipped" and the metadata lines under "Warnings" are normal. Then read `public/data/media-index.json` for this date and confirm:

- **Every still is `quality: 'original'`.** A preview master never upgrades in
  place, so do not commit one. Find out why the original did not arrive.
- **Credits match the selects,** and venue frames carry no act.
- **Stills are upright.** Build a contact sheet and look, because DNGs arrive from
  a different path to HEICs. The index gives raw sensor size for a DNG, so a
  landscape `sourceWidth` on a portrait still is not a bug.

Renders sit in `video/renders/` and stay out of git. Their top-level `uuid` is null
and the real one is under `render`, so do not read that as a duplicate.

### 8. Crop, hero, signature, share images

```bash
npm run media:crop <YYYY-MM-DD>
```

Ask the owner for one hero per act, and a saved box on every still. Pressing
`enter` is what saves a box. A venue frame cannot be a hero.

If an act already has stills from another show, the signature is a real choice.
`npm run media:crop <artist-slug>` shows every show at once, and that is where to
choose it. A signature is optional for an act with one show.

The session renders share images as it runs, for every still whose box changed or
that has none, and prints a line each time. These are what a shared link to one
photo previews with. It needs the network for the card's fonts. **Wait for the last
line before stopping it,** and look at one image for each act before moving on.
`npm run media:share <YYYY-MM-DD>` redoes a show by hand.

### 9. Publish the videos

Skip this if no clips were trimmed, or the owner does not want them on the site.

**Ask first, naming each clip. An upload is public the moment it finishes, before
any PR merges.** A clip kept in the review was kept to mine, which is not the same
as a yes to showing it.

Check the web copies first. This uploads nothing and needs no credentials:

```bash
npm run media:publish-video <YYYY-MM-DD> -- --dry-run
```

Look at each poster in `video/web/` and report anything wrong, such as a blurred
frame or a mic across a face. The owner chooses the moment, and
`--only <clip> --poster-at <seconds>` applies it. Then, with their yes:

```bash
npm run media:publish-video <YYYY-MM-DD>
```

Each clip is checked before `url` is written: encoded right, no metadata, and read
back through the public URL with range requests. A clip that fails is removed from
the bucket and stays off the site, while the rest carry on. It needs the `R2_MEDIA_`
values in `.env` (`docs/SECRETS.md`) and the renders on disk, so in a worktree link
`video/renders` from the main checkout first.

### 10. Commit and open the PR

Confirm the phase reads `done`:

```bash
echo q | npm run --silent media <YYYY-MM-DD>
```

Then run:

```bash
npx vitest run test/pipeline
npm run --silent validate:docs
```

Re-check the branch, then stage by name: `data/media-decisions.json`,
`public/data/media-index.json`, and the show's files in `public/images/shows/` and
`public/og/shows/`.
Never use `git add -A`.

Commit with the `data:` prefix and open the PR. Use a draft if more shows are
coming, because **merging deploys and the photos go public**.

**Do not rebase a pushed branch or force-push.** Add new shows as new commits.

**Do not merge without the owner's go-ahead.** Say that queued posts for these acts
may start using the new stills.

---

## When something goes wrong

| What you see | What it means |
|---|---|
| Fewer photos than the owner remembers | Partial sync. See step 3 |
| A read flat at about 2 seconds of CPU | A permission prompt. Ask if anyone is at the Mac |
| Port 8787 or 8788 is in use | An old server. Close its tab, or stop the pid it names |
| `No media in this window` | Nothing dated 17:00 to 04:00. Check the sync and the date before giving up |
| A blank crop page | It is still loading. Take another screenshot |
| `quality: 'preview'` in the index | The fetch failed. Fix it before committing |
| `Missing from .env: R2_MEDIA_...` | The bucket credentials are not on this machine. See `docs/SECRETS.md` |
| `read-back failed` on a clip | R2 stored it but the public URL did not serve it. Check the custom domain |
