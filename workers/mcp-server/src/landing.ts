// Human-facing landing page served on a browser GET /mcp. MCP clients POST (or send
// an SSE GET with a session id) and never see this — see index.ts for the branch.
// Self-contained HTML (inline CSS + SVG); stats are injected live from the data layer.

export interface LandingStats {
  shows: number;
  venues: number;
  cities: number;
  firstYear: number;
}

const OG_IMAGE = "https://concerts.morperhaus.org/og-mcp.png";
const SITE = "https://concerts.morperhaus.org";

export function renderLandingPage(stats: LandingStats): string {
  const { shows, venues, cities, firstYear } = stats;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ask the Archive — Morperhaus Concert Archive</title>
<meta name="description" content="Forty years of live music, ${firstYear} to now — explore the Morperhaus Concert Archive inside Claude. Just ask." />
<meta property="og:title" content="Ask the Archive Anything" />
<meta property="og:description" content="Bring 40 years of concerts into Claude and just ask — your history with a band, every show at a venue, or just 'surprise me.'" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${SITE}/mcp" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${OG_IMAGE}" />
<link rel="icon" href="${SITE}/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root { --bg:#fafaf9; --ink:#1c1917; --muted:#57534e; --faint:#78716c; --line:#e7e5e4; --accent:#4f46e5; --accent-soft:#eef2ff; --accent-ink:#3730a3; --card:#fff; }
  * { box-sizing:border-box; }
  body { margin:0; background:radial-gradient(1200px 480px at 50% -8%, #fff 0%, rgba(255,255,255,0) 60%), var(--bg); color:var(--ink); font-family:"Source Sans 3",system-ui,sans-serif; -webkit-font-smoothing:antialiased; line-height:1.55; }
  .wrap { max-width:680px; margin:0 auto; padding:60px 24px 56px; }
  .brand { display:flex; align-items:center; gap:9px; margin:0 0 20px; }
  .brand svg { display:block; animation:spin 9s linear infinite; }
  .eyebrow { font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); font-weight:600; }
  h1 { font-family:"Playfair Display",Georgia,serif; font-weight:500; letter-spacing:-.02em; font-size:52px; line-height:1.05; margin:0 0 18px; }
  h1 .pt { color:var(--accent); }
  .lede { font-size:19px; color:var(--muted); margin:0 0 26px; max-width:34em; }
  .stats { display:flex; flex-wrap:wrap; align-items:center; margin:0 0 40px; }
  .stats span { font-size:13.5px; letter-spacing:.04em; color:var(--faint); font-weight:600; }
  .stats span b { color:var(--ink); }
  .stats i { width:1px; height:13px; background:var(--line); margin:0 16px; }
  .chat { background:var(--card); border:1px solid var(--line); border-radius:16px; box-shadow:0 1px 2px rgba(0,0,0,.04),0 14px 36px rgba(28,25,23,.07); overflow:hidden; margin:0 0 40px; }
  .chat__bar { display:flex; align-items:center; gap:7px; padding:13px 16px; border-bottom:1px solid var(--line); }
  .dot { width:11px; height:11px; border-radius:50%; background:#e7e5e4; }
  .chat__title { margin-left:8px; font-size:13px; color:var(--muted); font-weight:600; }
  .chat__body { padding:22px 20px 24px; }
  .row { display:flex; margin-bottom:16px; }
  .row:last-child { margin-bottom:0; }
  .row.user { justify-content:flex-end; }
  .bubble { max-width:80%; padding:11px 15px; border-radius:14px; font-size:15.5px; }
  .bubble.user { background:var(--accent-soft); color:var(--accent-ink); border-bottom-right-radius:5px; }
  .answer { display:flex; gap:12px; align-items:flex-start; }
  .avatar { flex:none; width:34px; height:34px; border-radius:50%; background:#1c1917; display:grid; place-items:center; margin-top:2px; }
  .avatar svg { animation:spin 7s linear infinite; }
  .bubble.bot { background:#fafaf9; border:1px solid var(--line); color:var(--ink); border-bottom-left-radius:5px; }
  .bubble.bot b { font-weight:600; }
  .anim { opacity:0; transform:translateY(8px); animation:rise .55s cubic-bezier(.2,.7,.3,1) forwards; }
  .row.user .anim { animation-delay:.15s; }
  .row.bot .anim { animation-delay:.7s; }
  @keyframes rise { to { opacity:1; transform:none; } }
  @keyframes spin { to { transform:rotate(360deg); } }
  .try { margin:0 0 40px; }
  .try__label { font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:600; margin:0 0 14px; }
  .chips { display:flex; flex-wrap:wrap; gap:10px; }
  .chip { background:var(--card); border:1px solid var(--line); border-radius:999px; padding:9px 16px; font-size:15px; color:var(--ink); transition:border-color .15s,transform .15s; }
  .chip:hover { border-color:var(--accent); transform:translateY(-1px); }
  .chip::before { content:"\\201C"; color:var(--accent); }
  .chip::after { content:"\\201D"; color:var(--accent); }
  .connect { border-top:1px solid var(--line); padding-top:32px; }
  .connect h2 { font-family:"Playfair Display",Georgia,serif; font-weight:500; font-size:24px; margin:0 0 8px; }
  .connect p { color:var(--muted); font-size:16px; margin:0 0 18px; max-width:36em; }
  .url { display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .url code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:15.5px; color:var(--ink); }
  .copy { flex:none; border:1px solid var(--accent); background:var(--accent); color:#fff; border-radius:8px; padding:8px 14px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .15s; min-width:80px; }
  .copy.ok { background:#16a34a; border-color:#16a34a; }
  details { margin:18px 0 0; }
  summary { cursor:pointer; font-size:14.5px; color:var(--accent); font-weight:600; list-style:none; }
  summary::-webkit-details-marker { display:none; }
  summary::after { content:" →"; }
  details[open] summary::after { content:""; }
  details p { font-size:14.5px; }
  pre { background:#1c1917; color:#fafaf9; border-radius:10px; padding:16px 18px; overflow:auto; font-size:13.5px; line-height:1.5; margin:12px 0 0; }
  footer { margin-top:48px; padding-top:22px; border-top:1px solid var(--line); font-size:14px; color:var(--muted); }
  footer a { color:var(--accent); text-decoration:none; }
  @media (max-width:520px){ h1{font-size:40px;} .wrap{padding-top:44px;} .stats i{margin:0 11px;} }
  @media (prefers-reduced-motion:reduce){ .anim{animation:none;opacity:1;transform:none;} .brand svg,.avatar svg{animation:none;} }
</style>
</head>
<body>
  <main class="wrap">
    <div class="brand">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="#1c1917"/><circle cx="12" cy="12" r="4.6" fill="none" stroke="#fafaf9" stroke-width="1.1"/><circle cx="12" cy="12" r="1.7" fill="#fafaf9"/></svg>
      <span class="eyebrow">Morperhaus Concert Archive</span>
    </div>
    <h1>Ask the archive anything<span class="pt">.</span></h1>
    <p class="lede">Forty years of live music — ${firstYear} to now — ready to explore inside Claude. Ask it the way you'd ask a friend who never misses a show.</p>
    <div class="stats">
      <span><b>${shows}</b> shows</span><i></i>
      <span><b>${venues}</b> venues</span><i></i>
      <span><b>${cities}</b> cities</span><i></i>
      <span>since <b>${firstYear}</b></span>
    </div>
    <div class="chat" role="img" aria-label="Example conversation with the archive in Claude">
      <div class="chat__bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="chat__title">Claude</span></div>
      <div class="chat__body">
        <div class="row user"><div class="bubble user anim">What shows happened on June 4th, over the years?</div></div>
        <div class="row bot"><div class="answer anim">
          <span class="avatar" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fafaf9" stroke-width="1.5"/><circle cx="12" cy="12" r="2.3" fill="#fafaf9"/></svg></span>
          <div class="bubble bot">On June 4th, across the years: <b>Howard Jones</b> at Irvine Meadows in &rsquo;85, <b>The Smithereens</b> at the Celebrity Theatre in &rsquo;92, and <b>Tears for Fears</b> at the Kia Forum in 2022. Four different decades, same date on the calendar.</div>
        </div></div>
      </div>
    </div>
    <div class="try">
      <p class="try__label">Try asking</p>
      <div class="chips">
        <span class="chip">Have you ever seen Depeche Mode?</span>
        <span class="chip">Show me everything at the 9:30 Club</span>
        <span class="chip">Surprise me with a show worth remembering</span>
      </div>
    </div>
    <section class="connect">
      <h2>Bring it into Claude</h2>
      <p>If you use Claude, you can add the archive as a connector and start asking. It answers in its own voice — always true to the shows that really happened.</p>
      <div class="url">
        <code>${SITE.replace("https://", "")}/mcp</code>
        <button class="copy" onclick="navigator.clipboard&&navigator.clipboard.writeText('${SITE}/mcp');this.textContent='Copied \\u2713';this.classList.add('ok')">Copy</button>
      </div>
      <details>
        <summary>Using Claude Desktop? Setup details</summary>
        <p>Add this to your <code>claude_desktop_config.json</code>, then restart Claude Desktop:</p>
        <pre>{
  "mcpServers": {
    "morperhaus": {
      "type": "http",
      "url": "${SITE}/mcp"
    }
  }
}</pre>
        <p>Any AI assistant that supports remote connectors works the same way — point it at the link above.</p>
      </details>
    </section>
    <footer>&larr; Back to <a href="${SITE}">the Morperhaus Concert Archive</a></footer>
  </main>
</body>
</html>`;
}
