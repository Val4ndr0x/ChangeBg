import { MatteRefiner, polygonCoverage } from '../server/services/MatteRefiner'

const w = 12, h = 10
const m = new Uint8Array(w * h)
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = 1

const refiner = new MatteRefiner() as any
const cs = refiner.extractContours(m, w, h)
const cov = polygonCoverage(cs, w, h)
for (let y = 0; y < h; y++) {
  const row: number[] = []
  for (let x = 0; x < w; x++) row.push(cov[y * w + x])
  console.log(`y=${y}: ${row.join(',')}`)
}
