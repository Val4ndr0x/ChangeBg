import fs from 'node:fs/promises'
import { getOutputPath } from '../../utils/tempFiles'

const FILENAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')

  if (!filename || !FILENAME_PATTERN.test(filename)) {
    throw createError({ statusCode: 400, statusMessage: 'Nombre de archivo inválido' })
  }

  try {
    const buffer = await fs.readFile(getOutputPath(filename))
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'no-store')
    return buffer
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Imagen no encontrada' })
  }
})
