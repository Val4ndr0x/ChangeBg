import { MatteRefiner } from '../server/services/MatteRefiner'

const W = 640
const H = 800

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function main() {
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
    if (rand() < 0.5) punch(rect.x0 - 1 - depth, y, depth, true)
    else punch(rect.x0, y, depth, false)
  }
  for (let e = 0; e < 40; e++) {
    const y = rect.y0 + Math.floor(rand() * (rect.y1 - rect.y0))
    const depth = 1 + Math.floor(rand() * 3)
    if (rand() < 0.5) punch(rect.x1 + 1, y, depth, true)
    else punch(rect.x1 - depth + 1, y, depth, false)
  }
  for (let e = 0; e < 25; e++) {
    const x = rect.x0 + Math.floor(rand() * (rect.x1 - rect.x0))
    const depth = 1 + Math.floor(rand() * 2)
    if (rand() < 0.5) {
      for (let k = 0; k < depth; k++) core[(rect.y0 - 1 - k) * W + x] = 1
    } else {
      for (let k = 0; k < depth; k++) core[(rect.y0 + k) * W + x] = 0
    }
  }

  const refiner = new MatteRefiner() as any

  const contours = refiner.extractContours(core, W, H)
  console.log(`Nº de contornos: ${contours.length}`)
  contours.forEach((c: any, idx: number) => {
    console.log(`  contorno ${idx}: ${c.length} puntos, bbox x[${Math.min(...c.map((p: any) => p.x))},${Math.max(...c.map((p: any) => p.x))}] y[${Math.min(...c.map((p: any) => p.y))},${Math.max(...c.map((p: any) => p.y))}]`)
  })

  const opts = {
    binaryThreshold: 0.5,
    maxHoleArea: 20,
    maxIslandArea: 10,
    smoothingIterations: 3,
    smoothingLambda: 0.5,
    cornerScale: 3,
    maxDisplacement: 1.5,
    simplifyTolerance: 1.0,
    outwardBias: 0.15,
    maxRetries: 2,
    maxSpikes: 5,
    maxSawtooth: 0.35
  }

  const mainContour = contours.reduce((a: any, b: any) => (b.length > a.length ? b : a))
  console.log(`\nContorno principal antes de suavizado: ${mainContour.length} puntos`)
  const dec = refiner.decimate(mainContour)
  console.log(`  después de decimate: ${dec.length}`)
  const simp = refiner.simplify(dec, 1.0)
  console.log(`  después de simplify(DP): ${simp.length}`)
  let cur = simp
  for (let it = 0; it < 3; it++) {
    cur = refiner.laplacianPass(cur, 0.5, 3.0, 1.5)
  }
  console.log(`  después de 3 pasadas laplacian: ${cur.length}`)

  const coverage = refiner.polygonCoverage([cur], W, H)
  let fg = 0
  let edge = 0
  for (let i = 0; i < W * H; i++) {
    if (coverage[i] >= 8) fg++
    if (coverage[i] > 0 && coverage[i] < 16) edge++
  }
  console.log(`\nCobertura SSAA: píxeles fg=${fg}, píxeles de borde=${edge}`)

  const bin2 = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) bin2[i] = coverage[i] >= 8 ? 1 : 0
  const contours2 = refiner.extractContours(bin2, W, H)
  console.log(`\nContornos de la cobertura rasterizada: ${contours2.length}`)
  contours2.forEach((c: any, idx: number) => {
    console.log(`  contorno ${idx}: ${c.length} puntos`)
  })
  const c2 = contours2.reduce((a: any, b: any) => (b.length > a.length ? b : a), contours2[0])
  let spikes = 0
  let sawAcc = 0
  for (let i = 0; i < c2.length; i++) {
    const j1 = refiner.walk(c2, i, -1, 1.5)
    const j2 = refiner.walk(c2, i, 1, 1.5)
    const corn = refiner.cornerness(c2, i, j1, j2)
    if (corn > 150) spikes++
    const p = c2[(i - 1 + c2.length) % c2.length]
    const q = c2[i]
    const r = c2[(i + 1) % c2.length]
    sawAcc += Math.hypot(r.x - 2 * q.x + p.x, r.y - 2 * q.y + p.y)
  }
  console.log(`  spikes=${spikes}, sawtooth=${(sawAcc / c2.length).toFixed(4)}`)
}

main()
