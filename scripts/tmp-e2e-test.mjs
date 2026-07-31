import { createJiti } from 'jiti'
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const jiti = createJiti(import.meta.url, { interopDefault: true })
const { BiRefNetService } = await jiti.import('../server/services/BiRefNetService.ts')

const input = readFileSync(new URL('../public/test-image.jpg', import.meta.url))
const t0 = Date.now()
const service = new BiRefNetService()
const result = await service.removeBackground(input)
console.log('Elapsed:', Date.now() - t0, 'ms, output:', result.width + 'x' + result.height)

const { data, info } = await sharp(result.pngBuffer)
  .removeAlpha()
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const w = info.width
const h = info.height
let soft = 0
let maxGrad = 0
const widths = []
for (let y = 0; y < h; y += 3) {
  let inRun = false
  let runStart = 0
  for (let x = 0; x < w; x++) {
    const a = data[(y * w + x) * 4 + 3] / 255
    if (a > 0.001 && a < 0.999) soft++
    if (x > 0) maxGrad = Math.max(maxGrad, Math.abs(a - data[(y * w + x - 1) * 4 + 3] / 255))
    if (a >= 0.5 && !inRun) { inRun = true; runStart = x }
    if (inRun && a < 0.5) { widths.push(x - runStart); inRun = false }
  }
}
widths.sort((a, b) => a - b)
console.log('soft alpha pixels:', soft)
console.log('max alpha gradient:', maxGrad.toFixed(3))
if (widths.length) {
  console.log('transition width p50/p90:', widths[Math.floor(widths.length * 0.5)], '/', widths[Math.floor(widths.length * 0.9)])
}
writeFileSync(new URL('./tmp-e2e-cutout.png', import.meta.url), result.pngBuffer)
console.log('cutout saved')
