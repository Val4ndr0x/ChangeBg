import os from 'node:os'
import sharp from 'sharp'
import { BiRefNetService } from '../services/BiRefNetService'
import { ModNetService } from '../services/ModNetService'
import type { BackgroundRemover } from '../services/BackgroundRemover'
import { Composer } from '../services/Composer'
import { autoFrameToRatio } from '../utils/framing'
import { getFrameWindowRatio } from '../utils/frameWindow'
import { getActiveFramePath } from '../utils/frames'
import { ensureOutputDir, generateOutputFilename, getOutputPath, cleanupOldFiles } from '../utils/tempFiles'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '../../types/image'
import type { ApiResponse, BackgroundMode, Engine } from '../../types/image'

const FALLBACK_RATIO = 3 / 4

const TIMEOUT_MS = 180000

// La foto final nunca pasa de ~2100 px de alto dentro del marco, así que no
// tiene sentido recortar a resolución completa de celular (gasta GB de RAM).
const MAX_INPUT_HEIGHT = 2200

// Alta calidad (BiRefNet) pasa de 3 GB incluso con 2 hilos (medido en un PC
// de 8 GB, donde colgó la sesión). Si no hay al menos esta
// memoria libre, se rechaza en vez de dejar que el equipo se cuelgue.
const MIN_FREE_GB_FOR_QUALITY = 6

const removers: Record<Engine, BackgroundRemover> = {
  ligero: new ModNetService(),
  calidad: new BiRefNetService()
}
let activeEngine: Engine | null = null

// Una foto a la vez: dos procesos en paralelo duplicarían la RAM.
let queue: Promise<unknown> = Promise.resolve()
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => {})
  return run
}

async function getRemover(engine: Engine): Promise<BackgroundRemover> {
  if (activeEngine && activeEngine !== engine) {
    // Solo un modelo cargado en memoria a la vez.
    await removers[activeEngine].release()
  }
  activeEngine = engine
  return removers[engine]
}

export default defineEventHandler(async (event): Promise<ApiResponse> => {
  try {
    const formData = await readMultipartFormData(event)

    if (!formData || formData.length === 0) {
      return { success: false, message: 'No se envió ningún archivo', code: 'EMPTY_FILE' }
    }

    const imageField = formData.find((f) => f.name === 'image')

    if (!imageField || !imageField.data || imageField.data.length === 0) {
      return { success: false, message: 'Campo image vacío', code: 'EMPTY_FILE' }
    }

    const imageBuffer = imageField.data
    const mimeType = imageField.type ?? ''

    if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
      return { success: false, message: `Formato no soportado: ${mimeType}. Usa JPG, PNG, WebP o HEIC.`, code: 'UNSUPPORTED_FORMAT' }
    }

    if (imageBuffer.length > MAX_FILE_SIZE) {
      return {
        success: false,
        message: `Archivo demasiado grande (${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB). Máximo: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB.`,
        code: 'FILE_TOO_LARGE'
      }
    }

    const engine: Engine = formData.find((f) => f.name === 'engine')?.data.toString() === 'calidad' ? 'calidad' : 'ligero'
    const backgroundMode = formData.find((f) => f.name === 'mode')?.data.toString() as BackgroundMode | undefined

    const work = exclusive(async () => {
      if (engine === 'calidad') {
        const freeGb = os.freemem() / 1024 ** 3
        if (freeGb < MIN_FREE_GB_FOR_QUALITY) {
          throw new Error(
            `LOW_MEMORY: Solo hay ${freeGb.toFixed(1)} GB de RAM libre y el modo Alta calidad necesita ~${MIN_FREE_GB_FOR_QUALITY} GB. ` +
            'Cambia a Modo ligero o cierra otros programas.'
          )
        }
      }

      const framePath = await getActiveFramePath()
      const targetRatio = await getFrameWindowRatio(framePath).catch(() => FALLBACK_RATIO)
      const framedFull = await autoFrameToRatio(imageBuffer, targetRatio)
      const framedBuffer = await sharp(framedFull)
        .resize({ height: MAX_INPUT_HEIGHT, withoutEnlargement: true })
        .png({ compressionLevel: 1 })
        .toBuffer()

      const remover = await getRemover(engine)
      console.log(`[API] Recortando con ${remover.name}`)
      const result = await remover.removeBackground(framedBuffer)

      return new Composer(undefined, framePath).compose({
        personPng: result.pngBuffer,
        personWidth: result.width,
        personHeight: result.height,
        backgroundMode,
        originalImage: framedBuffer
      })
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: el procesamiento tomó demasiado tiempo')), TIMEOUT_MS)
    )

    const composedBuffer = await Promise.race([work, timeoutPromise])

    await cleanupOldFiles()
    await ensureOutputDir()

    const filename = generateOutputFilename()
    const outputPath = getOutputPath(filename)

    await import('node:fs/promises').then((fs) => fs.writeFile(outputPath, composedBuffer))

    return {
      success: true,
      url: `/output/${filename}`
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'

    if (message.startsWith('LOW_MEMORY: ')) {
      return { success: false, message: message.slice('LOW_MEMORY: '.length), code: 'LOW_MEMORY' }
    }

    if (message.includes('Timeout')) {
      return { success: false, message, code: 'TIMEOUT' }
    }

    if (message.includes('no encontrado en')) {
      return { success: false, message, code: 'MODEL_FAILURE' }
    }

    const sharpErrors = ['sharp', 'input', 'buffer', 'image'].filter((k) =>
      message.toLowerCase().includes(k)
    )
    if (sharpErrors.length > 0) {
      return { success: false, message: `Error de procesamiento de imagen: ${message}`, code: 'SHARP_ERROR' }
    }

    return { success: false, message, code: 'INTERNAL_ERROR' }
  }
})
