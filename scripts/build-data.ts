import { fetchGoogleSheet } from './fetch-google-sheet'
import { geocodeVenues } from './geocode-venues'
import { enrichConcertGenres } from './enrich-concert-genres'
import { enrichArtists } from './enrich-artists'
import { validateConcerts } from './validate-concerts'
import { spawn } from 'child_process'

/**
 * Run a child step with its output streamed to this process's stdout.
 *
 * `promisify(exec)` buffers stdout and hands it back on resolve — and this
 * orchestrator never printed it, so every subprocess step was silent in CI. The
 * venue step in particular ran for 63 seconds in run 32007717580 and emitted
 * not one line, which is why #315 went twelve days without anyone being able to
 * see that the Places photo names had gone stale.
 *
 * Buffering also caps output at `maxBuffer`; a chatty step that exceeded it
 * would fail the pipeline with ENOBUFS rather than the real error. Streaming
 * has neither problem.
 */
function run(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))
    )
  })
}

/**
 * Main data pipeline orchestrator
 * Runs all data fetching and enrichment steps in sequence
 *
 * Usage:
 *   npm run build-data                    # Full refresh (all sources)
 *   npm run build-data -- --dry-run       # Preview without writing files
 *   npm run build-data -- --skip-venues   # Skip venue enrichment
 *   npm run build-data -- --skip-spotify  # Skip Spotify enrichment
 *   npm run build-data -- --skip-tracks   # Skip top tracks enrichment
 *   npm run build-data -- --skip-setlists # Skip setlist pre-fetch
 *   npm run build-data -- --force-refresh-setlists # Re-fetch all setlists
 *
 * Available Flags:
 *   --dry-run                 Preview changes without writing files
 *   --skip-validation         Skip data validation step
 *   --skip-venues             Skip venue metadata enrichment (Google Places)
 *   --skip-spotify            Skip Spotify metadata enrichment
 *   --skip-discography        Skip discography enrichment (MusicBrainz)
 *   --skip-album-eras         Skip album-era derivation (local, no API calls)
 *   --skip-song-albums        Skip song→album resolution (MusicBrainz + iTunes, cached)
 *   --skip-tracks             Skip top tracks enrichment (iTunes/Deezer)
 *   --skip-setlists           Skip setlist pre-fetch (setlist.fm)
 *   --force-refresh-setlists  Re-fetch all setlists (ignore cache)
 */
async function buildData() {
  // Parse command-line flags
  const skipValidation = process.env.SKIP_VALIDATION === 'true' || process.argv.includes('--skip-validation')
  const dryRun = process.argv.includes('--dry-run')
  const skipVenues = process.argv.includes('--skip-venues')
  const skipSpotify = process.argv.includes('--skip-spotify')
  const skipDiscography = process.argv.includes('--skip-discography')
  const skipAlbumEras = process.argv.includes('--skip-album-eras')
  const skipHandles = process.argv.includes('--skip-handles')
  const skipSongAlbums = process.argv.includes('--skip-song-albums')
  const skipTracks = process.argv.includes('--skip-tracks')
  const skipSetlists = process.argv.includes('--skip-setlists')
  const forceRefreshSetlists = process.argv.includes('--force-refresh-setlists')

  // Count active steps for progress tracking
  const steps = [
    { name: 'Fetch Google Sheets', active: true },
    { name: 'Geocode venues', active: true },
    { name: 'Enrich concert genres', active: true },
    { name: 'Validate concerts', active: !skipValidation },
    { name: 'Enrich artist metadata', active: true },
    { name: 'Enrich top tracks', active: !skipTracks },
    { name: 'Enrich venue metadata', active: !skipVenues },
    { name: 'Enrich Spotify data', active: !skipSpotify },
    { name: 'Enrich discography', active: !skipDiscography },
    { name: 'Derive album eras', active: !skipAlbumEras },
    { name: 'Pre-fetch setlists', active: !skipSetlists },
    { name: 'Resolve songs to albums', active: !skipSongAlbums },
    { name: 'Aggregate genres timeline', active: true },
    { name: 'Aggregate most-played songs', active: true },
    { name: 'Generate facts for liner notes', active: true },
    { name: 'Harvest social handles for new entities', active: !dryRun && !skipHandles },
    { name: 'Update meta tags and SEO files', active: !dryRun },
    { name: 'Generate sitemap', active: !dryRun },
    { name: 'Generate RSS feed', active: !dryRun },
  ]
  const activeSteps = steps.filter(s => s.active).length

  console.log(`🎸 Starting Concert Data Pipeline...${dryRun ? ' (DRY RUN)' : ''}\n`)
  console.log('=' .repeat(60))
  console.log()

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - Fetching data but NOT writing files')
    console.log('=' .repeat(60))
    console.log()
  }

  // Show what will run
  console.log('📋 Pipeline Steps:')
  steps.forEach((step, _i) => {
    const icon = step.active ? '✓' : '⏭️'
    const status = step.active ? '' : ' (skipped)'
    console.log(`   ${icon} ${step.name}${status}`)
  })
  console.log()

  let currentStep = 0

  try {
    // Step 1: Fetch from Google Sheets (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Fetching data from Google Sheets`)
    console.log('-'.repeat(60))
    await fetchGoogleSheet({ dryRun })
    console.log()

    // Step 2: Geocode any new venues (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Geocoding venues`)
    console.log('-'.repeat(60))
    await geocodeVenues()
    console.log()

    // Step 3: Enrich concert genres from artist metadata (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Enriching concert genres`)
    console.log('-'.repeat(60))
    await enrichConcertGenres({ dryRun })
    console.log()

    // Step 3: Validate data (optional)
    if (!skipValidation) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Validating concert data`)
      console.log('-'.repeat(60))
      try {
        await validateConcerts()
      } catch (error) {
        console.warn('\n⚠️  Validation found issues. Continuing with enrichment...')
        console.warn('   Run "npm run validate-data" for details')
      }
      console.log()
    } else {
      console.log('⏭️  Skipping validation (--skip-validation flag set)\n')
    }

    // Step 4: Enrich with artist metadata (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Enriching artist metadata`)
    console.log('-'.repeat(60))
    await enrichArtists({ dryRun })
    console.log()

    // Step 5: Enrich top tracks (optional)
    if (!skipTracks) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Enriching artist top tracks`)
      console.log('-'.repeat(60))

      const { enrichTopTracks } = await import('./enrich-top-tracks.ts')
      await enrichTopTracks()
      console.log()
    } else {
      console.log('⏭️  Skipping top tracks enrichment (--skip-tracks flag set)\n')
    }

    // Step 6: Enrich venue metadata (optional)
    if (!skipVenues) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Enriching venue metadata`)
      console.log('-'.repeat(60))

      // Run as subprocess since enrich-venues.ts is a standalone script
      await run('npm run enrich-venues')
      console.log()
    } else {
      console.log('⏭️  Skipping venue enrichment (--skip-venues flag set)\n')
    }

    // Step 6: Enrich Spotify data (optional)
    if (!skipSpotify) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Enriching Spotify metadata`)
      console.log('-'.repeat(60))

      // Check for Spotify credentials before running
      if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        console.warn('⚠️  Warning: Spotify credentials not configured in .env')
        console.warn('   Skipping Spotify enrichment')
        console.warn('   See docs/api-setup.md for setup instructions\n')
      } else {
        const { enrichSpotifyMetadata } = await import('./enrich-spotify-metadata.ts')
        await enrichSpotifyMetadata()
        console.log()
      }
    } else {
      console.log('⏭️  Skipping Spotify enrichment (--skip-spotify flag set)\n')
    }

    // Step 7: Enrich discography (optional)
    if (!skipDiscography) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Enriching discography`)
      console.log('-'.repeat(60))

      const { enrichDiscography } = await import('./enrich-discography.ts')
      await enrichDiscography()
      console.log()
    } else {
      console.log('⏭️  Skipping discography enrichment (--skip-discography flag set)\n')
    }

    // Step 7.5: Derive album eras — the discography x attendance join.
    //
    // Purely local: reads discography.json, concerts.json and
    // artists-top-tracks.json, makes no API calls, and is safe to re-run. Must
    // follow discography enrichment, and must precede liner-notes generation
    // (three detectors read album-eras.json).
    if (!skipAlbumEras) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Deriving album eras`)
      console.log('-'.repeat(60))

      const { deriveAlbumErasFile } = await import('./derive-album-eras.ts')
      await deriveAlbumErasFile()
      console.log()
    } else {
      console.log('⏭️  Skipping album-era derivation (--skip-album-eras flag set)\n')
    }

    // Step 8: Pre-fetch setlists (optional)
    if (!skipSetlists) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Pre-fetching setlists`)
      console.log('-'.repeat(60))

      // Check for setlist.fm API key before running
      if (!process.env.VITE_SETLISTFM_API_KEY) {
        console.warn('⚠️  Warning: setlist.fm API key not configured in .env')
        console.warn('   Skipping setlist pre-fetch')
        console.warn('   See docs/api-setup.md for setup instructions\n')
      } else {
        const { default: prefetchSetlists } = await import('./prefetch-setlists.ts')
        await prefetchSetlists({ forceRefresh: forceRefreshSetlists })
        console.log()
      }
    } else {
      console.log('⏭️  Skipping setlist pre-fetch (--skip-setlists flag set)\n')
    }

    // Step 8.5: Resolve setlist songs to studio albums.
    //
    // Placed AFTER setlists, not after derive-album-eras as the spec's §Part 4
    // says. The spec put it at "Step 9.6, immediately after derive-album-eras"
    // — but this reads setlists-cache.json, which Step 8 is what produces. Run
    // it earlier and a fresh clone attributes an empty setlist corpus and
    // reports 0% without failing.
    //
    // Reads album-eras.json, setlists-cache.json, discography.json and
    // artists-top-tracks.json. Network calls only for release-groups and songs
    // not already in data/cache/ — a warm re-run makes none at all.
    if (!skipSongAlbums) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Resolving songs to albums`)
      console.log('-'.repeat(60))

      const { resolveSongAlbums } = await import('./resolve-song-albums.ts')
      await resolveSongAlbums({ dryRun })
      console.log()
    } else {
      console.log('⏭️  Skipping song→album resolution (--skip-song-albums flag set)\n')
    }

    // Step 9: Aggregate genres timeline (always runs)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Aggregating genres timeline`)
    console.log('-'.repeat(60))
    const { aggregateGenresTimeline } = await import('./aggregate-genres-timeline.ts')
    await aggregateGenresTimeline()
    console.log()

    // Step 9b: Aggregate most-played songs from setlists (always runs — reads the cache,
    // independent of whether the setlist pre-fetch step ran this pass)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Aggregating most-played songs`)
    console.log('-'.repeat(60))
    const { writeMostPlayedSongs } = await import('./aggregate-most-played-songs.ts')
    await writeMostPlayedSongs()
    console.log()

    // Step 10: Generate facts for liner notes (always runs — legacy, deprecated by agentic system)
    // Note: liner notes generation runs via its own dedicated scheduled task (liner-notes-generate)
    currentStep++
    console.log('=' .repeat(60))
    console.log(`Step ${currentStep}/${activeSteps}: Generating facts for liner notes`)
    console.log('-'.repeat(60))
    const { writeFacts } = await import('./generate-facts.ts')
    await writeFacts()
    console.log()

    // Step 10b: Publish the artist alias map (always runs — cheap, and keeps
    // public/data in step with the hand-maintained source, #227)
    if (!dryRun) {
      const { syncArtistAliases } = await import('./sync-artist-aliases.ts')
      syncArtistAliases()
    }

    // Social handles for whatever the archive just gained.
    //
    // Runs here because it needs artists-metadata and venues-metadata to have
    // been written above — the harvest reads names, websites and geocodes off
    // them. `--new-only` means a refresh that added two concerts costs seconds
    // rather than the twenty minutes a full crawl takes at MusicBrainz's one
    // request per second, which is the difference between a step that runs and
    // a step everyone learns to skip.
    //
    // NEVER FATAL. MusicBrainz being down, or slow, or rate-limiting us must
    // not fail a data refresh — the pipeline's job is concert data, and a
    // missing handle costs a hashtag we were already going to print. It also
    // publishes nothing on its own: proposals land in the worksheet, and only
    // the self-proving `site-domain` rows promote.
    if (!dryRun && !skipHandles) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Harvesting social handles for new entities`)
      console.log('-'.repeat(60))
      try {
        await run('npm run harvest:handles -- --new-only')
        await run('npm run harvest:handles -- --promote')
      } catch (error) {
        console.warn(`⚠️  Handle harvest failed, continuing: ${(error as Error).message}`)
        console.warn('   Posts fall back to hashtags. Re-run: npm run harvest:handles -- --new-only')
      }
      console.log()
    }

    // Step 11: Update meta tags and SEO files (always runs)
    if (!dryRun) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Updating meta tags and SEO files`)
      console.log('-'.repeat(60))
      await run('npm run update:meta')
      console.log()
    }

    // Step 12: Generate sitemap (always runs)
    if (!dryRun) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Generating sitemap`)
      console.log('-'.repeat(60))
      await run('npm run generate:sitemap')
      console.log()
    }

    // Step 13: Generate RSS feed (always runs)
    if (!dryRun) {
      currentStep++
      console.log('=' .repeat(60))
      console.log(`Step ${currentStep}/${activeSteps}: Generating RSS feed`)
      console.log('-'.repeat(60))
      await run('npm run generate:rss')
      console.log()
    }

    // Summary
    console.log('=' .repeat(60))
    console.log(`✨ Data pipeline complete!${dryRun ? ' (DRY RUN)' : ''}`)
    console.log('=' .repeat(60))
    console.log()

    if (dryRun) {
      console.log('💡 This was a dry run - no files were modified')
      console.log()
      console.log('To apply changes:')
      console.log('   • Run without --dry-run: npm run build-data')
    } else {
      console.log('📁 Output files:')
      console.log('   - public/data/concerts.json')
      console.log('   - public/data/artists-metadata.json')
      if (!skipTracks) console.log('   - public/data/artists-top-tracks.json')
      if (!skipVenues) console.log('   - public/data/venues-metadata.json')
      if (!skipDiscography) console.log('   - public/data/discography.json')
      if (!skipAlbumEras) console.log('   - public/data/album-eras.json')
      if (!skipSongAlbums) console.log('   - public/data/song-albums.json')
      if (!skipSetlists) console.log('   - public/data/setlists-cache.json')
      console.log('   - public/data/most-played-songs.json')
      console.log('   - public/data/facts.json')
      console.log('   - public/sitemap.xml')
      console.log('   - public/rss.xml')
      console.log('   - index.html (meta tags updated)')
      console.log('   - public/llm.txt (stats updated)')
      console.log('   - public/og-stats.json')
      console.log()
      console.log('📦 Automatic backups created with .backup.TIMESTAMP extension')
      console.log()
      console.log('Next steps:')
      console.log('   • Review changes: npm run diff-data')
      console.log('   • Build site: npm run build')
      console.log('   • Preview: npm run dev')
    }
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error)
    console.error('\nTo troubleshoot:')
    console.error('   • Check error message above for specific issue')
    console.error('   • Verify .env file has required API credentials')
    console.error('   • Try running individual scripts to isolate the problem')
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildData()
}

export { buildData }
