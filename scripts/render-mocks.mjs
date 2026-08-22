// Render .dc.html artboards to PNG: evaluate renderVals(), expand sc-for/sc-if
// and {{holes}}, inline the local image as a data URI, screenshot at 1:1.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const DIR = process.argv[2];
const OUT = process.argv[3];
const FILES = process.argv.slice(4);

function get(obj, p) {
  if (p === 'true') return true;
  if (p === 'false') return false;
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function fill(tpl, scope) {
  return tpl.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (_, p) => {
    const v = get(scope, p);
    return v === undefined || v === null ? '' : String(v);
  });
}

// expand innermost-first so nested sc-for/sc-if resolve
function expand(html, scope) {
  let prev;
  do {
    prev = html;
    // sc-for FIRST: an sc-if inside a loop body references the loop variable,
    // which is not in scope until the loop has been expanded. Resolving sc-if
    // first silently dropped those branches.
    html = html.replace(/<sc-for\s+list="\{\{\s*([\w.$]+)\s*\}\}"\s+as="(\w+)"[^>]*>([\s\S]*?)<\/sc-for>/g,
      (_, p, as, body) => {
        const list = get(scope, p) || [];
        return list.map((item, i) => {
          const inner = Object.assign({}, scope, { [as]: item, $index: i });
          // NOT fill() first: that would substitute {{p.flag}} inside an
          // sc-if's value attribute before the sc-if pass could read it.
          return expand(body, inner);
        }).join('');
      });
    // Only resolve an sc-if whose root identifier is actually in scope.
    html = html.replace(/<sc-if\s+value="\{\{\s*([\w.$]+)\s*\}\}"[^>]*>([\s\S]*?)<\/sc-if>/g,
      (m, p, body) => {
        const root = p.split('.')[0];
        if (!(root in scope) && p !== 'true' && p !== 'false') return m;
        return get(scope, p) ? body : '';
      });
  } while (html !== prev);
  return fill(html, scope);
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--allow-file-access-from-files']
});

for (const f of FILES) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');

  // --- run renderVals() ---
  let vals = {};
  const logic = src.match(/<script data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (logic) {
    const body = logic[1].replace(/class Component extends DCLogic\s*\{/, 'class Component {');
    vals = new Function(`${body}; const c = new Component(); c.props = {}; return c.renderVals();`)();
  }

  // --- body between <x-dc> and </x-dc>, minus <helmet> ---
  let inner = src.slice(src.indexOf('<x-dc>') + 6, src.indexOf('</x-dc>'));
  const helmet = inner.match(/<helmet>([\s\S]*?)<\/helmet>/);
  const head = helmet ? helmet[1] : '';
  inner = inner.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  inner = expand(inner, vals);

  // --- inline the local jpg so file:// + CSP never matters ---
  inner = inner.replace(/src="([^"]+\.(?:jpg|jpeg|png))"/g, (m, name) => {
    const p = path.join(DIR, path.basename(name));
    if (!fs.existsSync(p)) return m;
    const ext = path.extname(p).slice(1).replace('jpg', 'jpeg');
    return `src="data:image/${ext};base64,${fs.readFileSync(p).toString('base64')}"`;
  });

  const m = inner.match(/width:\s*(\d+)px;\s*height:\s*(\d+)px;/);
  const w = m ? +m[1] : 1080, h = m ? +m[2] : 1350;

  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${head}
    <style>html,body{margin:0;padding:0;background:#0a0810}</style></head><body>${inner}</body></html>`,
    { waitUntil: 'networkidle0' });
  try { await page.evaluate(() => document.fonts.ready); } catch {}
  await new Promise(r => setTimeout(r, 450));

  // measure real overflow past the root box
  const over = await page.evaluate(() => {
    const root = document.body.firstElementChild;
    if (!root) return null;
    const rb = root.getBoundingClientRect();
    let maxB = 0, maxR = 0;
    root.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height && r.width) { maxB = Math.max(maxB, r.bottom); maxR = Math.max(maxR, r.right); }
    });
    return { bottomOver: Math.round(maxB - rb.bottom), rightOver: Math.round(maxR - rb.right) };
  });

  const out = path.join(OUT, f.replace('.dc.html', '.png'));
  await page.screenshot({ path: out });
  console.log(`${f.padEnd(26)} ${w}x${h}  bottomOver=${over.bottomOver}px rightOver=${over.rightOver}px`);
  await page.close();
}
await browser.close();
