import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { reserveUpload, startJob } from '../../services/SlowMoService'

const MAX_SIZE = 2 * 1024 * 1024 * 1024
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']

// El video llega como cuerpo crudo (no multipart) y se guarda en disco en streaming:
// los videos de celular pesan cientos de MB y no caben en el parser de multipart.
// Los ajustes viajan en la URL: ?ext=.mp4&zoom=0.18&music=...&musicStart=4&outro=true
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const str = (k: string) => (typeof q[k] === 'string' && q[k] ? (q[k] as string) : undefined)

  const ext = (str('ext') ?? '').toLowerCase()
  if (!VIDEO_EXT.includes(ext)) {
    throw createError({ statusCode: 400, statusMessage: 'Formato no soportado. Usa MP4, MOV, M4V, WebM o MKV.' })
  }

  const { id, file } = await reserveUpload(ext)
  let size = 0
  const limit = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length
      cb(size > MAX_SIZE ? new Error('TOO_BIG') : null, chunk)
    }
  })
  try {
    await pipeline(event.node.req, limit, createWriteStream(file))
  } catch (e: any) {
    await fs.unlink(file).catch(() => {})
    throw createError({
      statusCode: e?.message === 'TOO_BIG' ? 413 : 400,
      statusMessage: e?.message === 'TOO_BIG' ? 'El video supera los 2 GB.' : 'No se pudo recibir el video.'
    })
  }
  if (size === 0) {
    await fs.unlink(file).catch(() => {})
    throw createError({ statusCode: 400, statusMessage: 'No se envió ningún video' })
  }

  const num = (k: string) => (Number.isFinite(Number(str(k))) && str(k) !== undefined ? Number(str(k)) : undefined)
  const start = num('musicStart')
  return startJob(id, file, {
    music: str('music'),
    musicStart: start && start > 0 ? start : undefined,
    zoom: num('zoom'),
    fill: num('fill'),
    outro: str('outro') !== 'false',
    rewind: str('rewind') !== 'false',
    track: str('track') !== 'false'
  })
})
