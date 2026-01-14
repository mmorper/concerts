/**
 * Tests for scripts/diff-concerts.ts
 *
 * Covers:
 * - File existence validation
 * - Backup file comparison
 * - Added concerts detection
 * - Removed concerts detection
 * - Modified concerts detection (field-level changes)
 * - Summary statistics
 * - Missing backup file handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { diffConcerts } from '../../scripts/diff-concerts'
import * as fs from 'fs'

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  }
})

describe('diff-concerts.ts', () => {
  let originalLog: typeof console.log
  let originalWarn: typeof console.warn
  let originalError: typeof console.error
  let originalExit: typeof process.exit

  beforeEach(() => {
    // Save originals
    originalLog = console.log
    originalWarn = console.warn
    originalError = console.error
    originalExit = process.exit

    // Mock console to keep test output clean
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()

    // Mock process.exit to throw so execution stops
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit: ${code}`)
    }) as any

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
    process.exit = originalExit
  })

  describe('File Existence', () => {
    it('should exit if concerts.json does not exist', async () => {
      ;(fs.existsSync as any).mockReturnValue(false)
      ;(fs.readFileSync as any).mockReturnValue('{}')

      try {
        await diffConcerts()
      } catch (e: any) {
        // Expect process.exit to throw
        expect(e.message).toContain('process.exit: 1')
      }

      expect(process.exit).toHaveBeenCalledWith(1)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('concerts.json not found')
      )
    })

    it('should show summary when backup file does not exist', async () => {
      const currentData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {
          totalConcerts: 1,
          uniqueArtists: 1,
          uniqueVenues: 1,
          dateRange: { earliest: '2024-01-15', latest: '2024-01-15' },
        },
      }

      ;(fs.existsSync as any).mockImplementation((path: string) => {
        if (path.includes('concerts.json.backup')) return false
        return true
      })
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(currentData))

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No backup file found')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Current data summary')
      )
    })
  })

  describe('Added Concerts', () => {
    it('should detect newly added concerts', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [
          ...oldData.concerts,
          {
            id: 'concert-2',
            date: '2024-02-20',
            headliner: 'Artist 2',
            venue: 'Venue 2',
            city: 'City 2',
            state: 'State 2',
            openers: [],
            genre: 'Pop',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/ADDED.*1 concert/)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Artist 2')
      )
    })

    it('should show openers for added concerts', async () => {
      const oldData = {
        concerts: [],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Headliner 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: ['Opener 1', 'Opener 2', 'Opener 3'],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('w/')
      )
    })

    it('should sort added concerts by date', async () => {
      const oldData = {
        concerts: [],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-03-10',
            headliner: 'Artist C',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
          {
            id: 'concert-2',
            date: '2024-01-15',
            headliner: 'Artist A',
            venue: 'Venue 2',
            city: 'City 2',
            state: 'State 2',
            openers: [],
            genre: 'Pop',
          },
          {
            id: 'concert-3',
            date: '2024-02-20',
            headliner: 'Artist B',
            venue: 'Venue 3',
            city: 'City 3',
            state: 'State 3',
            openers: [],
            genre: 'Jazz',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      const calls = (console.log as any).mock.calls.map((call: any[]) => call[0])
      const addedConcerts = calls.filter((msg: any) =>
        typeof msg === 'string' && msg.includes('Artist')
      )

      // Should be ordered: Artist A (Jan), Artist B (Feb), Artist C (Mar)
      const artistA = addedConcerts.findIndex((msg: string) => msg.includes('Artist A'))
      const artistB = addedConcerts.findIndex((msg: string) => msg.includes('Artist B'))
      const artistC = addedConcerts.findIndex((msg: string) => msg.includes('Artist C'))

      expect(artistA).toBeLessThan(artistB)
      expect(artistB).toBeLessThan(artistC)
    })
  })

  describe('Removed Concerts', () => {
    it('should detect removed concerts', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
          {
            id: 'concert-2',
            date: '2024-02-20',
            headliner: 'Artist 2',
            venue: 'Venue 2',
            city: 'City 2',
            state: 'State 2',
            openers: [],
            genre: 'Pop',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [oldData.concerts[0]],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/REMOVED.*1 concert/)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Artist 2')
      )
    })

    it('should sort removed concerts by date', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-03-10',
            headliner: 'Artist C',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
          {
            id: 'concert-2',
            date: '2024-01-15',
            headliner: 'Artist A',
            venue: 'Venue 2',
            city: 'City 2',
            state: 'State 2',
            openers: [],
            genre: 'Pop',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      const calls = (console.log as any).mock.calls.map((call: any[]) => call[0])
      const removedConcerts = calls.filter((msg: any) =>
        typeof msg === 'string' && msg.includes('Artist')
      )

      const artistA = removedConcerts.findIndex((msg: string) => msg.includes('Artist A'))
      const artistC = removedConcerts.findIndex((msg: string) => msg.includes('Artist C'))

      expect(artistA).toBeLessThan(artistC)
    })
  })

  describe('Modified Concerts', () => {
    it('should detect venue changes', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Old Venue',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            ...oldData.concerts[0],
            venue: 'New Venue',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/MODIFIED.*1 concert/)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/venue.*Old Venue.*New Venue/)
      )
    })

    it('should detect location changes (city/state)', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'Old City',
            state: 'Old State',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            ...oldData.concerts[0],
            city: 'New City',
            state: 'New State',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/location.*Old City.*New City/)
      )
    })

    it('should detect genre changes', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            ...oldData.concerts[0],
            genre: 'Alternative Rock',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/genre.*Rock.*Alternative Rock/)
      )
    })

    it('should detect opener changes', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: ['Opener 1'],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            ...oldData.concerts[0],
            openers: ['Opener 1', 'Opener 2', 'Opener 3'],
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/openers.*1.*3/)
      )
    })

    it('should detect multiple changes in same concert', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Old Venue',
            city: 'Old City',
            state: 'Old State',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            ...oldData.concerts[0],
            venue: 'New Venue',
            genre: 'Alternative Rock',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/venue/)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/genre/)
      )
    })

    it('should not detect changes when concerts are identical', async () => {
      const sameData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: ['Opener 1'],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockReturnValue(JSON.stringify(sameData))

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No changes detected')
      )
    })
  })

  describe('Summary Statistics', () => {
    it('should show correct summary with all types of changes', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
          {
            id: 'concert-2',
            date: '2024-02-20',
            headliner: 'Artist 2',
            venue: 'Venue 2',
            city: 'City 2',
            state: 'State 2',
            openers: [],
            genre: 'Pop',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            ...oldData.concerts[0],
            venue: 'Modified Venue', // Modified
          },
          {
            id: 'concert-3',
            date: '2024-03-10',
            headliner: 'Artist 3',
            venue: 'Venue 3',
            city: 'City 3',
            state: 'State 3',
            openers: [],
            genre: 'Jazz',
          }, // Added
          // concert-2 removed
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Total changes.*\+1.*-1.*~1/)
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Old total: 2 concerts')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('New total: 2 concerts')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Net change: (\+)?0/)
      )
    })

    it('should show positive net change', async () => {
      const oldData = {
        concerts: [],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Net change: +1')
      )
    })

    it('should show negative net change', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Artist 1',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Net change: -1/)
      )
    })
  })

  describe('Case Insensitivity', () => {
    it('should match concerts case-insensitively by headliner', async () => {
      const oldData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'Depeche Mode',
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      const newData = {
        concerts: [
          {
            id: 'concert-1',
            date: '2024-01-15',
            headliner: 'DEPECHE MODE', // Different case
            venue: 'Venue 1',
            city: 'City 1',
            state: 'State 1',
            openers: [],
            genre: 'Rock',
          },
        ],
        metadata: {},
      }

      ;(fs.existsSync as any).mockReturnValue(true)
      ;(fs.readFileSync as any).mockImplementation((path: string) => {
        if (path.includes('.backup')) {
          return JSON.stringify(oldData)
        }
        return JSON.stringify(newData)
      })

      await diffConcerts()

      // Should not show as added or removed
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No changes detected')
      )
    })
  })
})
