import { createJiti } from 'jiti'
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const jiti = createJiti(import.meta.url, { interopDefault: true })
const { BiRefNetService } = await jiti.import('../server/services/BiRefNetService.ts')

const W = 1200
const H = 1600
const CW = 768
const CH = 1024

// --- RGB image: subject blob + hair strands + clean background
const rgb = Buffer.alloc(W * H * 3)
const subjectColor = [120, 80, 190]
const hairColor = [60, 40, 120]
const bgColor = [230, 220, 200]
const cx = 600
const cy = 640
const rx = 260
const ry = 420
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
    let r = bgColor[0], g = bgColor[1], b = bgColor[2]
    if (d < 1) { r = subjectColor[0]; g = subjectColor[1]; b = subjectColor[2] }
    const i = (y * W + x) * 3
    rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b
  }
}
// hair strands above the head (darker strands over background)
for (let k = 0; k < 220; k++) {
  const x0 = cx - rx * 0.6 + (k % 140)
  const y0 = cy - ry - 4
  for (let s = 0; s < 90; s++) {
    const x = Math.round(x0 + s * 1.4)
    const y = Math.round(y0 - s * 0.7 + Math.sin(s * 0.35 + k) * 3)
    if (x < 0 || x >= W || y < 0) continue
    const i = (y * W + x) * 3
    rgb[i] = hairColor[0]; rgb[i + 1] = hairColor[1]; rgb[i + 2] = hairColor[2]
  }
}
const imgBuf = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
  .png()
  .toBuffer()

// --- synthetic soft mask at model content res: ellipse + soft edge + strands + background smudge
const soft = new Float32Array(CW * CH)
const scx = (cx / W) * CW
const scy = (cy / H) * CH
const srx = (rx / W) * CW
const sry = (ry / H) * CH
for (let y = 0; y < CH; y++) {
  for (let x = 0; x < CW; x++) {
    const d = Math.hypot((x - scx) / srx, (y - scy) / sry)
    soft[y * CW + x] = Math.max(0, Math.min(1, 1 - Math.max(0, (d - 0.84) / 0.16)))
  }
}
// faint hair alpha outside the ellipse
for (let k = 0; k < 220; k++) {
  const x0 = Math.round(scx - srx * 0.6 + (k % 100))
  const y0 = Math.round(scy - sry - 2)
  for (let s = 0; s < 55; s++) {
    const x = x0 + Math.round(s * 1.4)
    const y = y0 - Math.round(s * 0.7) + Math.round(Math.sin(s * 0.35 + k) * 2)
    if (x < 0 || x >= CW || y < 0) continue
    const a = 0.55 - s * 0.006
    if (a > 0.12) soft[y * CW + x] = Math.max(soft[y * CW + x], a)
  }
}
// distant background smudge (should be suppressed)
for (let y = 0; y < 40; y++) {
  for (let x = 0; x < 40; x++) {
    soft[y * CW + (CW - 1 - x)] = 0.4
  }
}

const service = new BiRefNetService()
const t0 = Date.now()
const png = await service.applyMask(imgBuf, soft, CW, CH, W, H)
console.log('applyMask elapsed:', Date.now() - t0, 'ms')

const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
const w = info.width
const h = info.height
let softPx = 0
let maxGrad = 0
const bandWidths = []
let fringe = 0
let fringeN = 0
let bodyFringe = 0
let bodyFringeN = 0
for (let y = 0; y < h; y++) {
  let run = 0
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const a = data[i + 3] / 255
    if (a > 0.001 && a < 0.999) {
      softPx++
      run++
      if (x > 0) maxGrad = Math.max(maxGrad, Math.abs(a - data[i - 4 + 3] / 255))
      if (y > 0) maxGrad = Math.max(maxGrad, Math.abs(a - data[i - w * 4 + 3] / 255))
    } else if (run > 0) {
      bandWidths.push(run)
      run = 0
    }
    if (a > 0.3 && a < 0.98) {
      const nbrs = [
        data[i - w * 4 + 3], data[i + w * 4 + 3], data[i - 4 + 3], data[i + 4 + 3]
      ].map((v) => v / 255)
      if (Math.min(...nbrs) < 0.05) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const dev = Math.abs(r - subjectColor[0]) + Math.abs(g - subjectColor[1]) + Math.abs(b - subjectColor[2])
        fringe += dev
        fringeN++
        if (Math.abs(y - cy) < 250) {
          bodyFringe += dev
          bodyFringeN++
        }
      }
    }
  }
}
bandWidths.sort((a, b) => a - b)
console.log('soft alpha px:', softPx)
console.log('max alpha gradient:', maxGrad.toFixed(3))
if (bandWidths.length) {
  console.log('soft-band width p50/p90:', bandWidths[Math.floor(bandWidths.length * 0.5)], '/', bandWidths[Math.floor(bandWidths.length * 0.9)])
}
console.log('edge color deviation from subject — all:', fringeN ? (fringe / fringeN).toFixed(1) : 'n/a', 'n=', fringeN)
console.log('edge color deviation from subject — body only:', bodyFringeN ? (bodyFringe / bodyFringeN).toFixed(1) : 'n/a', 'n=', bodyFringeN)
const centerAlpha = data[((cy) * w + cx) * 4 + 3] / 255
console.log('interior alpha at center:', centerAlpha.toFixed(3))

// check the distant smudge region is transparent
let smudgeAlpha = 0
for (let y = 0; y < 40; y++) {
  for (let x = 0; x < 40; x++) {
    const a = data[(y * w + (w - 1 - x)) * 4 + 3] / 255
    smudgeAlpha = Math.max(smudgeAlpha, a)
  }
}
console.log('max alpha in distant background smudge (should be ~0):', smudgeAlpha.toFixed(3))

writeFileSync(new URL('./tmp-e2e-cutout2.png', import.meta.url), png)
console.log('saved')
