import { getFrameThumb, isValidFrameId } from '../../utils/frames'

export default defineEventHandler(async (event) => {
  const id = (getRouterParam(event, 'id') ?? '').replace(/\.png$/, '')

  if (!isValidFrameId(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Marco inválido' })
  }

  try {
    const buffer = await getFrameThumb(id)
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'no-cache')
    return buffer
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Marco no encontrado' })
  }
})
