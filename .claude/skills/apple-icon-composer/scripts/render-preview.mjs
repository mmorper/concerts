#!/usr/bin/env node
/**
 * Validate an Icon Composer .icon package and render a flattened squircle preview.
 *
 * Usage:  node render-preview.mjs <path/to/Name.icon> [out.png]
 *
 * Validates icon.json (parse + every layer's image-name exists in Assets/) and composites
 * the base fill + all visible group layers (back→front) into a masked PNG. This is the BASE
 * composition only — live Liquid Glass specular/refraction render solely in Icon Composer.
 *
 * Requires `sharp` (resolve from the host project's node_modules — run from a repo that has it).
 */
import { readFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';

const iconPath = process.argv[2];
if (!iconPath) {
  console.error('Usage: node render-preview.mjs <path/to/Name.icon> [out.png]');
  process.exit(1);
}

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('❌ `sharp` not found. Run this from a project that has sharp installed.');
  process.exit(1);
}

const S = 1024;
const jsonPath = join(iconPath, 'icon.json');
const assetsDir = join(iconPath, 'Assets');

if (!existsSync(jsonPath)) {
  console.error(`❌ No icon.json at ${jsonPath}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch (e) {
  console.error(`❌ icon.json is not valid JSON: ${e.message}`);
  process.exit(1);
}
console.log('✓ icon.json parses');

// --- color helpers ---------------------------------------------------------
function toCss(color) {
  // "<space>:R,G,B,A" with 0–1 components → CSS rgba(); preview ignores the color space.
  if (typeof color !== 'string' || !color.includes(':')) return '#444';
  const [, comps] = color.split(':');
  const [r, g, b, a = '1'] = comps.split(',').map(Number);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}

function backgroundSvg(fill) {
  let stops;
  if (typeof fill === 'string') {
    stops = fill === 'system-dark' ? ['#1c1c1e', '#000'] : ['#fff', '#e5e5ea'];
  } else if (fill?.solid) {
    const c = toCss(fill.solid);
    stops = [c, c];
  } else if (fill?.['linear-gradient']) {
    stops = fill['linear-gradient'].map(toCss);
  } else if (fill?.['automatic-gradient']) {
    const c = toCss(fill['automatic-gradient']);
    stops = [c, c];
  } else {
    stops = ['#3a2a5c', '#1e1b4b'];
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/>
    </linearGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#bg)"/></svg>`);
}

// --- collect + validate layers (back→front) --------------------------------
const composites = [];
let missing = 0;
for (const group of manifest.groups ?? []) {
  if (group.hidden) continue;
  for (const layer of group.layers ?? []) {
    if (layer.hidden) continue;
    const name = layer['image-name'];
    const file = join(assetsDir, name);
    if (!existsSync(file)) {
      console.error(`❌ missing asset: Assets/${name}`);
      missing++;
      continue;
    }
    const scale = layer.position?.scale ?? 1;
    const [tx = 0, ty = 0] = layer.position?.['translation-in-points'] ?? [];
    const dim = Math.max(1, Math.round(S * scale));
    let img = name.toLowerCase().endsWith('.svg')
      ? sharp(file, { density: 144 }).resize(dim, dim)
      : sharp(file).resize(dim, dim);
    if (layer.opacity != null && layer.opacity < 1) {
      img = img.ensureAlpha().composite([{
        input: Buffer.from([255, 255, 255, Math.round(layer.opacity * 255)]),
        raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in',
      }]);
    }
    const buf = await img.png().toBuffer();
    // Apple points: origin center, +y up → invert y for image coords.
    const left = Math.round((S - dim) / 2 + tx);
    const top = Math.round((S - dim) / 2 - ty);
    composites.push({ input: buf, left, top });
  }
}

if (missing) {
  console.error(`\n❌ ${missing} asset(s) missing — fix before shipping.`);
  process.exit(1);
}
console.log(`✓ ${composites.length} layer(s) resolved`);

// --- composite + squircle mask ---------------------------------------------
const r = Math.round(S * 0.2237);
const mask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${r}" ry="${r}"/></svg>`
);
const flat = await sharp(backgroundSvg(manifest.fill)).composite(composites).png().toBuffer();

const out = process.argv[3]
  || join(dirname(iconPath), basename(iconPath).replace(/\.icon$/, '') + '-preview.png');
await sharp(flat).composite([{ input: mask, blend: 'dest-in' }]).png().toFile(out);
console.log(`✓ wrote preview → ${out}`);
console.log('\nℹ︎ Base composition only. Open the .icon in Icon Composer to see live Liquid Glass.');
