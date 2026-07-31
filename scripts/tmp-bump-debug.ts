import { MatteRefiner } from '../server/services/MatteRefiner'
const refiner = new MatteRefiner() as any

const pts: Array<{x:number,y:number}> = []
for (let x = 0; x <= 5; x++) pts.push({ x: x + 0.5, y: 0 })
pts.push({ x: 5.5, y: -1 }); pts.push({ x: 5.5, y: -2 }); pts.push({ x: 4.5, y: -2 }); pts.push({ x: 4.5, y: -1 })
for (let x = 4; x >= 0; x--) pts.push({ x: x + 0.5, y: 0 })
for (let x = 0; x <= 5; x++) pts.push({ x: x + 0.5, y: -3 })
pts.push({ x: 0.5, y: -1.5 })

const m = pts.length
for (let i = 0; i < m; i++) {
  const j1 = refiner.walk(pts, i, -1, 3.0)
  const j2 = refiner.walk(pts, i, 1, 3.0)
  if (j1 === i || j2 === i) continue
  let a = 0
  let k = j1
  for (let guard = 0; k !== j2 && guard <= m; guard++) {
    const nk = (k + 1) % m
    a += Math.hypot(pts[nk].x - pts[k].x, pts[nk].y - pts[k].y)
    k = nk
  }
  const chord = Math.hypot(pts[j2].x - pts[j1].x, pts[j2].y - pts[j1].y)
  if (a > 3.0 && chord < 0.6 * a) console.log(`i=${i} (${pts[i].x},${pts[i].y}) j1=${j1} j2=${j2} arc=${a.toFixed(1)} chord=${chord.toFixed(1)} -> COLLAPSE`)
}
