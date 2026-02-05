#!/usr/bin/env node
/**
 * Generate favicon.ico from PNG source
 */

import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function generateFaviconIco() {
  console.log('🎨 Generating favicon.ico...\n');

  const iconsDir = join(projectRoot, 'public', 'icons');
  const outputPath = join(projectRoot, 'public', 'favicon.ico');

  // Read the 32px and 16px PNGs
  const png32Path = join(iconsDir, 'favicon-32.png');
  const png16Path = join(iconsDir, 'favicon-16.png');

  try {
    // Generate ICO with multiple sizes
    const ico = await pngToIco([png32Path, png16Path]);
    writeFileSync(outputPath, ico);

    console.log('✓ favicon.ico generated successfully');
    console.log(`  Output: ${outputPath}`);
    console.log('  Contains: 32×32 and 16×16 variants');
  } catch (error) {
    console.error('❌ Error generating favicon.ico:', error);
    process.exit(1);
  }
}

generateFaviconIco();
