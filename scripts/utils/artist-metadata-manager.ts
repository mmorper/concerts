/**
 * Artist Metadata Manager
 *
 * Handles loading and enriching artist metadata for the build pipeline.
 * Provides genre assignment from artist metadata and auto-enrichment for new artists.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { normalizeArtistName, normalizeGenreName } from '../../src/utils/normalize.js'
import { TheAudioDBClient } from './theaudiodb-client.js'
import { LastFmClient } from './lastfm-client.js'
import { createBackup } from './backup.js'

export interface ArtistMetadata {
  name: string
  normalizedName: string
  genre: string
  genreNormalized: string
  imageUrl?: string
  spotifyId?: string
  lastFmUrl?: string
  source: 'manual' | 'theaudiodb' | 'lastfm' | 'spotify'
  fetchedAt: string
}

export interface ArtistMetadataFile {
  artists: ArtistMetadata[]
  lastUpdated: string
}

export class ArtistMetadataManager {
  private metadataMap: Map<string, ArtistMetadata> = new Map()
  private metadataPath: string
  private hasChanges = false
  private audioDbClient?: TheAudioDBClient
  private lastFmClient?: LastFmClient

  constructor(
    metadataPath: string,
    audioDbApiKey?: string,
    lastFmApiKey?: string
  ) {
    this.metadataPath = metadataPath

    // Initialize API clients if credentials provided
    if (audioDbApiKey) {
      this.audioDbClient = new TheAudioDBClient(audioDbApiKey)
    }
    if (lastFmApiKey) {
      this.lastFmClient = new LastFmClient(lastFmApiKey)
    }
  }

  /**
   * Load artist metadata from file
   */
  load(): void {
    if (!existsSync(this.metadataPath)) {
      console.warn(`⚠️  Artist metadata not found at ${this.metadataPath}`)
      console.warn('   Run "npm run generate-artist-metadata" to create it')
      return
    }

    const data: ArtistMetadataFile = JSON.parse(readFileSync(this.metadataPath, 'utf-8'))

    data.artists.forEach(artist => {
      this.metadataMap.set(artist.name, artist)
    })

    console.log(`📦 Loaded ${this.metadataMap.size} artist metadata records`)
  }

  /**
   * Get artist metadata by name
   */
  get(artistName: string): ArtistMetadata | undefined {
    return this.metadataMap.get(artistName)
  }

  /**
   * Get artist genre, with auto-enrichment for new artists
   */
  async getGenre(artistName: string): Promise<{
    genre: string
    genreNormalized: string
    isNew: boolean
  }> {
    let metadata = this.metadataMap.get(artistName)

    // If artist not found, try to enrich from APIs
    if (!metadata) {
      console.log(`🔍 New artist detected: ${artistName}`)
      metadata = await this.enrichNewArtist(artistName)

      if (metadata) {
        this.metadataMap.set(artistName, metadata)
        this.hasChanges = true
        console.log(`✅ Enriched ${artistName} - genre: ${metadata.genre}`)
      } else {
        // API lookup failed - use fallback
        console.warn(`⚠️  Could not find ${artistName} in APIs - defaulting to "Other"`)
        metadata = {
          name: artistName,
          normalizedName: normalizeArtistName(artistName),
          genre: 'Other',
          genreNormalized: 'other',
          source: 'manual',
          fetchedAt: new Date().toISOString()
        }
        this.metadataMap.set(artistName, metadata)
        this.hasChanges = true
      }

      return {
        genre: metadata.genre,
        genreNormalized: metadata.genreNormalized,
        isNew: true
      }
    }

    return {
      genre: metadata.genre,
      genreNormalized: metadata.genreNormalized,
      isNew: false
    }
  }

  /**
   * Enrich new artist from external APIs
   */
  private async enrichNewArtist(artistName: string): Promise<ArtistMetadata | null> {
    // Try TheAudioDB first
    if (this.audioDbClient) {
      try {
        const audioDbData = await this.audioDbClient.getArtistInfo(artistName)

        if (audioDbData && audioDbData.genres && audioDbData.genres[0]) {
          return {
            name: artistName,
            normalizedName: normalizeArtistName(artistName),
            genre: audioDbData.genres[0],
            genreNormalized: normalizeGenreName(audioDbData.genres[0]),
            imageUrl: audioDbData.image,
            source: 'theaudiodb',
            fetchedAt: new Date().toISOString()
          }
        }
      } catch (error) {
        console.warn(`   TheAudioDB lookup failed for ${artistName}`)
      }
    }

    // Fallback to Last.fm
    if (this.lastFmClient) {
      try {
        const lastFmData = await this.lastFmClient.getArtistInfo(artistName)

        if (lastFmData && lastFmData.genres && lastFmData.genres[0]) {
          return {
            name: artistName,
            normalizedName: normalizeArtistName(artistName),
            genre: lastFmData.genres[0],
            genreNormalized: normalizeGenreName(lastFmData.genres[0]),
            imageUrl: lastFmData.image,
            source: 'lastfm',
            fetchedAt: new Date().toISOString()
          }
        }
      } catch (error) {
        console.warn(`   Last.fm lookup failed for ${artistName}`)
      }
    }

    return null // Not found
  }

  /**
   * Save artist metadata if changes were made
   */
  save(): void {
    if (!this.hasChanges) {
      return
    }

    // Create backup
    if (existsSync(this.metadataPath)) {
      createBackup(this.metadataPath)
    }

    // Convert map to array and sort
    const artists = Array.from(this.metadataMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))

    const data: ArtistMetadataFile = {
      artists,
      lastUpdated: new Date().toISOString()
    }

    writeFileSync(this.metadataPath, JSON.stringify(data, null, 2))
    console.log(`💾 Saved ${artists.length} artist records to ${this.metadataPath}`)
  }

  /**
   * Get statistics about enrichment
   */
  getStats(): {
    total: number
    withImages: number
    bySources: Record<string, number>
  } {
    const artists = Array.from(this.metadataMap.values())
    const withImages = artists.filter(a => a.imageUrl).length
    const bySources: Record<string, number> = {}

    artists.forEach(a => {
      bySources[a.source] = (bySources[a.source] || 0) + 1
    })

    return {
      total: artists.length,
      withImages,
      bySources
    }
  }
}
