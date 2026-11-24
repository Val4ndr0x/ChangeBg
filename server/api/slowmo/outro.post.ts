import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { OUTRO_CARD } from '../../services/SlowMoService'

// La tarjeta se guarda ya en 1080x1920 con fondo negro para que el video no la deforme.
export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'card')
  if (!file?.data?.length) throw createError({ statusCode: 400, statusMessage: 'No se envió ninguna imagen' })
  if (file.data.length > 20 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'La imagen supera los 20 MB.' })
  try {
    const out = await sharp(file.data).rotate()
      .resize(1080, 1920, { fit: 'contain', background: '#000000' })
      .flatten({ background: '#000000' }).png().toBuffer()
    await fs.mkdir(path.dirname(OUTRO_CARD), { recursive: true })
    await fs.writeFile(OUTRO_CARD, out)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'No se pudo leer la imagen. Usa PNG, JPG o WebP.' })
  }
  return { ok: true }
})
