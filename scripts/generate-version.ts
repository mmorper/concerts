import fs from 'fs'
import { execSync } from 'child_process'

const version = {
  buildTime: new Date().toISOString(),
  commit: execSync('git rev-parse --short HEAD').toString().trim(),
  branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
}

fs.writeFileSync(
  'public/version.json',
  JSON.stringify(version, null, 2)
)

console.log('✓ Version file generated:', version)
