# /handoff - Create Session Handoff Document

Creates a structured handoff document so the next Claude session can pick up exactly where this one left off. Use this when context is running low or you're done for the day but work is mid-stream.

## When to Use

- Context window is getting full and work is unfinished
- Ending a session with pending tasks the next session should continue
- Work spans multiple sessions and needs a clear status record

## Output

Creates `memory/session-handoff-{DATE}.md` with:
- What was completed this session
- What is pending or in-progress
- Key decisions made (and why)
- Relevant GitHub issues
- Exact next steps for the next session

---

## Workflow

### Step 1: Gather Context

Run these in parallel to understand the session's work:

```bash
# Commits made this session (since last tag or last N commits)
git log --oneline -20

# Current git status
git status

# Open GitHub issues
gh issue list --state open --limit 50
```

Also review:
- The current task the user was working on
- Any files that were modified but not yet committed
- Any decisions or trade-offs discussed

---

### Step 2: Identify Relevant Issues

From the open issue list, identify which issues are:

- **Referenced** — directly related to work done this session
- **Pending** — work that was started but not finished, tracked by an issue
- **Blocked** — issues that surfaced a blocker during this session
- **Discovered** — new issues that should be filed as follow-up

Do NOT list every open issue — only ones relevant to the current session's work.

---

### Step 3: Draft the Handoff Document

Structure:

```markdown
# Session Handoff — {DATE}

## What Was Completed

{BULLET LIST: each shipped item, with commit hash if applicable}
- feat: [description] (`{COMMIT_HASH}`)
- fix: [description] (`{COMMIT_HASH}`)

## Releases Shipped

{IF any releases were made this session:}
- **v{VERSION}** — {title} (internal/user-facing)

{IF none:}
(none this session)

## In Progress / Pending

{BULLET LIST: work started but not finished, or explicitly deferred}
- [Task description] — {status: e.g. "next step is X"}

{IF nothing pending:}
(nothing pending — clean handoff)

## Key Decisions

{NUMBERED LIST: decisions made this session with brief rationale}
1. **{Decision}** — {why, e.g. "Dropped Deezer because tokens expire in ~15 min, incompatible with static pipeline"}

{IF no significant decisions:}
(no major decisions — routine work)

## Relevant GitHub Issues

{TABLE of issues touched, referenced, or newly relevant:}

| Issue | Title | Status | Notes |
|-------|-------|--------|-------|
| #{N} | {title} | Open / Closed this session | {why relevant} |

{IF no relevant issues:}
(no GitHub issues directly relevant to this session's work)

## Next Steps for Next Session

{NUMBERED LIST: exact actions, in priority order, for the next session to take}
1. {Specific action} — {context needed}
2. {Specific action} — {context needed}

## Files to Know About

{Only if non-obvious files were central to this session's work}
- `{path}` — {why it matters / what changed}
```

---

### Step 4: Write the File

Write to `memory/session-handoff-{DATE}.md` where `{DATE}` is today's date in `YYYY-MM-DD` format.

If a handoff file for today already exists, append a `-2` suffix (e.g., `session-handoff-2026-03-07-2.md`) rather than overwriting.

---

### Step 5: Confirm

Show the user the file path and a brief summary of what was captured:

> ✅ Handoff written to `memory/session-handoff-{DATE}.md`
>
> Captured:
> - {N} completed items
> - {N} pending tasks
> - {N} relevant GitHub issues
> - {N} next steps

---

## Notes

- **Be specific about next steps** — vague handoffs ("continue the work") are useless. The next session should be able to start immediately without re-reading the whole conversation.
- **GitHub issues are optional context** — only include them when they're genuinely relevant. Don't pad the document.
- **Decisions section is the most valuable** — it captures the "why" that git history doesn't record.
- **The handoff is consumed and deleted** at Step 11.5 of `/release` after the work ships.
