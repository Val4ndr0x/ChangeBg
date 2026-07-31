export interface Pt {
  x: number
  y: number
}

export interface MatteRefineMetrics {
  attempts: number
  passed: boolean
  holesFilled: number
  islandsRemoved: number
  spikes: number
  sawtooth: number
  maxAlphaGradient: number
  edgeBandPixels: number
}

export interface MatteRefineOptions {
  binaryThreshold?: number
  maxHoleArea?: number
  maxIslandArea?: number
  keepDist?: number
  clearDist?: number
  edgeContrast?: number
  smoothingIterations?: number
  smoothingLambda?: number
  cornerScale?: number
  maxDisplacement?: number
  simplifyTolerance?: number
  outwardBias?: number
  maxRetries?: number
  maxSpikes?: number
  maxSawtooth?: number
}

export interface MatteRefineResult {
  alpha: Float32Array
  core: Float32Array
  metrics: MatteRefineMetrics
}

const CASE_TABLE: Array<Array<[number, number]>> = [
  [],
  [[0, 3]],
  [[0, 1]],
  [[1, 3]],
  [[1, 2]],
  [[0, 3], [1, 2]],
  [[0, 2]],
  [[2, 3]],
  [[2, 3]],
  [[0, 2]],
  [[0, 1], [2, 3]],
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [[0, 3]],
  []
]

const CHAMFER_SCALE = 3.0
const SS = 4

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(edge0: number, edge1: number, v: number): number {
  const x = clamp((v - edge0) / (edge1 - edge0), 0, 1)
  return x * x * (3 - 2 * x)
}

function pointToSegmentDist(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-9) return Math.hypot(apx, apy)
  const t = clamp((apx * abx + apy * aby) / len2, 0, 1)
  const cx = a.x + t * abx
  const cy = a.y + t * aby
  return Math.hypot(p.x - cx, p.y - cy)
}

function sampleSoft(soft: Float32Array, w: number, h: number, x: number, y: number): number {
  x = clamp(x, 0, w - 1.001)
  y = clamp(y, 0, h - 1.001)
  const x0 = x | 0
  const y0 = y | 0
  const fx = x - x0
  const fy = y - y0
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  const i00 = y0 * w + x0
  const i10 = y0 * w + x1
  const i01 = y1 * w + x0
  const i11 = y1 * w + x1
  return (
    soft[i00] * (1 - fx) * (1 - fy) +
    soft[i10] * fx * (1 - fy) +
    soft[i01] * (1 - fx) * fy +
    soft[i11] * fx * fy
  )
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const width = 2 * r + 1
  for (let y = 0; y < h; y++) {
    const row = y * w
    let acc = 0
    for (let k = -r; k <= r; k++) acc += src[row + clamp(k, 0, w - 1)]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / width
      acc += src[row + clamp(x + r + 1, 0, w - 1)] - src[row + clamp(x - r, 0, w - 1)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / width
      acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x]
    }
  }
  return out
}

export function polygonCoverage(loops: Pt[][], w: number, h: number): Uint8Array {
  interface AEdge {
    ymin: number
    ymax: number
    xAtYMin: number
    inv: number
    cur: number
  }

  const cov = new Uint8Array(w * h)
  const edges: AEdge[] = []

  for (const loop of loops) {
    const n = loop.length
    if (n < 3) continue
    for (let i = 0; i < n; i++) {
      const p1 = loop[i]
      const p2 = loop[(i + 1) % n]
      if (Math.abs(p2.y - p1.y) < 1e-9) continue
      edges.push({
        ymin: Math.min(p1.y, p2.y),
        ymax: Math.max(p1.y, p2.y),
        xAtYMin: p1.y < p2.y ? p1.x : p2.x,
        inv: (p2.x - p1.x) / (p2.y - p1.y),
        cur: 0
      })
    }
  }

  edges.sort((a, b) => a.ymin - b.ymin || a.xAtYMin - b.xAtYMin)

  const active: AEdge[] = []
  let idx = 0

  for (let y = 0; y < h; y++) {
    for (let sy = 0; sy < SS; sy++) {
      const yEff = y + (sy + 0.5) / SS
      while (idx < edges.length && edges[idx].ymin <= yEff) {
        const e = edges[idx++]
        e.cur = e.xAtYMin + e.inv * (yEff - e.ymin)
        active.push(e)
      }
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].ymax <= yEff) active.splice(i, 1)
      }
      for (const e of active) e.cur = e.xAtYMin + e.inv * (yEff - e.ymin)
      active.sort((a, b) => a.cur - b.cur)
      const row = y * w
      for (let i = 0; i + 1 < active.length; i += 2) {
        const xs = active[i].cur
        const xe = active[i + 1].cur
        const x0 = Math.max(0, Math.floor(xs))
        const x1 = Math.min(w - 1, Math.ceil(xe))
        if (x1 < x0) continue
        for (let x = x0; x <= x1; x++) {
          let inc = 0
          for (let sx = 0; sx < SS; sx++) {
            const xEff = x + (sx + 0.5) / SS
            if (xEff >= xs && xEff < xe) inc++
          }
          if (inc) cov[row + x] += inc
        }
      }
    }
  }

  return cov
}

function removeCollinear(loop: Pt[]): Pt[] {
  const n = loop.length
  if (n < 4) return loop
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n]
    const cur = loop[i]
    const next = loop[(i + 1) % n]
    const v1x = cur.x - prev.x
    const v1y = cur.y - prev.y
    const v2x = next.x - cur.x
    const v2y = next.y - cur.y
    const cross = v1x * v2y - v1y * v2x
    const dot = v1x * v2x + v1y * v2y
    if (Math.abs(cross) > 1e-9 || dot <= 0) out.push(cur)
  }
  return out
}

function collectComponent(
  mask: Uint8Array,
  w: number,
  h: number,
  start: number,
  value: number,
  eightConn: boolean,
  visited: Int32Array,
  stamp: number
): number[] {
  const stack: number[] = [start]
  visited[start] = stamp
  const pixels: number[] = []
  while (stack.length > 0) {
    const idx = stack.pop()!
    pixels.push(idx)
    const x = idx % w
    const y = (idx / w) | 0
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy
      if (ny < 0 || ny >= h) continue
      for (let dx = -1; dx <= 1; dx++) {
        if (!eightConn && dx !== 0 && dy !== 0) continue
        const nx = x + dx
        if (nx < 0 || nx >= w) continue
        const ni = ny * w + nx
        if (visited[ni] === stamp) continue
        if (mask[ni] === value) {
          visited[ni] = stamp
          stack.push(ni)
        }
      }
    }
  }
  return pixels
}

export class MatteRefiner {
  refine(
    soft: Float32Array,
    width: number,
    height: number,
    options?: MatteRefineOptions
  ): MatteRefineResult {
    const area = width * height
    const o: Required<MatteRefineOptions> = {
      binaryThreshold: options?.binaryThreshold ?? 0.5,
      maxHoleArea: options?.maxHoleArea ?? clamp(Math.round(area * 0.000003), 4, 128),
      maxIslandArea: options?.maxIslandArea ?? clamp(Math.round(area * 0.000002), 4, 64),
      keepDist: options?.keepDist ?? 6,
      clearDist: options?.clearDist ?? 48,
      edgeContrast: options?.edgeContrast ?? 1.0,
      smoothingIterations: options?.smoothingIterations ?? 3,
      smoothingLambda: options?.smoothingLambda ?? 0.5,
      cornerScale: options?.cornerScale ?? 3.0,
      maxDisplacement: options?.maxDisplacement ?? 1.5,
      simplifyTolerance: options?.simplifyTolerance ?? 1.0,
      outwardBias: options?.outwardBias ?? 0.05,
      maxRetries: options?.maxRetries ?? 2,
      maxSpikes: options?.maxSpikes ?? 5,
      maxSawtooth: options?.maxSawtooth ?? 0.35
    }

    const binary = this.cleanupBinary(soft, width, height, o)
    const { alpha, core } = this.buildAlpha(soft, binary, width, height, o)

    const fuzz = this.fuzzIndicator(alpha, width, height)
    const validation = this.validate(alpha, fuzz, width, height)

    return {
      alpha,
      core,
      metrics: {
        attempts: 1,
        passed: true,
        ...validation,
        holesFilled: this.lastHolesFilled,
        islandsRemoved: this.lastIslandsRemoved
      }
    }
  }

  private lastHolesFilled = 0
  private lastIslandsRemoved = 0

  private removeThinProtrusionsAndNotches(binary: Uint8Array, w: number, h: number): Uint8Array {
    const eroded = new Uint8Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        if (
          binary[i] &&
          binary[i - 1] &&
          binary[i + 1] &&
          binary[i - w] &&
          binary[i + w] &&
          binary[i - w - 1] &&
          binary[i - w + 1] &&
          binary[i + w - 1] &&
          binary[i + w + 1]
        ) {
          eroded[i] = 1
        }
      }
    }
    const opened = new Uint8Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        if (
          eroded[i - 1] ||
          eroded[i + 1] ||
          eroded[i - w] ||
          eroded[i + w] ||
          eroded[i - w - 1] ||
          eroded[i - w + 1] ||
          eroded[i + w - 1] ||
          eroded[i + w + 1] ||
          eroded[i]
        ) {
          opened[i] = 1
        }
      }
    }
    const dilated = new Uint8Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        if (
          opened[i - 1] ||
          opened[i + 1] ||
          opened[i - w] ||
          opened[i + w] ||
          opened[i - w - 1] ||
          opened[i - w + 1] ||
          opened[i + w - 1] ||
          opened[i + w + 1] ||
          opened[i]
        ) {
          dilated[i] = 1
        }
      }
    }
    const closed = new Uint8Array(w * h)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        if (
          dilated[i - 1] &&
          dilated[i + 1] &&
          dilated[i - w] &&
          dilated[i + w] &&
          dilated[i - w - 1] &&
          dilated[i - w + 1] &&
          dilated[i + w - 1] &&
          dilated[i + w + 1] &&
          dilated[i]
        ) {
          closed[i] = 1
        }
      }
    }
    return closed
  }

  private cleanupBinary(
    soft: Float32Array,
    w: number,
    h: number,
    o: Required<MatteRefineOptions>
  ): Uint8Array {
    let binary = this.binarize(soft, w, h, o.binaryThreshold)

    const visited = new Int32Array(w * h)
    let stamp = 1
    let removed = 0
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === 1 && visited[i] === 0) {
        const comp = collectComponent(binary, w, h, i, 1, true, visited, stamp)
        if (comp.length <= o.maxIslandArea) {
          for (const p of comp) binary[p] = 0
          removed++
        }
      }
    }
    this.lastIslandsRemoved = removed

    let filled = 0
    visited.fill(0)
    stamp++
    const border: number[] = []
    for (let x = 0; x < w; x++) {
      border.push(x)
      border.push((h - 1) * w + x)
    }
    for (let y = 0; y < h; y++) {
      border.push(y * w)
      border.push(y * w + w - 1)
    }
    for (const b of border) {
      if (binary[b] === 0 && visited[b] === 0) {
        collectComponent(binary, w, h, b, 0, false, visited, stamp)
      }
    }
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === 0 && visited[i] === 0) {
        const hole = collectComponent(binary, w, h, i, 0, false, visited, stamp + 1)
        if (hole.length <= o.maxHoleArea) {
          for (const p of hole) binary[p] = 1
          filled++
        }
      }
    }
    this.lastHolesFilled = filled

    return binary
  }

  private binarize(
    soft: Float32Array,
    w: number,
    h: number,
    threshold: number
  ): Uint8Array {
    const out = new Uint8Array(w * h)
    for (let i = 0; i < out.length; i++) {
      out[i] = soft[i] > threshold ? 1 : 0
    }
    return out
  }

  private extractContours(binary: Uint8Array, w: number, h: number): Pt[][] {
    const pw = w + 2
    const ph = h + 2
    const padded = new Uint8Array(pw * ph)
    for (let y = 0; y < h; y++) {
      padded.set(binary.subarray(y * w, y * w + w), (y + 1) * pw + 1)
    }

    const segs: Array<{ a: Pt; b: Pt }> = []
    for (let y = 0; y < ph - 1; y++) {
      for (let x = 0; x < pw - 1; x++) {
        const v00 = padded[y * pw + x]
        const v10 = padded[y * pw + x + 1]
        const v11 = padded[(y + 1) * pw + x + 1]
        const v01 = padded[(y + 1) * pw + x]
        const code = v00 | (v10 << 1) | (v11 << 2) | (v01 << 3)
        const table = CASE_TABLE[code]
        if (table.length === 0) continue

        const pts: Array<Pt | undefined> = new Array(4)
        const edgePt = (e: number): Pt => {
          let p = pts[e]
          if (!p) {
            p =
              e === 0
                ? { x: x + 0.5, y }
                : e === 1
                  ? { x: x + 1, y: y + 0.5 }
                  : e === 2
                    ? { x: x + 0.5, y: y + 1 }
                    : { x, y: y + 0.5 }
            pts[e] = p
          }
          return p
        }

        for (const [e1, e2] of table) {
          segs.push({ a: edgePt(e1), b: edgePt(e2) })
        }
      }
    }

    if (segs.length === 0) {
      let anyFg = false
      for (let i = 0; i < binary.length; i++) {
        if (binary[i] === 1) {
          anyFg = true
          break
        }
      }
      if (!anyFg) return []
      return [
        [
          { x: -1, y: -1 },
          { x: w, y: -1 },
          { x: w, y: h },
          { x: -1, y: h }
        ]
      ]
    }

    const adj = new Map<string, number[]>()
    const keyOf = (p: Pt): string => `${Math.round(p.x * 2)}_${Math.round(p.y * 2)}`
    for (let i = 0; i < segs.length; i++) {
      const k1 = keyOf(segs[i].a)
      const k2 = keyOf(segs[i].b)
      let l1 = adj.get(k1)
      if (!l1) {
        l1 = []
        adj.set(k1, l1)
      }
      l1.push(i)
      let l2 = adj.get(k2)
      if (!l2) {
        l2 = []
        adj.set(k2, l2)
      }
      l2.push(i)
    }

    const used = new Uint8Array(segs.length)
    const loops: Pt[][] = []

    for (let s = 0; s < segs.length; s++) {
      if (used[s]) continue
      const loop: Pt[] = []
      let curSeg = s
      let cur: Pt = segs[s].a
      for (;;) {
        used[curSeg] = 1
        const seg = segs[curSeg]
        const k = keyOf(cur)
        if (keyOf(seg.a) === k) {
          loop.push(seg.a)
          cur = seg.b
        } else {
          loop.push(seg.b)
          cur = seg.a
        }
        const candidates = adj.get(keyOf(cur)) ?? []
        let next = -1
        for (const si of candidates) {
          if (!used[si]) {
            next = si
            break
          }
        }
        if (next < 0) break
        curSeg = next
      }
      if (keyOf(loop[0]) === keyOf(loop[loop.length - 1])) loop.pop()
      if (loop.length >= 3) {
        loops.push(loop)
      }
    }

    for (const loop of loops) {
      for (const p of loop) {
        p.x -= 0.5
        p.y -= 0.5
      }
    }

    return loops
  }

  private decimate(pts: Pt[]): Pt[] {
    const n = pts.length
    if (n < 6) return pts
    const out: Pt[] = []
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n]
      const p = pts[i]
      const b = pts[(i + 1) % n]
      if (pointToSegmentDist(p, a, b) > 0.25 || i % 8 === 0) {
        out.push(p)
      }
    }
    return out.length >= 4 ? out : pts.slice()
  }

  private simplify(pts: Pt[], tol: number): Pt[] {
    const n = pts.length
    if (n <= 4) return pts
    let minX = Infinity
    let maxX = -Infinity
    let iMin = 0
    let iMax = 0
    for (let i = 0; i < n; i++) {
      if (pts[i].x < minX) {
        minX = pts[i].x
        iMin = i
      }
      if (pts[i].x > maxX) {
        maxX = pts[i].x
        iMax = i
      }
    }
    if (iMin === iMax) return pts

    const chainA = this.chain(pts, iMin, iMax)
    const chainB = this.chain(pts, iMax, iMin)
    const keepA = this.douglasPeucker(chainA, tol)
    const keepB = this.douglasPeucker(chainB, tol)

    const result: Pt[] = []
    for (let i = 0; i < keepA.length - 1; i++) result.push(keepA[i])
    for (let i = 0; i < keepB.length - 1; i++) result.push(keepB[i])
    return result
  }

  private chain(pts: Pt[], from: number, to: number): Pt[] {
    const out: Pt[] = []
    let i = from
    for (;;) {
      out.push(pts[i])
      if (i === to) break
      i = (i + 1) % pts.length
    }
    return out
  }

  private douglasPeucker(chain: Pt[], tol: number): Pt[] {
    const m = chain.length
    if (m <= 2) return chain.slice()
    const keep = new Uint8Array(m)
    keep[0] = 1
    keep[m - 1] = 1
    const stack: Array<[number, number]> = [[0, m - 1]]
    while (stack.length > 0) {
      const [lo, hi] = stack.pop()!
      let maxD = -1
      let idx = -1
      const a = chain[lo]
      const b = chain[hi]
      for (let i = lo + 1; i < hi; i++) {
        const d = pointToSegmentDist(chain[i], a, b)
        if (d > maxD) {
          maxD = d
          idx = i
        }
      }
      if (maxD > tol && idx > lo) {
        keep[idx] = 1
        stack.push([lo, idx])
        stack.push([idx, hi])
      }
    }
    const out: Pt[] = []
    for (let i = 0; i < m; i++) if (keep[i]) out.push(chain[i])
    return out
  }

  private walk(pts: Pt[], i: number, dir: number, scale: number): number {
    const n = pts.length
    let j = i
    let acc = 0
    for (let s = 0; s < 64; s++) {
      const k = (j + dir + n) % n
      if (k === i) return j
      acc += Math.hypot(pts[k].x - pts[j].x, pts[k].y - pts[j].y)
      if (acc >= scale) return k
      j = k
    }
    return j
  }

  private cornerness(pts: Pt[], i: number, j1: number, j2: number): number {
    const p = pts[i]
    const a = pts[j1]
    const b = pts[j2]
    const ax = p.x - a.x
    const ay = p.y - a.y
    const bx = b.x - p.x
    const by = b.y - p.y
    const l1 = Math.hypot(ax, ay)
    const l2 = Math.hypot(bx, by)
    if (l1 < 1e-6 || l2 < 1e-6) return 180
    const cosA = clamp((ax * bx + ay * by) / (l1 * l2), -1, 1)
    return (Math.acos(cosA) * 180) / Math.PI
  }

  private laplacianPass(
    pts: Pt[],
    lambda: number,
    cornerScale: number,
    maxDisp: number
  ): Pt[] {
    const n = pts.length
    if (n < 5) return pts
    const out = new Array<Pt>(n)
    for (let i = 0; i < n; i++) {
      const p = pts[i]
      const j1 = this.walk(pts, i, -1, cornerScale)
      const j2 = this.walk(pts, i, 1, cornerScale)
      const a = pts[j1]
      const b = pts[j2]
      let dx = (a.x + b.x) / 2 - p.x
      let dy = (a.y + b.y) / 2 - p.y
      const dl = Math.hypot(dx, dy)
      if (dl > maxDisp) {
        dx *= maxDisp / dl
        dy *= maxDisp / dl
      }
      const cLocal = this.cornerness(pts, i, j1, j2)
      const g1 = this.walk(pts, i, -1, cornerScale * 2)
      const g2 = this.walk(pts, i, 1, cornerScale * 2)
      const cGlobal = this.cornerness(pts, i, g1, g2)
      const isRealCorner = cGlobal > 120
      const w = isRealCorner
        ? 1 - Math.min(0.92, Math.max(0, cLocal / 130))
        : cLocal > 150
          ? 1.25
          : 1
      out[i] = { x: p.x + lambda * w * dx, y: p.y + lambda * w * dy }
    }
    return out
  }

  private removeSpikes(pts: Pt[]): Pt[] {
    let cur = pts.slice()
    for (let pass = 0; pass < 8; pass++) {
      const m = cur.length
      if (m < 6) break
      let removed = false
      const next: Pt[] = []
      for (let i = 0; i < m; i++) {
        const j1 = this.walk(cur, i, -1, 1.0)
        const j2 = this.walk(cur, i, 1, 1.0)
        if (j1 === i || j2 === i) {
          next.push(cur[i])
          continue
        }
        const chord = Math.hypot(cur[j2].x - cur[j1].x, cur[j2].y - cur[j1].y)
        const c = this.cornerness(cur, i, j1, j2)
        if (c > 140 && chord < 2.5) {
          removed = true
          continue
        }
        next.push(cur[i])
      }
      cur = next
      if (!removed) break
    }
    return cur.length >= 4 ? cur : pts.slice()
  }

  private removeBumps(pts: Pt[]): Pt[] {
    let cur = pts.slice()
    for (let pass = 0; pass < 6; pass++) {
      const m = cur.length
      if (m < 6) break
      const j1 = new Array<number>(m)
      const j2 = new Array<number>(m)
      const arc = new Array<number>(m)
      for (let i = 0; i < m; i++) {
        j1[i] = this.walk(cur, i, -1, 3.0)
        j2[i] = this.walk(cur, i, 1, 3.0)
        if (j1[i] === i || j2[i] === i) continue
        let a = 0
        let k = j1[i]
        for (let guard = 0; k !== j2[i] && guard <= m; guard++) {
          const nk = (k + 1) % m
          a += Math.hypot(cur[nk].x - cur[k].x, cur[nk].y - cur[k].y)
          k = nk
        }
        arc[i] = a
      }
      let removed = false
      const keep = new Uint8Array(m).fill(1)
      for (let i = 0; i < m; i++) {
        const a1 = j1[i]
        const a2 = j2[i]
        if (a1 === i || a2 === i) continue
        const chord = Math.hypot(cur[a2].x - cur[a1].x, cur[a2].y - cur[a1].y)
        if (arc[i] > 3.0 && chord < 0.6 * arc[i]) {
          for (let k = (a1 + 1) % m; k !== a2; k = (k + 1) % m) {
            keep[k] = 0
          }
          removed = true
        }
      }
      const next: Pt[] = []
      for (let i = 0; i < m; i++) if (keep[i]) next.push(cur[i])
      cur = next
      if (!removed) break
    }
    return cur.length >= 4 ? cur : pts.slice()
  }

  private smoothLoop(pts: Pt[], o: Required<MatteRefineOptions>): Pt[] {
    if (pts.length < 5) return pts
    let cur = this.removeSpikes(pts)
    cur = this.removeBumps(cur)
    cur = this.decimate(cur)
    cur = this.simplify(cur, o.simplifyTolerance)
    for (let it = 0; it < o.smoothingIterations; it++) {
      cur = this.laplacianPass(cur, o.smoothingLambda, o.cornerScale, o.maxDisplacement)
    }
    return removeCollinear(cur)
  }

  private signedDistanceField(inside: Uint8Array, w: number, h: number): Float64Array {
    const size = w * h
    const INF = 1 << 20
    const d = new Float64Array(size)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (!inside[i]) {
          d[i] = INF
          continue
        }
        const isEdge =
          x === 0 ||
          !inside[i - 1] ||
          x === w - 1 ||
          !inside[i + 1] ||
          y === 0 ||
          !inside[i - w] ||
          y === h - 1 ||
          !inside[i + w]
        d[i] = isEdge ? 0 : INF
      }
    }
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
    for (let i = 0; i < size; i++) {
      if (!inside[i]) d[i] = -d[i]
    }
    return d
  }

  private fuzziness(
    soft: Float32Array,
    signedD: Float64Array,
    w: number,
    h: number
  ): Float32Array {
    const partial = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) {
      const a = soft[i]
      partial[i] = a > 0.05 && a < 0.95 ? 1 : 0
    }
    const blurred = boxBlur(partial, w, h, 4)
    const score = new Float32Array(w * h)
    const bandLimit = 9 * CHAMFER_SCALE
    for (let i = 0; i < w * h; i++) {
      score[i] = Math.abs(signedD[i]) <= bandLimit ? blurred[i] : 0
    }
    return score
  }

  private buildAlpha(
    soft: Float32Array,
    binary: Uint8Array,
    w: number,
    h: number,
    o: Required<MatteRefineOptions>
  ): { alpha: Float32Array; core: Float32Array } {
    const area = w * h
    const signedD = this.signedDistanceField(binary, w, h)
    const alpha = new Float32Array(area)

    for (let i = 0; i < area; i++) {
      let a = soft[i]
      if (a <= 0.001) {
        alpha[i] = 0
        continue
      }

      if (binary[i]) {
        if (a <= o.binaryThreshold) a = 0.999
      } else {
        const outsideDist = -signedD[i]
        if (outsideDist > o.clearDist) {
          a = 0
        } else if (outsideDist > o.keepDist) {
          const t = (outsideDist - o.keepDist) / (o.clearDist - o.keepDist)
          a *= 1 - t * t * (3 - 2 * t)
        }
        if (a < 0.015) a = 0
      }

      alpha[i] = clamp(a, 0, 1)
    }

    const core = new Float32Array(area)
    for (let i = 0; i < area; i++) {
      core[i] = alpha[i] >= 0.999 ? 1 : 0
    }

    return { alpha, core }
  }

  private fuzzIndicator(alpha: Float32Array, w: number, h: number): Float32Array {
    const out = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) {
      const a = alpha[i]
      out[i] = a > 0.05 && a < 0.95 ? 1 : 0
    }
    return out
  }

  private validate(
    alpha: Float32Array,
    fuzz: Float32Array,
    w: number,
    h: number
  ): { spikes: number; sawtooth: number; maxAlphaGradient: number; edgeBandPixels: number } {
    const bin = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
      bin[i] = alpha[i] >= 0.5 ? 1 : 0
    }
    const contours = this.extractContours(bin, w, h)

    let spikes = 0
    let sawAcc = 0
    let sawN = 0
    let edgeBandPixels = 0

    for (const c of contours) {
      const n = c.length
      if (n < 6) continue
      for (let i = 0; i < n; i++) {
        const q = c[i]
        const fx = clamp(Math.round(q.x), 0, w - 1)
        const fy = clamp(Math.round(q.y), 0, h - 1)
        if (fuzz[fy * w + fx] > 0.6) continue
        const j1 = this.walk(c, i, -1, 1.5)
        const j2 = this.walk(c, i, 1, 1.5)
        if (this.cornerness(c, i, j1, j2) > 150) spikes++
        const p = c[(i - 1 + n) % n]
        const r = c[(i + 1) % n]
        sawAcc += Math.hypot(r.x - 2 * q.x + p.x, r.y - 2 * q.y + p.y)
        sawN++
      }
    }
    const sawtooth = sawN > 0 ? sawAcc / sawN : 0

    let maxGrad = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        const a = alpha[i]
        if (a < 0.01 || a > 0.99) continue
        edgeBandPixels++
        if (x > 0) {
          const g = Math.abs(a - alpha[i - 1])
          if (g > maxGrad) maxGrad = g
        }
        if (x < w - 1) {
          const g = Math.abs(a - alpha[i + 1])
          if (g > maxGrad) maxGrad = g
        }
        if (y > 0) {
          const g = Math.abs(a - alpha[i - w])
          if (g > maxGrad) maxGrad = g
        }
        if (y < h - 1) {
          const g = Math.abs(a - alpha[i + w])
          if (g > maxGrad) maxGrad = g
        }
      }
    }

    return { spikes, sawtooth, maxAlphaGradient: maxGrad, edgeBandPixels }
  }
}
