import fs from 'node:fs/promises'
import path from 'node:path'
import { AUDIO_EXT, SLOWMO_MUSIC_DIR } from '../../services/SlowMoService'

const MAX_SIZE = 50 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'music')
  if (!file?.data?.length) throw createError({ statusCode: 400, statusMessage: 'No se envió ningún audio' })

  const ext = path.extname(file.filename ?? '').toLowerCase()
  if (!AUDIO_EXT.includes(ext)) {
    throw createError({ statusCode: 400, statusMessage: 'Formato no soportado. Usa MP3, M4A, AAC, WAV, OGG o FLAC.' })
  }
  if (file.data.length > MAX_SIZE) throw createError({ statusCode: 413, statusMessage: 'El audio supera los 50 MB.' })

  const base = path.basename(file.filename!, ext).replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'musica'
  await fs.mkdir(SLOWMO_MUSIC_DIR, { recursive: true })
  await fs.writeFile(path.join(SLOWMO_MUSIC_DIR, base + ext), file.data)
  return { name: base + ext }
})
