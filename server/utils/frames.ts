import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Altura a la que se guardan todos los marcos. Es la altura del lienzo final
 * (~600 DPI en 10x15), así el marco nunca se reescala al componer cada foto.
 */
export const FRAME_HEIGHT = 2400

const DEFAULT_FRAME_PATH = path.resolve('public/frames/frame.png')
const FRAMES_DIR = path.resolve('server/frames')
const THUMBS_DIR = path.join(FRAMES_DIR, 'thumbs')
const INDEX_PATH = path.join(FRAMES_DIR, 'frames.json')

const THUMB_WIDTH = 360
const ALPHA_THRESHOLD = 10
// Al menos este porcentaje del marco debe ser transparente (la ventana de la foto).
const MIN_WINDOW_FRACTION = 0.1
const ID_PATTERN = /^(default|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/

export interface FrameEntry {
  id: string
  name: string
  width: number
  height: number
  builtIn: boolean
}

interface FrameIndex {
  active: string
  frames: Omit<FrameEntry, 'builtIn'>[]
}

export class FrameError extends Error {}

export function isValidFrameId(id: string): boolean {
  return ID_PATTERN.test(id)
}

async function readIndex(): Promise<FrameIndex> {
  try {
    const index = JSON.parse(await fs.readFile(INDEX_PATH, 'utf8')) as FrameIndex
    return { active: index.active ?? 'default', frames: index.frames ?? [] }
  } catch {
    return { active: 'default', frames: [] }
  }
}

async function writeIndex(index: FrameIndex): Promise<void> {
  await fs.mkdir(FRAMES_DIR, { recursive: true })
  const tmp = `${INDEX_PATH}.tmp`
  await fs.writeFile(tmp, JSON.stringify(index, null, 2))
  await fs.rename(tmp, INDEX_PATH)
}

export function getFramePath(id: string): string {
  return id === 'default' ? DEFAULT_FRAME_PATH : path.join(FRAMES_DIR, `${id}.png`)
}

/** Ruta del marco que se usa ahora para componer. */
export async function getActiveFramePath(): Promise<string> {
  const { active, frames } = await readIndex()
  if (active !== 'default' && frames.some((f) => f.id === active)) {
    const p = getFramePath(active)
    try {
      await fs.access(p)
      return p
    } catch {
      // Si el archivo desapareció, se vuelve al marco original.
    }
  }
  return DEFAULT_FRAME_PATH
}

export async function listFrames(): Promise<{ active: string; frames: FrameEntry[] }> {
  const index = await readIndex()
  const meta = await sharp(DEFAULT_FRAME_PATH).metadata().catch(() => ({ width: 0, height: 0 }))
  const frames: FrameEntry[] = [
    { id: 'default', name: 'Marco original', width: meta.width ?? 0, height: meta.height ?? 0, builtIn: true },
    ...index.frames.map((f) => ({ ...f, builtIn: false }))
  ]
  const active = frames.some((f) => f.id === index.active) ? index.active : 'default'
  return { active, frames }
}

/**
 * Guarda un marco subido por el usuario: lo valida (PNG con zona
 * transparente), lo ajusta a FRAME_HEIGHT de alto sin deformarlo y lo deja
 * como marco activo.
 */
export async function saveFrame(
  input: Buffer,
  rawName: string
): Promise<{ frame: FrameEntry; warning: string | null }> {
  let meta: sharp.Metadata
  try {
    meta = await sharp(input).metadata()
  } catch {
    throw new FrameError('No se pudo leer la imagen. Sube un PNG.')
  }

  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) throw new FrameError('No se pudo leer el tamaño de la imagen.')
  if (!meta.hasAlpha) {
    throw new FrameError('El marco no tiene transparencia. Expórtalo como PNG con el centro (donde va la foto) transparente.')
  }

  // Comprobar que hay una ventana transparente, en una miniatura para no gastar RAM.
  const { data, info } = await sharp(input)
    .resize({ width: 200 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let transparent = 0
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] < ALPHA_THRESHOLD) transparent++
  }
  if (transparent / (info.width * info.height) < MIN_WINDOW_FRACTION) {
    throw new FrameError('El marco casi no tiene zona transparente. El hueco donde va la foto debe ser transparente.')
  }

  const id = randomUUID()
  const targetWidth = Math.max(1, Math.round((width / height) * FRAME_HEIGHT))

  await fs.mkdir(FRAMES_DIR, { recursive: true })
  await sharp(input)
    .rotate()
    .resize(targetWidth, FRAME_HEIGHT, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(getFramePath(id))

  const name = rawName.trim().replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'Marco personalizado'
  const entry = { id, name, width: targetWidth, height: FRAME_HEIGHT }

  const index = await readIndex()
  index.frames.push(entry)
  index.active = id
  await writeIndex(index)

  const warning = height < FRAME_HEIGHT * 0.75
    ? `El marco original medía solo ${height} px de alto y se agrandó a ${FRAME_HEIGHT} px; puede verse borroso al imprimir. Lo ideal es subirlo de ${FRAME_HEIGHT} px de alto o más.`
    : null

  return { frame: { ...entry, builtIn: false }, warning }
}

export async function setActiveFrame(id: string): Promise<void> {
  const index = await readIndex()
  if (id !== 'default' && !index.frames.some((f) => f.id === id)) {
    throw new FrameError('Ese marco no existe.')
  }
  index.active = id
  await writeIndex(index)
}

export async function deleteFrame(id: string): Promise<void> {
  if (id === 'default') throw new FrameError('El marco original no se puede borrar.')
  const index = await readIndex()
  if (!index.frames.some((f) => f.id === id)) throw new FrameError('Ese marco no existe.')

  index.frames = index.frames.filter((f) => f.id !== id)
  if (index.active === id) index.active = 'default'
  await writeIndex(index)

  await fs.unlink(getFramePath(id)).catch(() => {})
  await fs.unlink(path.join(THUMBS_DIR, `${id}.png`)).catch(() => {})
}

/** Miniatura PNG (con transparencia) para mostrar en el panel de marcos. */
export async function getFrameThumb(id: string): Promise<Buffer> {
  const source = getFramePath(id)
  const stat = await fs.stat(source)
  const thumbPath = path.join(THUMBS_DIR, `${id}.png`)

  try {
    const thumbStat = await fs.stat(thumbPath)
    if (thumbStat.mtimeMs >= stat.mtimeMs) return await fs.readFile(thumbPath)
  } catch {
    // no existe todavía
  }

  const thumb = await sharp(source).resize({ width: THUMB_WIDTH }).png().toBuffer()
  await fs.mkdir(THUMBS_DIR, { recursive: true })
  await fs.writeFile(thumbPath, thumb)
  return thumb
}
