import { createJiti } from 'jiti'
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const jiti = createJiti(import.meta.url, { interopDefault: true })
const { BiRefNetService } = await jiti.import('../server/services/BiRefNetService.ts')

function buildImage(W, H) {
  const rgb = Buffer.alloc(W * H * 3)
  const cx = W * 0.5
  const cy = H * 0.5
  const rx = W * 0.24
  const ry = H * 0.38
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3
      const bgGrad = 180 + Math.round(Math.sin(x * 0.03) * 10 + Math.cos(y * 0.04) * 8)
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
      if (d < 1) {
        rgb[i] = 40; rgb[i + 1] = 70; rgb[i + 2] = 160
      } else {
        rgb[i] = bgGrad; rgb[i + 1] = bgGrad - 10; rgb[i + 2] = bgGrad + 20
      }
    }
  }
  return rgb
}

async function run(W, H) {
  const rgb = buildImage(W, H)
  const imgBuf = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer()
  const t0 = Date.now()
  const service = new BiRefNetService()
  const result = await service.removeBackground(imgBuf)
  const elapsed = Date.now() - t0

  const { data, info } = await sharp(result.pngBuffer).raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  let softPx = 0
  let maxGrad = 0
  let total = 0
  const bandWidths = []
  for (let y = 0; y < h; y++) {
    let run = 0
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const a = data[i + 3] / 255
      if (a > 0.001 && a < 0.999) {
        softPx++
        run++
        if (x > 0) maxGrad = Math.max(maxGrad, Math.abs(a - data[i - 4 + 3] / 255))
      } else {
        if (run > 0) { bandWidths.push(run); run = 0 }
      }
      total++
    }
  }
  bandWidths.sort((a, b) => a - b)
  const p50 = bandWidths[Math.floor(bandWidths.length * 0.5)] ?? 0
  const p90 = bandWidths[Math.floor(bandWidths.length * 0.9)] ?? 0
  console.log(`${W}x${H}: elapsed=${elapsed}ms softPx=${softPx} maxGrad=${maxGrad.toFixed(3)} band-p50/p90=${p50}/${p90}`)
  return result.pngBuffer
}

const png1 = await run(900, 1200)
const png2 = await run(2200, 2933)
writeFileSync(new URL('./tmp-e2e-model-900.png', import.meta.url), png1)
writeFileSync(new URL('./tmp-e2e-model-2200.png', import.meta.url), png2)
console.log('saved')
