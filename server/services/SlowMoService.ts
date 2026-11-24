import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { analyzeSubject, type Subject } from './SubjectAnalyzer'

const execFileAsync = promisify(execFile)

export const SLOWMO_DIR = path.resolve('server/slowmo')
export const SLOWMO_MUSIC_DIR = path.join(SLOWMO_DIR, 'music')
const WORK_DIR = path.join(SLOWMO_DIR, 'jobs')
/** Tarjeta final (imagen con los logos); se muestra al cierre como en las referencias. */
export const OUTRO_CARD = path.join(SLOWMO_DIR, 'outro', 'card.png')
const OUTRO_S = 1.1

// Salida igual a las referencias: vertical 1080x1920, 30 fps, ~10 s.
const OUT_W = 1080
const OUT_H = 1920
const OUT_FPS = 30
const TARGET_SECONDS = 10
// Por debajo de esta densidad (fps de origen / lentitud) hay que inventar fotogramas
// (minterpolate a 540x960: ~0.06 s por fotograma, unos 20 s por video de 30 fps).
const MIN_NATIVE_FPS = 45
const MAX_SLOWDOWN = 8
const ZOOM = 0.18
/** Cuánto del alto del cuadro debe ocupar la persona al acercarla cuando se ve lejos. */
const FILL = 0.72

export const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac']

export interface SlowMoOptions {
  /** Nombre de un archivo de la carpeta de música (opcional). */
  music?: string
  /** Alto de la persona que se busca al acercar (0.4–0.9 del cuadro). */
  fill?: number
  /** Usar la detección de persona (por defecto sí). */
  track?: boolean
  /** Incluye rebobinados hacia atrás (por defecto sí). */
  rewind?: boolean
  /** Agrega la tarjeta final con logos (por defecto sí, si hay una guardada). */
  outro?: boolean
  /** Segundo de la canción desde el que empieza a sonar. */
  musicStart?: number
  /** Multiplicador del acercamiento (0 = sin zoom). */
  zoom?: number
}

export type JobStatus = 'queued' | 'processing' | 'done' | 'error'

export interface SlowMoJob {
  id: string
  status: JobStatus
  progress: number
  message?: string
  outputName?: string
}

const jobs = new Map<string, SlowMoJob>()

export function getJob(id: string): SlowMoJob | undefined {
  return jobs.get(id)
}

export function jobOutputPath(id: string): string {
  return path.join(WORK_DIR, `${id}.mp4`)
}

export async function listMusic(): Promise<string[]> {
  await fs.mkdir(SLOWMO_MUSIC_DIR, { recursive: true })
  const files = await fs.readdir(SLOWMO_MUSIC_DIR)
  return files.filter((f) => AUDIO_EXT.includes(path.extname(f).toLowerCase())).sort()
}

interface Probe { duration: number; fps: number }

async function probe(file: string): Promise<Probe> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=avg_frame_rate,r_frame_rate:format=duration',
    '-of', 'json', file
  ]).catch((e: NodeJS.ErrnoException) => {
    throw new Error(e.code === 'ENOENT' ? 'ffmpeg no está instalado en este equipo.' : 'El archivo no parece un video válido.')
  })
  const data = JSON.parse(stdout)
  const rate = (s: string) => {
    const [n, d] = String(s).split('/').map(Number)
    return d ? n! / d : 0
  }
  const stream = data.streams?.[0]
  const fps = rate(stream?.avg_frame_rate) || rate(stream?.r_frame_rate)
  const duration = Number(data.format?.duration)
  if (!stream || !duration || !fps) throw new Error('El archivo no parece un video válido.')
  return { duration, fps }
}

// ---------------------------------------------------------------------------
// Ritmo: como en las referencias, la velocidad alterna entre tramos rápidos y
// lentos en ciclos de 4 tiempos de la música (el cambio cae sobre el beat).
// ---------------------------------------------------------------------------

export interface Beat {
  /** Segundos entre tiempos. */
  period: number
  /** Segundo (dentro del fragmento de música usado) del primer tiempo marcado. */
  phase: number
}

const BEATS_PER_CYCLE = 4
const FALLBACK_CYCLE_S = 1.9
/** Relación velocidad lenta / rápida (las referencias mueven ~5x más rápido en los golpes). */
const SLOW_RATIO = 0.2
const MIN_SPEED = 1 / MAX_SLOWDOWN
const MAX_SOURCE_CAP = 20
/** Segundos del video que se analizan (ver SubjectAnalyzer). */
const MAX_ANALYZE = 26
const GRID = 0.1
/** Duración del golpe de zoom tras cada repetición (s). */
const PUNCH_S = 0.55

/** Detecta tempo y fase del primer beat en los primeros segundos de la pista (desde `start`). */
export async function detectBeat(file: string, start: number): Promise<Beat | undefined> {
  const SR = 11025
  const HOP = 220 // 50 mediciones por segundo
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-ss', String(start), '-t', '14', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'])
    const chunks: Buffer[] = []
    p.stdout.on('data', (d) => chunks.push(d))
    p.on('error', reject)
    p.on('close', () => resolve(Buffer.concat(chunks)))
  }).catch(() => Buffer.alloc(0))

  const n = Math.floor(raw.length / 2 / HOP)
  if (n < 150) return undefined
  const env: number[] = []
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (let j = 0; j < HOP; j++) { const v = raw.readInt16LE((i * HOP + j) * 2); sum += v * v }
    env.push(Math.sqrt(sum / HOP))
  }
  const onset = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? v)))
  const mean = onset.reduce((a, b) => a + b, 0) / n

  const fps = SR / HOP
  let best = { lag: 0, score: -1 }
  for (let lag = Math.round(fps * 0.34); lag <= Math.round(fps * 0.9); lag++) { // 67–176 BPM
    let score = 0
    for (let i = 0; i + lag < n; i++) score += (onset[i]! - mean) * (onset[i + lag]! - mean)
    if (score > best.score) best = { lag, score }
  }
  if (!best.lag) return undefined

  let phase = { off: 0, score: -1 }
  for (let off = 0; off < best.lag; off++) {
    let score = 0
    for (let i = off; i < n; i += best.lag) score += onset[i]!
    if (score > phase.score) phase = { off, score }
  }
  return { period: best.lag / fps, phase: phase.off / fps }
}

/** Tramo continuo del original (sin saltos); un salto atrás empieza un tramo nuevo. */
export interface Run {
  /** Segundo del original donde empieza y termina. */
  from: number
  to: number
  /** Segundo de salida donde empieza (para el zoom del corte). */
  outStart: number
  /** Se reproduce hacia atrás (rewind). */
  reverse: boolean
  /** Lleva golpe de zoom al empezar. */
  punch: boolean
  /** Segundo de salida de cada segundo del tramo (relativo a su inicio), en sintaxis de ffmpeg. */
  expr: string
}

/** Punto del recorrido: a qué segundo del original corresponde cada segundo de salida. */
export interface TrackPoint {
  tau: number
  src: number
  /** 1 = tramo lento del ritmo, 0 = tramo rápido. */
  slow: number
}

export interface PlanContext {
  /** Segundo del original donde empieza el fragmento usado. */
  offset: number
  subject?: Subject
}

export interface RhythmPlan {
  track: TrackPoint[]
  runs: Run[]
  outSeconds: number
  /** Velocidad mínima (1 = normal); define cuánto hay que interpolar. */
  minSpeed: number
}

/** Cada cuántos ciclos se repite la escena, y cuántos segundos de original se retroceden. */
const REPLAY_EVERY_CYCLES = 1
const REPLAY_BACK_S = 0.9
/** Lo que dura el rewind (s de salida): rebobina rápido los REPLAY_BACK_S y vuelve a avanzar. */
const REWIND_S = 0.35
const REPLAY_FREE_START_S = 1.5
const REPLAY_FREE_END_S = 1.5
/** Una repetición solo se hace si el tramo repetido se ve bien (cuerpo completo). */
const MIN_REPLAY_QUALITY = 0.55
/** Los tramos malos (sin persona o mal encuadrados) pasan más rápido. */
const BAD_BOOST = 2.4

export function planRhythm(srcSeconds: number, beat?: Beat, replays = true, target = TARGET_SECONDS, rewind = true, ctx: PlanContext = { offset: 0 }): RhythmPlan {
  const len = Math.min(srcSeconds, MAX_SOURCE_CAP)
  const { offset, subject } = ctx
  const cycle = beat ? beat.period * BEATS_PER_CYCLE : FALLBACK_CYCLE_S
  const phase = beat ? beat.phase : 0
  const sstep = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c) }
  const ramp = 0.12
  // Forma de 0 (lento) a 1 (rápido); el tramo rápido arranca sobre el beat.
  const shape = (tau: number) => {
    const p = (((tau - phase) / cycle) % 1 + 1) % 1
    return p < 0.5 ? sstep(p / ramp) : sstep(1 - (p - 0.5) / ramp)
  }
  const u = (tau: number) => SLOW_RATIO + (1 - SLOW_RATIO) * shape(tau)

  // Instantes de salida en que la escena salta atrás (sobre el beat de inicio de ciclo).
  const cuts: number[] = []
  if (replays) {
    for (let m = 0, t = phase; t < target - REPLAY_FREE_END_S; m++, t += cycle) {
      if (t >= REPLAY_FREE_START_S && m % REPLAY_EVERY_CYCLES === 0) cuts.push(t)
    }
  }

  const simulate = (k: number) => {
    type Step = { a: number, b: number, dt: number }
    type R = { from: number, to: number, outStart: number, steps: Step[], reverse: boolean, punch: boolean }
    const runs: R[] = []
    const track: TrackPoint[] = []
    let s = 0
    let tau = 0
    let nextCut = 0
    let cutCount = 0
    let run: R = { from: 0, to: 0, outStart: 0, steps: [], reverse: false, punch: false }
    while (tau < target - 1e-6 && s < len - 1e-6) {
      if (nextCut < cuts.length && tau >= cuts[nextCut]! - 1e-6) {
        nextCut++
        const back = Math.max(0, s - REPLAY_BACK_S)
        if (s - back > 0.2 && (!subject || subject.goodBetween(offset + back, offset + s) >= MIN_REPLAY_QUALITY)) {
          run.to = s
          runs.push(run)
          // Cada segundo corte rebobina (hacia atrás, rápido) antes de repetir la escena.
          const doRewind = rewind && cutCount++ % 2 === 1
          if (doRewind) {
            runs.push({ from: back, to: s, outStart: tau, steps: [{ a: 0, b: s - back, dt: REWIND_S }], reverse: true, punch: true })
            for (let i = 0; i < 4; i++) track.push({ tau: tau + (REWIND_S * (i + 0.5)) / 4, src: offset + s - ((s - back) * (i + 0.5)) / 4, slow: 0 })
            tau += REWIND_S
          }
          s = back
          run = { from: s, to: s, outStart: tau, steps: [], reverse: false, punch: !doRewind }
        }
      }
      const boost = subject && subject.good(offset + s) < 0.2 ? BAD_BOOST : 1
      const full = k * u(tau + GRID / 2) * GRID * boost
      const frac = Math.min(1, (len - s) / full, (target - tau) / GRID)
      run.steps.push({ a: s, b: s + full * frac, dt: GRID * frac })
      track.push({ tau: tau + (GRID * frac) / 2, src: offset + s + (full * frac) / 2, slow: 1 - shape(tau + GRID / 2) })
      s += full * frac
      tau += GRID * frac
    }
    run.to = s
    runs.push(run)
    return { runs, s, tau, track }
  }

  // Busca el mayor ritmo k con el que el original dura los 10 s completos (si se agota antes, k es muy alto).
  let lo = 0.02
  let hi = 20
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (simulate(mid).tau >= target - 1e-6) lo = mid
    else hi = mid
  }
  let k = lo
  if (k * SLOW_RATIO < MIN_SPEED) k = MIN_SPEED / SLOW_RATIO // clip corto: dura menos de 10 s
  const sim = simulate(k)

  const f = (x: number) => x.toFixed(5)
  const runs: Run[] = sim.runs.map((r) => {
    const terms = r.steps.map((st) => {
      const a = st.a - r.from
      const b = st.b - r.from
      const slope = st.dt / (b - a)
      return `${f(slope)}*(clip(PTS*TB\\,${f(a)}\\,${f(b)})-${f(a)})`
    })
    const expr = r.reverse ? `${f(r.steps[0]!.dt / (r.to - r.from))}*PTS` : `(${terms.join('+')})/TB`
    return { from: r.from + offset, to: r.to + offset, outStart: r.outStart, reverse: r.reverse, punch: r.punch, expr }
  })
  return { runs, track: sim.track, outSeconds: sim.tau, minSpeed: k * SLOW_RATIO }
}

/** Qué tan bien cae el plan: lo lento sobre poses/movimiento con cuerpo completo, y poco tiempo en tomas malas. */
export function scorePlan(plan: RhythmPlan, subject: Subject): number {
  let score = 0
  for (const pt of plan.track) {
    const good = subject.good(pt.src)
    score += 0.35 * good + pt.slow * good * (0.8 + 1.4 * subject.action(pt.src)) - 0.8 * (1 - good)
  }
  return score
}

const TRACK_STEP = 0.2

/** Curva lineal por tramos de `values` (una por TRACK_STEP s de salida) en sintaxis de ffmpeg (variable t). */
function piecewise(values: number[]): string {
  const f = (x: number) => x.toFixed(4)
  return values.slice(1).reduce(
    (acc, v, i) => `${acc}+${f(v - values[i]!)}*clip((t-${f(i * TRACK_STEP)})/${f(TRACK_STEP)}\\,0\\,1)`,
    f(values[0]!)
  )
}

/** Zoom máximo para acercar a la persona cuando se ve lejos (en la práctica lo limita el cuerpo entero en cuadro). */
const MAX_FIT_ZOOM = 2

/**
 * Centro de la persona, zoom que la llena hasta `fill` del alto del cuadro y zoom máximo
 * que aún deja su cuerpo entero, a lo largo de la salida, en expresiones de ffmpeg.
 */
function trackExpr(plan: RhythmPlan, subject: Subject, fill: number) {
  const n = Math.ceil(plan.outSeconds / TRACK_STEP) + 1
  const cx: number[] = []
  const cy: number[] = []
  const cap: number[] = []
  const fit: number[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const tau = i * TRACK_STEP
    while (j < plan.track.length - 1 && Math.abs(plan.track[j + 1]!.tau - tau) <= Math.abs(plan.track[j]!.tau - tau)) j++
    const fr = subject.frame(plan.track[j]?.src ?? 0)
    cx.push(fr.cx); cy.push(fr.cy); cap.push(fr.zoomCap)
    fit.push(fr.present ? Math.min(MAX_FIT_ZOOM, Math.max(1, fill / fr.h)) : 1)
  }
  // El zoom cambia con suavidad (media de ±0.4 s) para que no se sienta a tirones.
  const avg = (a: number[]) => a.map((_, i) => {
    const w = a.slice(Math.max(0, i - 2), i + 3)
    return w.reduce((x, y) => x + y, 0) / w.length
  })
  return { cx: piecewise(cx), cy: piecewise(cy), cap: piecewise(avg(cap)), fit: piecewise(avg(fit)) }
}

function buildArgs(input: string, output: string, p: Probe, opts: SlowMoOptions, plan: RhythmPlan, musicPath?: string, outro = false, subject?: Subject) {
  const { runs, outSeconds: bodySeconds } = plan
  const outSeconds = bodySeconds + (outro ? OUTRO_S : 0)
  const zoom = Math.max(0, Math.min(0.4, opts.zoom ?? ZOOM))
  const needsInterp = p.fps * plan.minSpeed < MIN_NATIVE_FPS

  // Zoom de fondo (empuje lento) + golpe de zoom que decae en cada repetición.
  const x = `clip(t/${bodySeconds.toFixed(4)}\\,0\\,1)`
  const punches = runs.slice(1).filter((r) => r.punch).map((r) =>
    `+gte(t\\,${r.outStart.toFixed(4)})*${zoom * 0.8}*pow(max(0\\,1-(t-${r.outStart.toFixed(4)})/${PUNCH_S})\\,2)`
  ).join('')
  const zd = `(1+${zoom}*(3*pow(${x}\\,2)-2*pow(${x}\\,3))${punches})`
  // Con la persona ubicada: el zoom nunca pasa de lo que deja su cuerpo entero en cuadro y el
  // encuadre la sigue (en vez de cortar siempre al centro).
  const fill = Math.max(0.4, Math.min(0.9, opts.fill ?? FILL))
  const tr = subject ? trackExpr(plan, subject, fill) : undefined
  const z = tr ? `min((${tr.fit})*${zd}\\,${tr.cap})` : zd
  const crop = tr
    ? `crop=${OUT_W}:${OUT_H}:x='clip((${tr.cx})*iw-${OUT_W}/2\\,0\\,iw-${OUT_W})':y='clip((${tr.cy})*ih-${OUT_H}/2\\,0\\,ih-${OUT_H})'`
    : `crop=${OUT_W}:${OUT_H}`

  const args = ['-y', '-v', 'error', '-nostats', '-progress', 'pipe:1']
  // Un input por tramo: así no se guardan en memoria los fotogramas de todos a la vez.
  for (const r of runs) args.push('-ss', r.from.toFixed(4), '-t', (r.to - r.from + (r.reverse ? 0 : 0.05)).toFixed(4), '-i', input)
  if (outro) args.push('-loop', '1', '-framerate', String(OUT_FPS), '-t', String(OUTRO_S), '-i', OUTRO_CARD)
  const card = runs.length
  const music = runs.length + (outro ? 1 : 0)
  if (musicPath) args.push('-stream_loop', '-1', '-ss', String(Math.max(0, opts.musicStart ?? 0)), '-i', musicPath)

  const prep = runs.map((r, i) =>
    `[${i}:v]setpts=PTS-STARTPTS,scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,crop=${OUT_W}:${OUT_H}${r.reverse ? ',reverse,setpts=PTS-STARTPTS' : ''},setpts='${r.expr}'[r${i}]`
  )
  const joined = runs.length > 1
    ? `${runs.map((_, i) => `[r${i}]`).join('')}concat=n=${runs.length}:v=1:a=0`
    : '[r0]null'
  const tail = [
    // La interpolación se calcula a media resolución (4x más rápido); el escalado
    // posterior a 1080x1920 ya lo hace el zoom.
    ...(needsInterp ? [`scale=${OUT_W / 2}:${OUT_H / 2}`] : []),
    needsInterp
      ? `minterpolate=fps=${OUT_FPS}:mi_mode=mci:mc_mode=obmc:me_mode=bilat:me=hexbs:search_param=16:vsbmc=0`
      : `fps=${OUT_FPS}`,
    `scale=w='2*trunc(${OUT_W}*(${z})/2)':h='2*trunc(${OUT_H}*(${z})/2)':eval=frame`,
    crop,
    // Look de las referencias: oscuro, desaturado, tonos fríos y viñeta.
    'eq=contrast=1.1:brightness=-0.05:saturation=0.8:gamma=0.95',
    'colorbalance=rs=-0.03:bs=0.05:rm=-0.02:bm=0.03:rh=0.02:bh=-0.02',
    'vignette=angle=PI/4.5',
    'format=yuv420p'
  ].join(',')

  const graph = [...prep]
  if (outro) {
    graph.push(`${joined},${tail}[body]`)
    graph.push(`[${card}:v]scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=increase,crop=${OUT_W}:${OUT_H},setsar=1,fps=${OUT_FPS},format=yuv420p,fade=t=in:d=0.2[card]`)
    graph.push('[body][card]concat=n=2:v=1:a=0[v]')
  } else {
    graph.push(`${joined},${tail}[v]`)
  }
  if (musicPath) {
    const fade = Math.max(0, outSeconds - 1.5)
    graph.push(`[${music}:a]atrim=0:${outSeconds.toFixed(3)},afade=t=in:d=0.4,afade=t=out:st=${fade.toFixed(3)}:d=1.5[a]`)
  }
  args.push('-filter_complex', graph.join(';'), '-map', '[v]')
  if (musicPath) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k')
  else args.push('-an')
  args.push(
    '-t', outSeconds.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-r', String(OUT_FPS), '-movflags', '+faststart', output
  )
  return { args, outSeconds }
}

// Un video a la vez: minterpolate usa todos los núcleos y mucha RAM.
let chain: Promise<unknown> = Promise.resolve()

/** Reserva el archivo donde se guarda el video subido (se escribe en streaming, sin cargarlo en memoria). */
export async function reserveUpload(ext: string): Promise<{ id: string, file: string }> {
  await fs.mkdir(WORK_DIR, { recursive: true })
  await cleanupOldJobs()
  const id = randomUUID()
  return { id, file: path.join(WORK_DIR, `${id}-in${ext}`) }
}

export function startJob(id: string, input: string, opts: SlowMoOptions): SlowMoJob {
  const job: SlowMoJob = { id, status: 'queued', progress: 0 }
  jobs.set(id, job)

  const run = chain.then(() => process(job, input, opts))
  chain = run.catch(() => {})
  return job
}

async function process(job: SlowMoJob, input: string, opts: SlowMoOptions): Promise<void> {
  const output = jobOutputPath(job.id)
  try {
    job.status = 'processing'
    const p = await probe(input)

    let musicPath: string | undefined
    if (opts.music) {
      const name = path.basename(opts.music) // evita salir de la carpeta
      musicPath = path.join(SLOWMO_MUSIC_DIR, name)
      await fs.access(musicPath)
    }

    const beat = musicPath ? await detectBeat(musicPath, opts.musicStart ?? 0) : undefined
    const outro = opts.outro !== false && await fs.access(OUTRO_CARD).then(() => true, () => false)

    // Detecta a la persona para elegir el mejor tramo, repetir solo tomas buenas y encuadrarla.
    job.message = 'Analizando poses y tomas…'
    const subject = opts.track === false ? undefined : await analyzeSubject(input, p.duration)
    job.message = undefined
    const target = outro ? TARGET_SECONDS - OUTRO_S : TARGET_SECONDS
    const maxOffset = subject ? Math.max(0, Math.min(6, p.duration - 3, MAX_ANALYZE - 2)) : 0
    let plan: RhythmPlan | undefined
    let bestScore = -Infinity
    for (let off = 0; off <= maxOffset + 1e-6; off += 0.25) {
      const cand = planRhythm(p.duration - off, beat, true, target, opts.rewind !== false, { offset: off, subject })
      const sc = subject ? scorePlan(cand, subject) : 0
      if (!plan || sc > bestScore + 1e-6) { plan = cand; bestScore = sc }
    }
    const { args, outSeconds } = buildArgs(input, output, p, opts, plan!, musicPath, outro, subject)
    try {
      await runFfmpeg(args, outSeconds, (pct) => { job.progress = pct })
    } catch (first) {
      // Si falla la versión completa, se reintenta con la más simple (un solo tramo, sin
      // repeticiones ni seguimiento) para que el usuario no se quede sin video.
      console.error('[SlowMo] Falló el render completo, reintentando en modo simple:', (first as Error).message)
      const simple = planRhythm(p.duration, beat, false, target, false)
      const retry = buildArgs(input, output, p, opts, simple, musicPath, outro, undefined)
      job.progress = 0
      try {
        await runFfmpeg(retry.args, retry.outSeconds, (pct) => { job.progress = pct })
      } catch (second) {
        throw new Error(`${(first as Error).message} || Modo simple: ${(second as Error).message}`)
      }
    }

    job.progress = 1
    job.status = 'done'
    job.outputName = `slowmotion-${job.id.slice(0, 8)}.mp4`
  } catch (err: any) {
    job.status = 'error'
    job.message = err?.message ?? 'Error procesando el video'
    await fs.unlink(output).catch(() => {})
  } finally {
    await fs.unlink(input).catch(() => {})
  }
}

function runFfmpeg(args: string[], totalSeconds: number, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000) })
    proc.stdout.on('data', (d: Buffer) => {
      const m = [...d.toString().matchAll(/out_time_us=(\d+)/g)].pop()
      if (m) onProgress(Math.min(0.99, Number(m[1]) / 1e6 / totalSeconds))
    })
    proc.on('error', (e: NodeJS.ErrnoException) =>
      reject(new Error(e.code === 'ENOENT' ? 'ffmpeg no está instalado en este equipo.' : e.message)))
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg falló: ${stderr.trim().split('\n').slice(-4).join(' | ')}`)))
  })
}

const MAX_AGE_MS = 6 * 60 * 60 * 1000
async function cleanupOldJobs(): Promise<void> {
  const now = Date.now()
  for (const f of await fs.readdir(WORK_DIR).catch(() => [])) {
    const fp = path.join(WORK_DIR, f)
    const st = await fs.stat(fp).catch(() => null)
    if (st && now - st.mtimeMs > MAX_AGE_MS) {
      await fs.unlink(fp).catch(() => {})
      jobs.delete(f.split(/[-.]/)[0]!)
    }
  }
}
