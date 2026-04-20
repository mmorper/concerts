# Morperhaus Video Project

HyperFrames-based video production workspace. One HyperFrames project, currently one active video.

## Directory layout

```
video/
├── README.md                        this file — project pattern
├── CLAUDE.md                        agent-specific instructions
├── AGENTS.md                        agent guidelines
├── hyperframes.json                 HyperFrames config
├── meta.json                        project metadata
├── index.html                       master composition (the "root" video)
├── assets/                          shared assets (flat, reusable across videos)
│   ├── album-*.jpg
│   ├── artist-*.jpg
│   └── venue-*.jpg
├── compositions/
│   └── {video-slug}/                per-video source data
│       ├── payload.json
│       └── build-payload.mjs
├── scripts/
│   └── render.mjs                   render wrapper (renames output per convention)
└── renders/
    └── YYYYMMDD-{video-slug}.mp4    naming convention for all deliverables
```

## How to render

Use the wrapper (not `hyperframes render` directly) so the output lands with the correct filename:

```bash
cd video
node scripts/render.mjs --slug {video-slug}              # high quality (default)
node scripts/render.mjs --slug {video-slug} --quality standard   # faster iteration
```

The wrapper runs `npx hyperframes render` and renames the resulting MP4 to `YYYYMMDD-{video-slug}.mp4`. Slug must be kebab-case and match the folder name under `compositions/`.

## Conventions

### Slugs

Kebab-case, lowercase, matches the artist/subject's URL slug style (same as the main site's post URLs). Examples:
- `social-distortion-thread`
- `depeche-mode-archive`

The slug is used in three places and should be identical across all:
1. Source folder: `compositions/{slug}/`
2. Render filename: `YYYYMMDD-{slug}.mp4`
3. The `--slug` argument to `render.mjs`

### Assets

Shared across all videos. Flat structure inside `video/assets/`. Named by type + subject:
- `album-{artist-slug}.jpg`
- `artist-{artist-slug}.jpg`
- `venue-{venue-slug}.jpg`

No per-video asset subfolders. If a video uses an asset nothing else does, it still lives here — the naming carries enough context.

### Per-video source folders

Each video gets `compositions/{slug}/` with:
- `payload.json` — the data the video was built from
- `build-payload.mjs` — regenerates `payload.json` from the concerts archive

Both are reference material. The current master `index.html` has its data inline and doesn't read `payload.json` at render time. The payload folder is the audit trail: "what data did we build this video from?"

### Renders

Everything in `renders/` is a deliverable. No intermediate frame dumps, no verification screenshots. If a composition needs scratch artifacts during iteration, use `/tmp/` or a gitignored `.scratch/`.

## Multi-video future

Current workspace is single-project per video — `video/index.html` is THE composition. When a second video is commissioned, we choose one of:

- **Sibling project**: `video-{slug}/` as its own HyperFrames project. Simplest if videos share little DOM.
- **Multi-composition**: refactor `video/index.html` to be a router that loads per-video sub-compositions via `data-composition-src`.

Decision deferred until a second video exists. Don't build scaffolding for it now.

## For AI agents

See [CLAUDE.md](CLAUDE.md) for skill invocation, linting, CLI commands, and the non-negotiable rules of the HyperFrames framework.
