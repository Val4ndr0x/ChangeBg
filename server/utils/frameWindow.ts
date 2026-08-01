import sharp from 'sharp'
import fs from 'node:fs/promises'

export interface FrameWindow {
  frameWidth: number
  frameHeight: number
  /** Ventana transparente del marco, como fracciones 0..1 del lienzo del marco */
  x0: number
  y0: number
  x1: number
  y1: number
}

const THUMB_WIDTH = 400
const ALPHA_THRESHOLD = 10

const cache = new Map<string, { mtimeMs: number; window: FrameWindow }>()

/**
 * Detecta la ventana transparente de un marco PNG (donde debe verse la foto)
 * analizando el canal alfa. Se cachea por ruta de archivo, invalidando la
 * caché si el archivo fue modificado (p. ej. al reemplazar el frame sin
 * reiniciar el servidor).
 */
export async function detectFrameWindow(framePath: string): Promise<FrameWindow> {
  const stat = await fs.stat(framePath)
  const cached = cache.get(framePath)
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.window

  const meta = await sharp(framePath).metadata()
  const frameWidth = meta.width ?? 0
  const frameHeight = meta.height ?? 0

  if (!frameWidth || !frameHeight) {
    throw new Error('No se pudo leer las dimensiones del marco')
  }

  const thumbHeight = Math.max(1, Math.round((frameHeight / frameWidth) * THUMB_WIDTH))

  const { data, info } = await sharp(framePath)
    .resize(THUMB_WIDTH, thumbHeight, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3]
      if (alpha < ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const window: FrameWindow = maxX >= 0
    ? {
        frameWidth,
        frameHeight,
        x0: minX / width,
        y0: minY / height,
        x1: (maxX + 1) / width,
        y1: (maxY + 1) / height
      }
    : { frameWidth, frameHeight, x0: 0, y0: 0, x1: 1, y1: 1 }

  cache.set(framePath, { mtimeMs: stat.mtimeMs, window })
  return window
}

/** Proporción (ancho/alto) de la ventana transparente del marco. */
export async function getFrameWindowRatio(framePath: string): Promise<number> {
  const window = await detectFrameWindow(framePath)
  const windowWidth = (window.x1 - window.x0) * window.frameWidth
  const windowHeight = (window.y1 - window.y0) * window.frameHeight
  return windowWidth / windowHeight
}
