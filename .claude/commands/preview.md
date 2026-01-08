# /preview - Start Development Server

Start the dev server with helpful context about current project state.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--port` | No | 5173 | Port number |
| `--open` | No | false | Open browser automatically |

**Examples:**
```
/preview              # Start on default port
/preview --open       # Start and open browser
/preview --port 3000  # Use custom port
```

---

## Workflow

### Step 1: Check for Running Servers

```bash
lsof -i :5173
```

**If port in use:**
> ⚠️ Port 5173 is already in use
> - PID 12345: node (npm run dev)
>
> Options:
> 1. Kill existing process and start fresh
> 2. Use different port (--port 5174)
> 3. Cancel
>
> Choose: (1 / 2 / 3)

---

### Step 2: Show Project Context

Display current project state before starting:

```
============================================================
🎸 MORPERHAUS CONCERTS
============================================================

📦 Version: v{VERSION}
📊 Data: {CONCERTS} concerts | {ARTISTS} artists | {VENUES} venues

📋 Recent Commits:
   • {HASH_1} {MESSAGE_1}
   • {HASH_2} {MESSAGE_2}
   • {HASH_3} {MESSAGE_3}

📝 Open Specs (docs/specs/future/):
   • {SPEC_1}
   • {SPEC_2}

🔗 Production: https://concerts.morperhaus.org
```

---

### Step 3: Start Dev Server

```bash
npm run dev
```

**Output:**
```
  VITE v6.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
  ➜  press h + enter to show help
```

---

### Step 4: Show Quick Actions

After server starts:

```
============================================================
🚀 DEV SERVER RUNNING
============================================================

Quick Actions:
   • Press 'o' to open in browser
   • Press 'r' to restart
   • Press 'q' to quit

Useful Commands:
   /validate          Run all checks
   /data-refresh      Refresh data pipeline
   /release patch     Ship a bugfix

Deep Link Examples:
   http://localhost:5173/?scene=artists&artist=depeche-mode
   http://localhost:5173/?scene=venues&venue=hollywoodbowl
   http://localhost:5173/?scene=timeline&year=1990
```

---

## Port Conflict Resolution

If the default port is busy, the command offers options:

### Option 1: Kill Existing Process
```bash
kill -9 <PID>
npm run dev
```

### Option 2: Use Different Port
```bash
npm run dev -- --port 5174
```

### Option 3: Attach to Existing
If a dev server is already running, just show the URL:
> ✅ Dev server already running at http://localhost:5173

---

## Browser Opening

With `--open` flag:
```bash
npm run dev -- --open
```

Or manually:
```bash
open http://localhost:5173
```

---

## Common Scenarios

### Fresh Start
```
/preview --open
```
Shows context, starts server, opens browser.

### Quick Check
```
/preview
```
Shows context, starts server, stays in terminal.

### After Data Refresh
```
/data-refresh
/preview --open
```
Refresh data, then preview changes.

---

## Related

- `npm run dev` — Direct Vite command
- `npm run build` — Production build
- `/validate` — Run checks before previewing
- `/data-refresh` — Update data before previewing
