/**
 * Caching Layer
 *
 * Manages caching of API responses to reduce API calls and improve performance.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import type { CacheEntry, CacheMetadata } from './types.js'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.seo-analyzer', 'cache')

// TTL defaults (in days)
// Rationale:
// - crawl: Pages change frequently during development
// - gsc: Data is 2-3 days delayed, balance freshness vs API calls
// - ga4: Near real-time data, stale quickly
// - backlinks: Changes slowly, API costs money
// - baseline: Historical comparison data
const DEFAULT_TTL = {
  crawl: 1, // 1 day
  gsc: 3, // 3 days (data is 2-3 days delayed anyway)
  ga4: 1, // 1 day (near real-time data)
  backlinks: 14, // 14 days (changes slowly)
  baseline: 90, // 90 days for historical comparison
}

// ============================================================================
// Cache Directory Management
// ============================================================================

/**
 * Get the cache directory for a specific domain
 */
function getCacheDir(domain: string, cacheDir: string = DEFAULT_CACHE_DIR): string {
  // Normalize domain for filesystem
  const normalizedDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/[:/]/g, '_')
    .replace(/\/$/, '')

  return path.join(cacheDir, normalizedDomain)
}

/**
 * Get the cache file path for a specific data type
 */
function getCacheFilePath(
  domain: string,
  type: CacheMetadata['type'],
  date: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): string {
  const domainDir = getCacheDir(domain, cacheDir)
  const typeDir = path.join(domainDir, type)
  return path.join(typeDir, `${date}.json`)
}

/**
 * Ensure cache directories exist
 */
function ensureCacheDir(domain: string, type: CacheMetadata['type'], cacheDir: string = DEFAULT_CACHE_DIR): void {
  const typeDir = path.join(getCacheDir(domain, cacheDir), type)
  if (!fs.existsSync(typeDir)) {
    fs.mkdirSync(typeDir, { recursive: true })
  }
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Write data to cache
 */
export function writeCache<T>(
  domain: string,
  type: CacheMetadata['type'],
  data: T,
  ttlDays?: number,
  cacheDir: string = DEFAULT_CACHE_DIR
): void {
  const date = new Date().toISOString().split('T')[0]
  const ttl = ttlDays ?? DEFAULT_TTL[type]

  ensureCacheDir(domain, type, cacheDir)

  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
  }

  const filepath = getCacheFilePath(domain, type, date, cacheDir)
  fs.writeFileSync(filepath, JSON.stringify(entry, null, 2), 'utf-8')
}

/**
 * Read data from cache
 */
export function readCache<T>(
  domain: string,
  type: CacheMetadata['type'],
  maxAgeDays?: number,
  cacheDir: string = DEFAULT_CACHE_DIR
): T | null {
  const ttl = maxAgeDays ?? DEFAULT_TTL[type]
  const domainDir = getCacheDir(domain, cacheDir)
  const typeDir = path.join(domainDir, type)

  if (!fs.existsSync(typeDir)) {
    return null
  }

  // Find the most recent cache file
  const files = fs.readdirSync(typeDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()

  if (files.length === 0) {
    return null
  }

  const filepath = path.join(typeDir, files[0])

  try {
    const content = fs.readFileSync(filepath, 'utf-8')
    const entry = JSON.parse(content) as CacheEntry<T>

    // Check if cache is still valid
    const ageMs = Date.now() - entry.timestamp
    const maxAgeMs = ttl * 24 * 60 * 60 * 1000

    if (ageMs > maxAgeMs) {
      return null // Cache expired
    }

    return entry.data
  } catch (error) {
    console.warn(`Failed to read cache file ${filepath}:`, error)
    return null
  }
}

/**
 * Check if valid cache exists
 */
export function hasValidCache(
  domain: string,
  type: CacheMetadata['type'],
  maxAgeDays?: number,
  cacheDir: string = DEFAULT_CACHE_DIR
): boolean {
  return readCache(domain, type, maxAgeDays, cacheDir) !== null
}

/**
 * Get cache age in days
 */
export function getCacheAge(
  domain: string,
  type: CacheMetadata['type'],
  cacheDir: string = DEFAULT_CACHE_DIR
): number | null {
  const domainDir = getCacheDir(domain, cacheDir)
  const typeDir = path.join(domainDir, type)

  if (!fs.existsSync(typeDir)) {
    return null
  }

  const files = fs.readdirSync(typeDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()

  if (files.length === 0) {
    return null
  }

  const filepath = path.join(typeDir, files[0])

  try {
    const content = fs.readFileSync(filepath, 'utf-8')
    const entry = JSON.parse(content) as CacheEntry<unknown>

    const ageMs = Date.now() - entry.timestamp
    return ageMs / (24 * 60 * 60 * 1000)
  } catch {
    return null
  }
}

// ============================================================================
// Cache Clearing
// ============================================================================

/**
 * Clear all cache for a domain
 */
export function clearDomainCache(domain: string, cacheDir: string = DEFAULT_CACHE_DIR): void {
  const domainDir = getCacheDir(domain, cacheDir)

  if (fs.existsSync(domainDir)) {
    fs.rmSync(domainDir, { recursive: true })
    console.log(`✅ Cleared cache for ${domain}`)
  }
}

/**
 * Clear specific cache type for a domain
 */
export function clearTypeCache(
  domain: string,
  type: CacheMetadata['type'],
  cacheDir: string = DEFAULT_CACHE_DIR
): void {
  const typeDir = path.join(getCacheDir(domain, cacheDir), type)

  if (fs.existsSync(typeDir)) {
    fs.rmSync(typeDir, { recursive: true })
    console.log(`✅ Cleared ${type} cache for ${domain}`)
  }
}

/**
 * Clear all cache
 */
export function clearAllCache(cacheDir: string = DEFAULT_CACHE_DIR): void {
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true })
    console.log('✅ Cleared all SEO cache')
  }
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredCache(cacheDir: string = DEFAULT_CACHE_DIR): number {
  if (!fs.existsSync(cacheDir)) {
    return 0
  }

  let cleaned = 0
  const now = Date.now()

  // Walk through all domain directories
  const domains = fs.readdirSync(cacheDir)

  for (const domain of domains) {
    const domainPath = path.join(cacheDir, domain)
    if (!fs.statSync(domainPath).isDirectory()) continue

    // Walk through cache type directories
    const types = fs.readdirSync(domainPath)

    for (const type of types) {
      const typePath = path.join(domainPath, type)
      if (!fs.statSync(typePath).isDirectory()) continue

      // Check each cache file
      const files = fs.readdirSync(typePath)

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const filepath = path.join(typePath, file)

        try {
          const content = fs.readFileSync(filepath, 'utf-8')
          const entry = JSON.parse(content) as CacheEntry<unknown>

          const ageMs = now - entry.timestamp
          const maxAgeMs = entry.ttl * 24 * 60 * 60 * 1000

          if (ageMs > maxAgeMs) {
            fs.unlinkSync(filepath)
            cleaned++
          }
        } catch {
          // If we can't read it, delete it
          fs.unlinkSync(filepath)
          cleaned++
        }
      }
    }
  }

  return cleaned
}

// ============================================================================
// Cache Info
// ============================================================================

/**
 * Get cache statistics
 */
export function getCacheStats(cacheDir: string = DEFAULT_CACHE_DIR): {
  totalFiles: number
  totalSize: number
  domains: string[]
} {
  if (!fs.existsSync(cacheDir)) {
    return { totalFiles: 0, totalSize: 0, domains: [] }
  }

  let totalFiles = 0
  let totalSize = 0
  const domains: string[] = []

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir)

    for (const entry of entries) {
      const fullPath = path.join(dir, entry)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        walkDir(fullPath)
      } else if (entry.endsWith('.json')) {
        totalFiles++
        totalSize += stat.size
      }
    }
  }

  const domainDirs = fs.readdirSync(cacheDir)
  for (const domain of domainDirs) {
    const domainPath = path.join(cacheDir, domain)
    if (fs.statSync(domainPath).isDirectory()) {
      domains.push(domain)
      walkDir(domainPath)
    }
  }

  return { totalFiles, totalSize, domains }
}

/**
 * Print cache summary to console
 */
export function printCacheSummary(cacheDir: string = DEFAULT_CACHE_DIR): void {
  const stats = getCacheStats(cacheDir)

  console.log('')
  console.log('📦 CACHE STATUS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Total files:  ${stats.totalFiles}`)
  console.log(`Total size:   ${(stats.totalSize / 1024).toFixed(1)} KB`)
  console.log(`Domains:      ${stats.domains.length}`)

  if (stats.domains.length > 0) {
    console.log('')
    console.log('Cached domains:')
    stats.domains.forEach(d => console.log(`  • ${d}`))
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
}
