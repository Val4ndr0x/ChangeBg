import sharp from 'sharp'
import path from 'node:path'
import { MatteRefiner } from '../server/services/MatteRefiner'

const W = 640
const H = 800
const OUT = path.resolve('scripts/refiner-test')

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function chamferDistance(core: Uint8Array, w: number, h: number): Float64Array {
  const INF = 1 << 20
  const d = new Float64Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = core[i] ? 0 : INF
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let m = d[i]
      if (y > 0) {
        m = Math.min(m, d[i - w] + 3)
        if (x > 0) m = Math.min(m, d[i - w - 1] + 4)
        if (x < w - 1) m = Math.min(m, d[i - w + 1] + 4)
      }
      if (x > 0) m = Math.min(m, d[i - 1] + 3)
      d[i] = m
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      let m = d[i]
      if (y < h - 1) {
        m = Math.min(m, d[i + w] + 3)
        if (x > 0) m = Math.min(m, d[i + w - 1] + 4)
        if (x < w - 1) m = Math.min(m, d[i + w + 1] + 4)
      }
      if (x < w - 1) m = Math.min(m, d[i + 1] + 3)
      d[i] = m
    }
  }
  return d
}

async function saveMask(name: string, mask: Float32Array, w: number, h: number) {
  const buf = Buffer.alloc(w * h)
  for (let i = 0; i < mask.length; i++) {
    buf[i] = Math.round(Math.max(0, Math.min(1, mask[i])) * 255)
  }
  await sharp(buf, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toFile(path.join(OUT, name))
}

async function main() {
  const rand = mulberry32(1337)
  const rect = { x0: 90, x1: W - 90, y0: 60, y1: H - 80 }

  const core = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1) {
        core[y * W + x] = 1
      }
    }
  }

  const punch = (cx: number, cy: number, depth: number, set: boolean) => {
    for (let k = 0; k < depth; k++) {
      const px = cx + k
      if (px >= 0 && px < W && cy >= 0 && cy < H) core[cy * W + px] = set ? 1 : 0
    }
  }

  for (let e = 0; e < 40; e++) {
    const y = rect.y0 + Math.floor(rand() * (rect.y1 - rect.y0))
    const depth = 1 + Math.floor(rand() * 3)
    const spike = rand() < 0.5
    if (spike) punch(rect.x0 - 1 - depth, y, depth, true)
    else punch(rect.x0, y, depth, false)
  }
  for (let e = 0; e < 40; e++) {
    const y = rect.y0 + Math.floor(rand() * (rect.y1 - rect.y0))
    const depth = 1 + Math.floor(rand() * 3)
    const spike = rand() < 0.5
    if (spike) punch(rect.x1 + 1, y, depth, true)
    else punch(rect.x1 - depth + 1, y, depth, false)
  }
  for (let e = 0; e < 25; e++) {
    const x = rect.x0 + Math.floor(rand() * (rect.x1 - rect.x0))
    const depth = 1 + Math.floor(rand() * 2)
    const spike = rand() < 0.5
    if (spike) {
      for (let k = 0; k < depth; k++) core[(rect.y0 - 1 - k) * W + x] = 1
    } else {
      for (let k = 0; k < depth; k++) core[(rect.y0 + k) * W + x] = 0
    }
  }

  const holes: Array<[number, number, number]> = []
  for (let i = 0; i < 6; i++) {
    const hx = rect.x0 + 50 + Math.floor(rand() * (rect.x1 - rect.x0 - 100))
    const hy = rect.y0 + 50 + Math.floor(rand() * (rect.y1 - rect.y0 - 100))
    const r = 1 + Math.floor(rand() * 2)
    holes.push([hx, hy, r])
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.hypot(dx, dy) <= r) core[(hy + dy) * W + hx + dx] = 0
      }
    }
  }

  for (let i = 0; i < 8; i++) {
    const sx = Math.floor(rand() * W)
    const sy = Math.floor(rand() * H)
    core[sy * W + sx] = 1
    if (rand() < 0.6 && sx + 1 < W) core[sy * W + sx + 1] = 1
  }

  const dist = chamferDistance(core, W, H)
  const soft = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    if (core[i]) {
      soft[i] = 1
    } else {
      const dpx = dist[i] / 3.0
      soft[i] = Math.max(0, 0.5 - dpx * 0.5)
    }
  }

  const hairTop = rect.y0 - 34
  for (let y = hairTop; y < rect.y0; y++) {
    for (let x = rect.x0 + 24; x <= rect.x1 - 24; x++) {
      if (core[y * W + x]) continue
      const t = (y - hairTop) / (rect.y0 - hairTop)
      const s = 0.5 + 0.5 * Math.sin(x / 11.0 + y / 5.0)
      const v = (0.85 * (1 - t) * (1 - t)) * (0.72 + 0.28 * s)
      soft[y * W + x] = Math.max(0, Math.min(1, v))
    }
  }

  await saveMask('01-soft-input.png', soft, W, H)
  await saveMask(
    '02-binary-before.png',
    new Float32Array(W * H).map((_, i) => (core[i] ? 1 : 0)),
    W,
    H
  )

  const t0 = Date.now()
  const refiner = new MatteRefiner()
  const result = refiner.refine(soft, W, H)
  const elapsed = Date.now() - t0

  console.log(`Tiempo de refinamiento: ${elapsed}ms`)
  console.log('Métricas:')
  console.log(`  intentos: ${result.metrics.attempts}`)
  console.log(`  pasó validación: ${result.metrics.passed}`)
  console.log(`  huecos rellenados: ${result.metrics.holesFilled}`)
  console.log(`  islas eliminadas: ${result.metrics.islandsRemoved}`)
  console.log(`  picos: ${result.metrics.spikes}`)
  console.log(`  dientes de sierra (media |Δ²| px): ${result.metrics.sawtooth.toFixed(4)}`)
  console.log(`  gradiente alpha máx: ${result.metrics.maxAlphaGradient.toFixed(3)}`)

  await saveMask('03-alpha-refined.png', result.alpha, W, H)

  const band = new Float32Array(W * H)
  const fuzz = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const a = result.alpha[i]
    band[i] = a >= 0.01 && a <= 0.99 ? 1 : 0
    const s = soft[i]
    fuzz[i] = s > 0.2 && s < 0.85 ? 1 : 0
  }
  await saveMask('04-edge-band.png', band, W, H)
  await saveMask('05-soft-fuzz-region.png', fuzz, W, H)

  console.log('Guardado en scripts/refiner-test/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
