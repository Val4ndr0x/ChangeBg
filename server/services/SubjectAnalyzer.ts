import { InferenceSession, Tensor } from 'onnxruntime-node'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'

const MODEL_PATH = path.resolve('server/models/modnet.onnx')
// MODNet a baja resolución (múltiplos de 32): suficiente para ubicar a la persona y es rápido.
const W = 224
const H = 384
const FPS = 8
const MAX_SECONDS = 26

interface Sample {
  present: boolean
  cx: number
  cy: number
  /** Alto de la persona (0–1 del cuadro). */
  h: number
  /** 1 = cuerpo completo bien encuadrado, 0.4 = recortada (sin piernas/cabeza), 0 = no se ve. */
  good: number
  /** Cuánto cambia la silueta respecto al muestreo anterior (0–1): poses y movimiento. */
  action: number
}

/** Dónde está la persona y qué tan buena es la toma, a lo largo del video original. */
export class Subject {
  private readonly samples: Sample[]

  constructor(samples: Sample[]) {
    this.samples = samples
  }

  get seconds(): number {
    return this.samples.length / FPS
  }

  private at(t: number): Sample {
    const i = Math.min(this.samples.length - 1, Math.max(0, Math.round(t * FPS)))
    return this.samples[i]!
  }

  good(t: number): number {
    return this.at(t).good
  }

  /** Calidad media del tramo [a, b]. */
  goodBetween(a: number, b: number): number {
    const i0 = Math.max(0, Math.floor(Math.min(a, b) * FPS))
    const i1 = Math.min(this.samples.length - 1, Math.ceil(Math.max(a, b) * FPS))
    let sum = 0
    for (let i = i0; i <= i1; i++) sum += this.samples[i]!.good
    return sum / (i1 - i0 + 1)
  }

  action(t: number): number {
    return this.at(t).action
  }

  /** Centro de la persona, su alto (0–1 del cuadro) y el zoom máximo que aún deja su cuerpo entero. */
  frame(t: number): { present: boolean, cx: number, cy: number, h: number, zoomCap: number } {
    const s = this.at(t)
    if (!s.present) return { present: false, cx: 0.5, cy: 0.5, h: 0, zoomCap: 1 }
    return { present: true, cx: s.cx, cy: s.cy, h: s.h, zoomCap: Math.min(2.2, Math.max(1, 0.92 / Math.max(0.2, s.h))) }
  }
}

const smooth = (a: number[], r: number) =>
  a.map((_, i) => {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - r); j <= Math.min(a.length - 1, i + r); j++) { sum += a[j]!; n++ }
    return sum / n
  })

/**
 * Analiza el video (primeros ~26 s) con MODNet para saber dónde está la persona,
 * si se le ve el cuerpo completo y cuándo hace poses o se mueve. Devuelve undefined
 * si no se puede (modelo ausente, ffmpeg falla…): el módulo sigue sin esta ayuda.
 */
export async function analyzeSubject(file: string, duration: number): Promise<Subject | undefined> {
  try {
    await fs.access(MODEL_PATH)
    const seconds = Math.min(duration, MAX_SECONDS)
    const raw = await new Promise<Buffer>((resolve, reject) => {
      const p = spawn('ffmpeg', [
        '-v', 'error', '-t', String(seconds), '-i', file,
        '-vf', `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
        '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'
      ])
      const chunks: Buffer[] = []
      p.stdout.on('data', (d) => chunks.push(d))
      p.on('error', reject)
      p.on('close', () => resolve(Buffer.concat(chunks)))
    })
    const plane = W * H
    const frames = Math.floor(raw.length / (plane * 3))
    if (frames < FPS) return undefined

    const session = await InferenceSession.create(MODEL_PATH, {
      intraOpNumThreads: 2,
      interOpNumThreads: 1,
      enableCpuMemArena: false
    })
    const raws: Omit<Sample, 'action'>[] = []
    const motion: number[] = []
    let prev: Uint8Array | null = null
    try {
      for (let f = 0; f < frames; f++) {
        const input = new Float32Array(3 * plane)
        const base = f * plane * 3
        for (let i = 0; i < plane; i++) {
          input[i] = raw[base + i * 3]! / 127.5 - 1
          input[plane + i] = raw[base + i * 3 + 1]! / 127.5 - 1
          input[2 * plane + i] = raw[base + i * 3 + 2]! / 127.5 - 1
        }
        const out = await session.run({ [session.inputNames[0]!]: new Tensor('float32', input, [1, 3, H, W]) })
        const matte = out[session.outputNames[0]!]!.data as Float32Array

        const mask = new Uint8Array(plane)
        const rows = new Int32Array(H)
        let area = 0
        let sx = 0
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (matte[y * W + x]! > 0.5) { mask[y * W + x] = 1; rows[y]!++; area++; sx += x }
          }
        }
        let y0 = -1
        let y1 = -1
        for (let y = 0; y < H; y++) if (rows[y]! >= 4) { if (y0 < 0) y0 = y; y1 = y }
        const present = area / plane > 0.03 && y0 >= 0
        const h = present ? (y1 - y0 + 1) / H : 0
        const fullBody = present && y0 / H > 0.015 && y1 / H < 0.985 && h >= 0.35
        raws.push({
          present,
          cx: present ? sx / area / W : 0.5,
          cy: present ? (y0 + y1) / 2 / H : 0.5,
          h,
          good: !present ? 0 : fullBody ? 1 : 0.4
        })
        let diff = 0
        if (prev) for (let i = 0; i < plane; i++) diff += mask[i]! ^ prev[i]!
        motion.push(prev ? diff / plane : 0)
        prev = mask
      }
    } finally {
      await session.release()
    }

    const sorted = [...motion].sort((a, b) => a - b)
    const ref = Math.max(1e-4, sorted[Math.floor(sorted.length * 0.9)] ?? 1e-4)
    const action = smooth(motion.map((m) => Math.min(1, m / ref)), 1)
    const cx = smooth(raws.map((r) => r.cx), 2)
    const cy = smooth(raws.map((r) => r.cy), 2)
    const h = smooth(raws.map((r) => r.h), 2)
    return new Subject(raws.map((r, i) => ({ ...r, cx: cx[i]!, cy: cy[i]!, h: r.present ? h[i]! : 0, action: action[i]! })))
  } catch {
    return undefined
  }
}
