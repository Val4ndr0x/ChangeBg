import { MatteRefiner, polygonCoverage } from '../server/services/MatteRefiner'

function rect(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(w * h)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * w + x] = 1
  return m
}

const refiner = new MatteRefiner() as any

function verify(label: string, mask: Uint8Array, w: number, h: number) {
  const cs = refiner.extractContours(mask, w, h)
  const cov = polygonCoverage(cs, w, h)
  let errors = 0
  let total = 0
  const wrong: string[] = []
  for (let i = 0; i < w * h; i++) {
    const inside = cov[i] >= 8 ? 1 : 0
    total++
    if (inside !== mask[i]) {
      errors++
      if (wrong.length < 20) wrong.push(`(${i % w},${(i / w) | 0}): mask=${mask[i]} cov=${cov[i]}`)
    }
  }
  console.log(`${label}: contornos=${cs.length}, errores=${errors}/${total} (${((errors / total) * 100).toFixed(2)}%)`)
  if (errors) console.log(`   ${wrong.join(' ')}`)
}

verify('rect 12x10', rect(12, 10, 0, 0, 11, 9), 12, 10)
verify('rect 8x8', rect(8, 8, 1, 1, 6, 6), 8, 8)

const w = 10
const h = 10
const spike = rect(w, h, 2, 2, 7, 7)
spike[1 * w + 4] = 1
spike[0 * w + 4] = 1
verify('rect + 2px spike', spike, w, h)

const notch = rect(w, h, 2, 2, 7, 7)
notch[2 * w + 4] = 0
notch[3 * w + 4] = 0
verify('rect + 2px notch', notch, w, h)

const thin = rect(w, h, 4, 0, 4, 9)
verify('1px wide vertical bar', thin, w, h)

const diag = new Uint8Array(w * h)
diag[2 * w + 2] = 1
diag[3 * w + 3] = 1
diag[3 * w + 2] = 1
verify('diagonal L', diag, w, h)

const donut = rect(w, h, 2, 2, 7, 7)
for (let y = 3; y <= 6; y++) for (let x = 3; x <= 6; x++) donut[y * w + x] = 0
verify('donut with hole', donut, w, h)

const rand = mulberry32(7)
const noise = new Uint8Array(64 * 64)
for (let i = 0; i < 64 * 64; i++) noise[i] = rand() < 0.55 ? 1 : 0
verify('random 64x64', noise, 64, 64)

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
