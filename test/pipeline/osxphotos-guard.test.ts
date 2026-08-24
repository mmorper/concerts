/**
 * The read-only osxphotos guard (#348).
 *
 * The Photos library is the owner's irreplaceable source of record, and this guard is the
 * mechanism that keeps this project from ever writing to it. Until now that mechanism was
 * a shell script on one machine that nothing verified. These tests put it under CI.
 *
 * They run anywhere, including on a Linux runner with no osxphotos binary, because every
 * REFUSAL happens before the binary is needed. That ordering is itself part of the design
 * and is asserted below.
 *
 * The guard sits in the otherwise-gitignored concert-photos-audit/ by a named exception in
 * two .gitignore files. It cannot be moved somewhere tidier: macOS grants Full Disk Access
 * against the WRAPPER's path, so relocating it makes every library read hang silently.
 *
 * Exit codes: 64 = refused by the guard, 69 = allowed through but no binary present.
 * A permitted subcommand returning 69 is the proof that it was NOT refused.
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import { resolve } from 'path'

const GUARD = resolve('concert-photos-audit/bin/osxphotos')
const REFUSED = 64
const NO_BINARY = 69

/** No shell involved: argv is passed as an array, exactly as a caller would. */
function runGuard(args: string[]) {
  return spawnSync(GUARD, args, {
    encoding: 'utf-8',
    // Point at nothing, so a permitted call cannot reach a real library even on a Mac
    // that has one. These tests must never touch the owner's Photos library.
    env: { ...process.env, OSXPHOTOS_RAW: '/nonexistent/osxphotos-raw' },
  })
}

describe('subcommands that can write are refused', () => {
  // Every osxphotos subcommand capable of modifying a library.
  const WRITERS = ['import', 'timewarp', 'add-locations', 'batch-edit', 'push-exif', 'sync', 'orphans', 'repair']

  it.each(WRITERS)('refuses `osxphotos %s`', (sub) => {
    const r = runGuard([sub])
    expect(r.status).toBe(REFUSED)
    expect(r.stderr).toContain('REFUSED')
  })

  it('refuses an unrecognised subcommand rather than passing it through', () => {
    // Default-deny: a subcommand added by a future osxphotos release is refused until
    // somebody reads what it does and adds it deliberately.
    expect(runGuard(['some-new-command']).status).toBe(REFUSED)
  })
})

describe('mutating options on the read-only subcommands are refused', () => {
  // Allowlisting subcommands alone was NOT enough — this is the hole that closed.
  // `query --add-to-album` creates an album in Photos, through the one subcommand this
  // project uses most.
  const MUTATORS = [
    ['query', '--add-to-album', 'Some Album'],
    ['query', '--add-to-album=Some Album'],
    ['export', '/tmp/out', '--post-command', 'exported', 'rm -rf /'],
    ['export', '/tmp/out', '--post-command=exported'],
    ['export', '/tmp/out', '--post-function', 'mod.py::fn'],
    ['export', '/tmp/out', '--post-function=mod.py::fn'],
  ]

  it.each(MUTATORS)('refuses %s %s %s', (...args) => {
    const r = runGuard(args as string[])
    expect(r.status).toBe(REFUSED)
    expect(r.stderr).toContain('REFUSED')
  })

  it('refuses the flag wherever it appears in the argument list', () => {
    const r = runGuard(['query', '--from-date', '2024-08-20', '--quiet', '--add-to-album', 'X'])
    expect(r.status).toBe(REFUSED)
  })

  it('names the offending flag, so the message is actionable', () => {
    expect(runGuard(['query', '--add-to-album', 'X']).stderr).toContain('--add-to-album')
  })
})

describe('read-only subcommands are allowed through', () => {
  // 69, not 64: the guard permitted these and only the missing binary stopped them. A
  // guard that refused everything would pass the tests above and be useless.
  it.each(['query', 'export', 'info'])('allows `osxphotos %s`', (sub) => {
    const r = runGuard([sub])
    expect(r.status).toBe(NO_BINARY)
    expect(r.stderr).not.toContain('REFUSED')
  })

  it('allows a realistic media:prep invocation', () => {
    const r = runGuard(['query', '--from-date', '2024-08-20T17:00:00', '--to-date', '2024-08-21T04:00:00', '--quiet'])
    expect(r.status).toBe(NO_BINARY)
  })
})

describe('refusal happens before the binary is needed', () => {
  it('refuses a writing subcommand even with no binary present at all', () => {
    // This is why the guard is testable on a CI runner, and why a broken install can
    // never be the reason a mutation slips through.
    const r = runGuard(['import', '/tmp/photo.jpg'])
    expect(r.status).toBe(REFUSED)
    expect(r.stderr).not.toContain('not found')
  })

  it('explains how to build the binary when a permitted call cannot find it', () => {
    const r = runGuard(['query'])
    expect(r.stderr).toContain('BUILD.txt')
    // The pipx warning matters: under pipx, Full Disk Access is granted to the terminal
    // and everything it launches, rather than to the binary alone.
    expect(r.stderr).toContain('pipx')
  })
})
