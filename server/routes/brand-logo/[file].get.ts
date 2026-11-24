import fs from 'node:fs/promises'
import { getLogoPath, isValidLogoFile } from '../../utils/branding'

export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, 'file') ?? ''
  if (!isValidLogoFile(file)) {
    throw createError({ statusCode: 400, statusMessage: 'Logo inválido' })
  }

  try {
    const buffer = await fs.readFile(getLogoPath(file))
    setHeader(event, 'Content-Type', 'image/png')
    // El nombre es único por archivo subido, así que se puede cachear para siempre.
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
    return buffer
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Logo no encontrado' })
  }
})
