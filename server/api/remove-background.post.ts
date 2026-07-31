import { BiRefNetService } from '../services/BiRefNetService'
import { Composer } from '../services/Composer'
import { ensureOutputDir, generateOutputFilename, getOutputPath, cleanupOldFiles } from '../utils/tempFiles'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '../../types/image'
import type { ApiResponse, BackgroundMode } from '../../types/image'

const TIMEOUT_MS = 90000

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

    const modeField = formData.find((f) => f.name === 'mode')
    const mode: BackgroundMode = (modeField?.data?.toString() as BackgroundMode) ?? 'black'

    const remover = new BiRefNetService()

    const removerPromise = remover.removeBackground(imageBuffer)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: el procesamiento tomó demasiado tiempo')), TIMEOUT_MS)
    )

    const result = await Promise.race([removerPromise, timeoutPromise])

    const composer = new Composer()
    const composedBuffer = await composer.compose({
      personPng: result.pngBuffer,
      personWidth: result.width,
      personHeight: result.height,
      backgroundMode: mode,
      originalImage: mode === 'original-overlay' ? imageBuffer : undefined
    })

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

    if (message.includes('Timeout')) {
      return { success: false, message, code: 'TIMEOUT' }
    }

    if (message.includes('Modelo BiRefNet no encontrado')) {
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
