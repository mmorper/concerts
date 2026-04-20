#!/usr/bin/env node
// Wrapper around `hyperframes render` that renames the output to
// YYYYMMDD-{slug}.mp4. Slug is kebab-style (same convention as post URLs).
//
// Usage:
//   node scripts/render.mjs --slug social-distortion-thread
//   node scripts/render.mjs --slug social-distortion-thread --quality standard

import { execSync } from 'node:child_process';
import { readdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const rendersDir = join(projectRoot, 'renders');

const args = new Map();
for (let i = 0; i < process.argv.length - 2; i++) {
  const a = process.argv[i + 2];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 3];
  args.set(a.slice(2), next && !next.startsWith('--') ? next : true);
}

const slug = args.get('slug');
if (!slug || typeof slug !== 'string') {
  console.error('Usage: node scripts/render.mjs --slug <kebab-slug> [--quality standard|high]');
  process.exit(1);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`Invalid slug: "${slug}". Use lowercase kebab-case (e.g. social-distortion-thread).`);
  process.exit(1);
}

const quality = args.get('quality') || 'high';

const before = new Set(readdirSync(rendersDir));
console.log(`→ Rendering (${quality}) ...`);
execSync(`npx hyperframes render --quality ${quality}`, { cwd: projectRoot, stdio: 'inherit' });

const newMp4s = readdirSync(rendersDir)
  .filter((f) => !before.has(f) && f.endsWith('.mp4'))
  .sort();
if (newMp4s.length === 0) {
  console.error('No new MP4 found in renders/.');
  process.exit(1);
}
const latest = newMp4s[newMp4s.length - 1];

const d = new Date();
const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const newName = `${dateStr}-${slug}.mp4`;

renameSync(join(rendersDir, latest), join(rendersDir, newName));
console.log(`✓ ${newName}`);
