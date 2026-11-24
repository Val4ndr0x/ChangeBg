import { FrameError, deleteFrame, isValidFrameId } from '../../utils/frames'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''

  if (!isValidFrameId(id)) {
    throw createError({ statusCode: 400, message: 'Marco inválido' })
  }

  try {
    await deleteFrame(id)
    return { deleted: id }
  } catch (error) {
    if (error instanceof FrameError) throw createError({ statusCode: 400, message: error.message })
    throw error
  }
})
