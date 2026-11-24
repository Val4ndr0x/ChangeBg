import { FrameError, saveFrame } from '../../utils/frames'

const MAX_FRAME_SIZE = 30 * 1024 * 1024
const ALLOWED = ['image/png', 'image/webp']

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  const file = formData?.find((f) => f.name === 'frame')

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, message: 'No se envió ningún marco' })
  }
  if (!ALLOWED.includes(file.type ?? '')) {
    throw createError({ statusCode: 400, message: 'El marco debe ser PNG (con transparencia)' })
  }
  if (file.data.length > MAX_FRAME_SIZE) {
    throw createError({ statusCode: 400, message: 'El marco pesa más de 30 MB' })
  }

  try {
    return await saveFrame(file.data, file.filename ?? '')
  } catch (error) {
    if (error instanceof FrameError) throw createError({ statusCode: 400, message: error.message })
    throw error
  }
})
