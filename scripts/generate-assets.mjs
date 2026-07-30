import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const PUBLIC = path.join(root, 'public')

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function generateBackground() {
  const outDir = path.join(PUBLIC, 'backgrounds')
  await ensureDir(outDir)

  const bg = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  })
    .jpeg({ quality: 100 })
    .toFile(path.join(outDir, 'default-black.jpg'))

  console.log(`  ✓ default-black.jpg (${bg.size} bytes)`)
}

async function generateFrame() {
  const outDir = path.join(PUBLIC, 'frames')
  await ensureDir(outDir)

  const w = 800, h = 1000
  const borderWidth = 8
  const radius = 24

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
      </defs>
      <rect
        x="${borderWidth / 2}" y="${borderWidth / 2}"
        width="${w - borderWidth}" height="${h - borderWidth}"
        rx="${radius}" ry="${radius}"
        fill="none"
        stroke="#1a1a1a"
        stroke-width="${borderWidth}"
        filter="url(#shadow)"
      />
      <rect
        x="${borderWidth + 3}" y="${borderWidth + 3}"
        width="${w - 2 * (borderWidth + 3)}"
        height="${h - 2 * (borderWidth + 3)}"
        rx="${Math.max(4, radius - borderWidth - 3)}"
        ry="${Math.max(4, radius - borderWidth - 3)}"
        fill="none"
        stroke="#ffffff"
        stroke-width="0.5"
        stroke-opacity="0.12"
      />
    </svg>`

  const frame = await sharp(Buffer.from(svg))
    .resize(w, h)
    .png()
    .toFile(path.join(outDir, 'frame.png'))

  console.log(`  ✓ frame.png (${frame.size} bytes)`)
}

async function main() {
  console.log('Generating placeholder assets...\n')

  await generateBackground()
  await generateFrame()
  await ensureDir(path.join(PUBLIC, 'output'))

  console.log('\n✓ Assets generated successfully')
}

main().catch((err) => {
  console.error('Failed to generate assets:', err)
  process.exit(1)
})
