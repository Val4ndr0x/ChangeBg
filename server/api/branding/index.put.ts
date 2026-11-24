import { writeBranding } from '../../utils/branding'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Datos de diseño inválidos' })
  }
  return writeBranding(body)
})
