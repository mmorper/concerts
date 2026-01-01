import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const OUTPUT_WIDTH = 1200
const OUTPUT_HEIGHT = 630
const OUTPUT_PATH = 'public/og-image.jpg'

async function createComposite() {
  console.log('Creating OG image composite...')

  // Create base canvas with dark purple gradient background
  const background = await sharp({
    create: {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      channels: 4,
      background: { r: 49, g: 46, b: 129 } // indigo-950
    }
  })
    .png()
    .toBuffer()

  // Load all scene screenshots
  const scenes = [
    'public/scene-1-timeline.png',
    'public/scene-2-venues.png',
    'public/scene-3-map.png',
    'public/scene-4-genres.png',
    'public/scene-5-artists.png'
  ]

  // Create a 2x3 grid layout (top row: 2 scenes, middle row: 2 scenes, bottom row: 1 scene)
  // Each thumbnail will be 360x210px with 20px gaps
  const thumbWidth = 360
  const thumbHeight = 210
  const gap = 20
  const startY = 140 // Leave space at top for title

  const composites = []

  // Row 1: Timeline and Venues
  composites.push({
    input: await sharp(scenes[0]).resize(thumbWidth, thumbHeight, { fit: 'cover' }).toBuffer(),
    top: startY,
    left: gap
  })
  composites.push({
    input: await sharp(scenes[1]).resize(thumbWidth, thumbHeight, { fit: 'cover' }).toBuffer(),
    top: startY,
    left: gap + thumbWidth + gap
  })

  // Row 2: Map and Genres
  composites.push({
    input: await sharp(scenes[2]).resize(thumbWidth, thumbHeight, { fit: 'cover' }).toBuffer(),
    top: startY + thumbHeight + gap,
    left: gap
  })
  composites.push({
    input: await sharp(scenes[3]).resize(thumbWidth, thumbHeight, { fit: 'cover' }).toBuffer(),
    top: startY + thumbHeight + gap,
    left: gap + thumbWidth + gap
  })

  // Right column: Artists (tall)
  composites.push({
    input: await sharp(scenes[4]).resize(thumbWidth, thumbHeight * 2 + gap, { fit: 'cover' }).toBuffer(),
    top: startY,
    left: gap + (thumbWidth + gap) * 2
  })

  // Create SVG overlay for text
  const textOverlay = `
    <svg width="${OUTPUT_WIDTH}" height="${OUTPUT_HEIGHT}">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&amp;family=Source+Sans+3:wght@400&amp;display=swap');
          .title {
            font-family: 'Playfair Display', serif;
            font-size: 56px;
            font-weight: 600;
            fill: white;
          }
          .subtitle {
            font-family: 'Source Sans 3', sans-serif;
            font-size: 20px;
            fill: rgba(255,255,255,0.9);
            letter-spacing: 0.5px;
          }
        </style>
      </defs>

      <text x="600" y="60" text-anchor="middle" class="title">Morperhaus Concert Archives</text>
      <text x="600" y="100" text-anchor="middle" class="subtitle">Four decades. 175 shows. Five interactive stories.</text>
    </svg>
  `

  // Composite everything together
  await sharp(background)
    .composite([
      ...composites,
      {
        input: Buffer.from(textOverlay),
        top: 0,
        left: 0
      }
    ])
    .jpeg({ quality: 90 })
    .toFile(OUTPUT_PATH)

  console.log(`✓ OG image created: ${OUTPUT_PATH}`)
  console.log(`  Dimensions: ${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}px`)
}

createComposite().catch(console.error)
