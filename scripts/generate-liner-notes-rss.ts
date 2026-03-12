#!/usr/bin/env tsx
/**
 * Generate Liner Notes RSS Feed
 *
 * Regenerates public/liner-notes.xml from the current public/data/liner-notes.json.
 * Run this after manually editing liner-notes.json (adding or removing posts).
 * The full pipeline (npm run generate:liner-notes) also regenerates this automatically.
 *
 * Run: npm run generate:liner-notes-rss
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { generateRss } from './liner-notes/rss.ts'
import type { LinerNotesData } from '../src/types/liner-notes.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LINER_NOTES_PATH = join(ROOT, 'public', 'data', 'liner-notes.json')

if (!existsSync(LINER_NOTES_PATH)) {
  console.error('❌ public/data/liner-notes.json not found. Run npm run generate:liner-notes first.')
  process.exit(1)
}

const data: LinerNotesData = JSON.parse(readFileSync(LINER_NOTES_PATH, 'utf8'))
const posts = data.posts ?? []

console.log(`📡 Regenerating liner-notes.xml from ${posts.length} posts...`)
generateRss(posts)
console.log(`✅ Written: public/liner-notes.xml`)
