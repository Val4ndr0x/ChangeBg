import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import type { H3Event } from 'h3'

/** Envía un archivo con soporte de Range (necesario para avanzar en <video>/<audio>). */
export async function sendFileRange(event: H3Event, file: string, contentType: string) {
  const size = (await fs.stat(file).catch(() => null))?.size
  if (!size) throw createError({ statusCode: 404 })

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Accept-Ranges', 'bytes')

  const m = /^bytes=(\d*)-(\d*)$/.exec(getHeader(event, 'range') ?? '')
  if (m) {
    const start = m[1] ? Number(m[1]) : 0
    const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    setResponseStatus(event, 206)
    setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
    setHeader(event, 'Content-Length', end - start + 1)
    return sendStream(event, createReadStream(file, { start, end }))
  }
  setHeader(event, 'Content-Length', size)
  return sendStream(event, createReadStream(file))
}
