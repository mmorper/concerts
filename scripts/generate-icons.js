#!/usr/bin/env node
/**
 * Generate iOS home screen icons and favicon from SVG sources
 * Source files located in docs/design/icons/
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// iOS icon sizes required
const iosSizes = [
  { size: 180, name: 'apple-touch-icon-180.png' },
  { size: 167, name: 'apple-touch-icon-167.png' },
  { size: 152, name: 'apple-touch-icon-152.png' },
];

// Favicon sizes
const faviconSizes = [
  { size: 32, name: 'favicon-32.png' },
  { size: 16, name: 'favicon-16.png' },
];

async function generateIcons() {
  console.log('🎨 Generating production icons...\n');

  // Ensure output directory exists
  const iconsDir = join(projectRoot, 'public', 'icons');
  mkdirSync(iconsDir, { recursive: true });

  // Read source SVGs from design directory
  const iosSvgPath = join(projectRoot, 'docs', 'design', 'icons', 'ios-icon-v2-network.svg');
  const faviconSvgPath = join(projectRoot, 'docs', 'design', 'icons', 'favicon-v7-organic.svg');

  const iosSvg = readFileSync(iosSvgPath);
  const faviconSvg = readFileSync(faviconSvgPath);

  // Generate iOS home screen icons
  console.log('📱 Generating iOS home screen icons...');
  for (const { size, name } of iosSizes) {
    const outputPath = join(iconsDir, name);
    await sharp(iosSvg)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);
    console.log(`   ✓ ${name} (${size}×${size})`);
  }

  // Generate favicon PNGs
  console.log('\n🌐 Generating favicon PNGs...');
  for (const { size, name } of faviconSizes) {
    const outputPath = join(iconsDir, name);
    await sharp(faviconSvg)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);
    console.log(`   ✓ ${name} (${size}×${size})`);
  }

  console.log('\n✨ All icons generated successfully!');
  console.log(`\nOutput directory: ${iconsDir}`);
}

// Run the script
generateIcons().catch(error => {
  console.error('❌ Error generating icons:', error);
  process.exit(1);
});
