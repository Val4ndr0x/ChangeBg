import { MatteRefiner } from '../server/services/MatteRefiner'
const refiner = new MatteRefiner() as any

// Build a small closed loop: a 2px bump on a flat edge.
// Flat edge from (0,0) to (10,0) at y=0, plus a bump at x=5 protruding to y=-2, closing the loop below.
const pts: Array<{x:number,y:number}> = []
// forward: along top edge to bump
for (let x = 0; x <= 5; x++) pts.push({ x: x + 0.5, y: 0 })
// bump: up, across, down (flat-top bump)
pts.push({ x: 5.5, y: -1 })
pts.push({ x: 5.5, y: -2 })
pts.push({ x: 4.5, y: -2 })
pts.push({ x: 4.5, y: -1 })
// back along top edge
for (let x = 4; x >= 0; x--) pts.push({ x: x + 0.5, y: 0 })
// bottom edge of the rect
for (let x = 0; x <= 5; x++) pts.push({ x: x + 0.5, y: -3 })
// close via sides
pts.push({ x: 0.5, y: -1.5 })
console.log('n=', pts.length)
const res = refiner.removeBumps(pts)
console.log('after removeBumps n=', res.length)
res.forEach((p: any, i: number) => console.log(`  [${i}] (${p.x},${p.y})`))
