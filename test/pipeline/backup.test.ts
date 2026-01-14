/**
 * Tests for scripts/utils/backup.ts
 *
 * Covers:
 * - Backup creation with timestamped filenames
 * - Auto-cleanup of old backups (keeps last N)
 * - Multiple file backup support
 * - Backup listing
 * - Error handling (missing files, permission errors)
 * - Verbose/quiet logging modes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createBackup, createBackups, listBackups } from '../../scripts/utils/backup'
import * as fs from 'fs'
import * as path from 'path'

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    copyFileSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn(),
  }
})

// Mock path module
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')
  return {
    ...actual,
    dirname: vi.fn((p: string) => {
      const parts = p.split('/')
      return parts.slice(0, -1).join('/')
    }),
    join: vi.fn((...args: string[]) => args.join('/')),
  }
})

describe('backup.ts', () => {
  let originalLog: typeof console.log
  let originalWarn: typeof console.warn
  let originalError: typeof console.error
  let mockDate: Date

  beforeEach(() => {
    // Save original console methods
    originalLog = console.log
    originalWarn = console.warn
    originalError = console.error

    // Mock console to keep test output clean
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()

    // Mock Date to get consistent timestamps
    mockDate = new Date('2024-01-15T10:30:45.000Z')
    vi.setSystemTime(mockDate)

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore console
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError

    // Restore time
    vi.useRealTimers()
  })

  describe('createBackup', () => {
    it('should create backup with timestamped filename', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      const backupPath = createBackup(filePath)

      expect(backupPath).toBe('/test/data/concerts.json.backup.2024-01-15T10-30-45')
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        filePath,
        '/test/data/concerts.json.backup.2024-01-15T10-30-45'
      )
    })

    it('should return null if source file does not exist', () => {
      const filePath = '/test/data/missing.json'
      ;(fs.existsSync as any).mockReturnValue(false)

      const backupPath = createBackup(filePath)

      expect(backupPath).toBeNull()
      expect(fs.copyFileSync).not.toHaveBeenCalled()
    })

    it('should log info message when file does not exist in verbose mode', () => {
      const filePath = '/test/data/missing.json'
      ;(fs.existsSync as any).mockReturnValue(false)

      createBackup(filePath, { verbose: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No existing file to backup')
      )
    })

    it('should not log when file does not exist in quiet mode', () => {
      const filePath = '/test/data/missing.json'
      ;(fs.existsSync as any).mockReturnValue(false)

      createBackup(filePath, { verbose: false })

      expect(console.log).not.toHaveBeenCalled()
    })

    it('should log success message in verbose mode', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      createBackup(filePath, { verbose: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Backup created')
      )
    })

    it('should not log in quiet mode', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      createBackup(filePath, { verbose: false })

      expect(console.log).not.toHaveBeenCalled()
    })

    it('should return null if backup creation fails', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const backupPath = createBackup(filePath)

      expect(backupPath).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create backup')
      )
    })

    it('should cleanup old backups when maxBackups is reached', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})

      // Mock existing backups (11 total, max 10)
      const existingBackups = Array.from({ length: 11 }, (_, i) => {
        const timestamp = new Date(2024, 0, i + 1).getTime()
        return {
          name: `concerts.json.backup.2024-01-${String(i + 1).padStart(2, '0')}T00-00-00`,
          timestamp,
        }
      })

      ;(fs.readdirSync as any).mockReturnValue(existingBackups.map(b => b.name))
      ;(fs.statSync as any).mockImplementation((path: string) => {
        const filename = path.split('/').pop()
        const backup = existingBackups.find(b => b.name === filename)
        return { mtime: new Date(backup?.timestamp || 0) }
      })
      ;(fs.unlinkSync as any).mockImplementation(() => {})

      createBackup(filePath, { maxBackups: 10, verbose: true })

      // Should remove the oldest backup
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('concerts.json.backup.2024-01-01')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up 1 old backup')
      )
    })

    it('should keep multiple old backups when maxBackups is exceeded', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})

      // Mock existing backups (12 total, max 3)
      const existingBackups = Array.from({ length: 12 }, (_, i) => {
        const timestamp = new Date(2024, 0, i + 1).getTime()
        return {
          name: `concerts.json.backup.2024-01-${String(i + 1).padStart(2, '0')}T00-00-00`,
          timestamp,
        }
      })

      ;(fs.readdirSync as any).mockReturnValue(existingBackups.map(b => b.name))
      ;(fs.statSync as any).mockImplementation((path: string) => {
        const filename = path.split('/').pop()
        const backup = existingBackups.find(b => b.name === filename)
        return { mtime: new Date(backup?.timestamp || 0) }
      })
      ;(fs.unlinkSync as any).mockImplementation(() => {})

      createBackup(filePath, { maxBackups: 3, verbose: false })

      // Should remove 9 old backups (keep only 3 newest)
      expect(fs.unlinkSync).toHaveBeenCalledTimes(9)
    })

    it('should not remove backups when under maxBackups limit', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})

      const existingBackups = ['concerts.json.backup.2024-01-01T00-00-00']
      ;(fs.readdirSync as any).mockReturnValue(existingBackups)
      ;(fs.statSync as any).mockReturnValue({ mtime: new Date() })
      ;(fs.unlinkSync as any).mockImplementation(() => {})

      createBackup(filePath, { maxBackups: 10, verbose: false })

      expect(fs.unlinkSync).not.toHaveBeenCalled()
    })

    it('should handle cleanup errors gracefully', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})

      const existingBackups = Array.from({ length: 11 }, (_, i) =>
        `concerts.json.backup.2024-01-${String(i + 1).padStart(2, '0')}T00-00-00`
      )
      ;(fs.readdirSync as any).mockReturnValue(existingBackups)
      ;(fs.statSync as any).mockReturnValue({ mtime: new Date() })
      ;(fs.unlinkSync as any).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      // Should not throw, just log error
      const backupPath = createBackup(filePath, { maxBackups: 10, verbose: true })

      expect(backupPath).toBeTruthy()
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove')
      )
    })
  })

  describe('createBackups', () => {
    it('should create backups for multiple files', () => {
      const filePaths = [
        '/test/data/concerts.json',
        '/test/data/artists.json',
        '/test/data/venues.json',
      ]

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      const backups = createBackups(filePaths)

      expect(backups).toHaveLength(3)
      expect(backups.every(b => b !== null)).toBe(true)
      expect(fs.copyFileSync).toHaveBeenCalledTimes(3)
    })

    it('should return null for missing files', () => {
      const filePaths = [
        '/test/data/exists.json',
        '/test/data/missing.json',
      ]

      ;(fs.existsSync as any).mockImplementation((path: string) =>
        !path.includes('missing')
      )
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      const backups = createBackups(filePaths)

      expect(backups).toHaveLength(2)
      expect(backups[0]).toBeTruthy()
      expect(backups[1]).toBeNull()
    })

    it('should log summary in verbose mode', () => {
      const filePaths = ['/test/data/concerts.json']

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      createBackups(filePaths, { verbose: true })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Creating backups')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Created 1 backup')
      )
    })

    it('should not log in quiet mode', () => {
      const filePaths = ['/test/data/concerts.json']

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      createBackups(filePaths, { verbose: false })

      expect(console.log).not.toHaveBeenCalled()
    })

    it('should handle empty file list', () => {
      const backups = createBackups([], { verbose: false })

      expect(backups).toHaveLength(0)
      expect(console.log).not.toHaveBeenCalled()
    })
  })

  describe('listBackups', () => {
    it('should list all backup files sorted by newest first', () => {
      const filePath = '/test/data/concerts.json'

      const backups = [
        { name: 'concerts.json.backup.2024-01-10T00-00-00', time: new Date('2024-01-10').getTime() },
        { name: 'concerts.json.backup.2024-01-15T00-00-00', time: new Date('2024-01-15').getTime() },
        { name: 'concerts.json.backup.2024-01-05T00-00-00', time: new Date('2024-01-05').getTime() },
      ]

      ;(fs.readdirSync as any).mockReturnValue(backups.map(b => b.name))
      ;(fs.statSync as any).mockImplementation((path: string) => {
        const filename = path.split('/').pop()
        const backup = backups.find(b => b.name === filename)
        return { mtime: new Date(backup?.time || 0) }
      })

      const result = listBackups(filePath)

      expect(result).toHaveLength(3)
      expect(result[0]).toContain('2024-01-15')
      expect(result[1]).toContain('2024-01-10')
      expect(result[2]).toContain('2024-01-05')
    })

    it('should only list files matching the backup pattern', () => {
      const filePath = '/test/data/concerts.json'

      const files = [
        'concerts.json.backup.2024-01-15T00-00-00',
        'artists.json.backup.2024-01-15T00-00-00', // Different file
        'concerts.json', // Not a backup
        'concerts.json.temp', // Not a backup
      ]

      ;(fs.readdirSync as any).mockReturnValue(files)
      ;(fs.statSync as any).mockReturnValue({ mtime: new Date() })

      const result = listBackups(filePath)

      expect(result).toHaveLength(1)
      expect(result[0]).toContain('concerts.json.backup.2024-01-15')
    })

    it('should return empty array if directory read fails', () => {
      const filePath = '/test/data/concerts.json'

      ;(fs.readdirSync as any).mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const result = listBackups(filePath)

      expect(result).toEqual([])
    })

    it('should return empty array if no backups exist', () => {
      const filePath = '/test/data/concerts.json'

      ;(fs.readdirSync as any).mockReturnValue([])

      const result = listBackups(filePath)

      expect(result).toEqual([])
    })
  })

  describe('Timestamp Format', () => {
    it('should format timestamp correctly (YYYY-MM-DDTHH-MM-SS)', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      const backupPath = createBackup(filePath, { verbose: false })

      // Timestamp should be: 2024-01-15T10-30-45
      expect(backupPath).toMatch(/\.backup\.2024-01-15T10-30-45$/)
    })

    it('should create unique timestamps for rapid backups', () => {
      const filePath = '/test/data/concerts.json'
      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.copyFileSync as any).mockImplementation(() => {})
      ;(fs.readdirSync as any).mockReturnValue([])

      const backup1 = createBackup(filePath, { verbose: false })

      // Advance time by 1 second
      vi.setSystemTime(new Date('2024-01-15T10:30:46.000Z'))

      const backup2 = createBackup(filePath, { verbose: false })

      expect(backup1).not.toBe(backup2)
      expect(backup1).toContain('10-30-45')
      expect(backup2).toContain('10-30-46')
    })
  })
})
