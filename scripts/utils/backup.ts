import { existsSync, copyFileSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Backup utility for data pipeline
 * Creates timestamped backups and manages backup retention
 */

interface BackupOptions {
  maxBackups?: number // Default: 10
  verbose?: boolean   // Default: true
}

/**
 * Create a timestamped backup of a file
 * @param filePath - Path to file to backup
 * @param options - Backup options
 * @returns Path to created backup file, or null if file doesn't exist
 */
export function createBackup(
  filePath: string,
  options: BackupOptions = {}
): string | null {
  const { maxBackups = 10, verbose = true } = options

  // Check if source file exists
  if (!existsSync(filePath)) {
    if (verbose) {
      console.log(`ℹ️  No existing file to backup: ${filePath}`)
    }
    return null
  }

  // Generate timestamped backup filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = `${filePath}.backup.${timestamp}`

  try {
    // Create backup
    copyFileSync(filePath, backupPath)

    if (verbose) {
      console.log(`📦 Backup created: ${backupPath}`)
    }

    // Clean up old backups
    cleanupOldBackups(filePath, maxBackups, verbose)

    return backupPath
  } catch (error) {
    console.error(`❌ Failed to create backup: ${error}`)
    return null
  }
}

/**
 * Remove old backups, keeping only the most recent N
 * @param originalPath - Path to original file
 * @param maxBackups - Maximum number of backups to keep
 * @param verbose - Whether to log cleanup actions
 */
function cleanupOldBackups(
  originalPath: string,
  maxBackups: number,
  verbose: boolean
): void {
  try {
    const dir = dirname(originalPath)
    const filename = originalPath.split('/').pop()!
    const backupPattern = `${filename}.backup.`

    // Find all backup files
    const backups = readdirSync(dir)
      .filter(file => file.startsWith(backupPattern))
      .map(file => ({
        name: file,
        path: join(dir, file),
        mtime: statSync(join(dir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime) // Sort by modification time, newest first

    // Remove old backups beyond maxBackups
    const toRemove = backups.slice(maxBackups)

    if (toRemove.length > 0 && verbose) {
      console.log(`🧹 Cleaning up ${toRemove.length} old backup(s)`)
    }

    toRemove.forEach(backup => {
      try {
        unlinkSync(backup.path)
        if (verbose) {
          console.log(`   Removed: ${backup.name}`)
        }
      } catch (error) {
        console.error(`   Failed to remove ${backup.name}: ${error}`)
      }
    })
  } catch (error) {
    // Non-fatal: log but continue
    if (verbose) {
      console.warn(`⚠️  Failed to cleanup old backups: ${error}`)
    }
  }
}

/**
 * Create backups for multiple files
 * @param filePaths - Array of file paths to backup
 * @param options - Backup options
 * @returns Array of created backup paths (nulls for files that don't exist)
 */
export function createBackups(
  filePaths: string[],
  options: BackupOptions = {}
): (string | null)[] {
  const { verbose = true } = options

  if (verbose && filePaths.length > 0) {
    console.log('📦 Creating backups...')
  }

  const backups = filePaths.map(path => createBackup(path, { ...options, verbose: false }))

  if (verbose) {
    const created = backups.filter(b => b !== null).length
    if (created > 0) {
      console.log(`✅ Created ${created} backup(s)`)
      backups.forEach((backup, i) => {
        if (backup) {
          console.log(`   ${filePaths[i]} → ${backup.split('/').pop()}`)
        }
      })
    }
    console.log()
  }

  return backups
}

/**
 * List all backup files for a given file
 * @param filePath - Path to original file
 * @returns Array of backup file paths, sorted by newest first
 */
export function listBackups(filePath: string): string[] {
  try {
    const dir = dirname(filePath)
    const filename = filePath.split('/').pop()!
    const backupPattern = `${filename}.backup.`

    return readdirSync(dir)
      .filter(file => file.startsWith(backupPattern))
      .map(file => join(dir, file))
      .map(path => ({
        path,
        mtime: statSync(path).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime) // Newest first
      .map(item => item.path)
  } catch (error) {
    return []
  }
}
