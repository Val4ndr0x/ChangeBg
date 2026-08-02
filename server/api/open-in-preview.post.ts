import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import { getOutputPath } from '../utils/tempFiles'

const execFileAsync = promisify(execFile)
const FILENAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i

export default defineEventHandler(async (event) => {
  if (process.platform !== 'darwin') {
    throw createError({ statusCode: 400, statusMessage: 'Solo disponible en macOS' })
  }

  const body = await readBody<{ filename?: string }>(event)
  const filename = body?.filename

  if (!filename || !FILENAME_PATTERN.test(filename)) {
    throw createError({ statusCode: 400, statusMessage: 'Nombre de archivo inválido' })
  }

  const filePath = getOutputPath(filename)

  try {
    await fs.access(filePath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Imagen no encontrada' })
  }

  try {
    await execFileAsync('open', ['-a', 'Preview', filePath])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    throw createError({ statusCode: 500, statusMessage: `No se pudo abrir Preview: ${message}` })
  }

  return { success: true }
})
