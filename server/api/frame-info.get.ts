import { getFrameWindowRatio } from '../utils/frameWindow'
import { getActiveFramePath } from '../utils/frames'

const FALLBACK_RATIO = 3 / 4

export default defineEventHandler(async () => {
  const aspectRatio = await getFrameWindowRatio(await getActiveFramePath()).catch(() => FALLBACK_RATIO)
  return { aspectRatio }
})
