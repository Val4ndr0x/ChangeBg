import { FrameError, isValidFrameId, setActiveFrame } from '../../utils/frames'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: string }>(event)
  const id = body?.id ?? ''

  if (!isValidFrameId(id)) {
    throw createError({ statusCode: 400, message: 'Marco inválido' })
  }

  try {
    await setActiveFrame(id)
    return { active: id }
  } catch (error) {
    if (error instanceof FrameError) throw createError({ statusCode: 400, message: error.message })
    throw error
  }
})
