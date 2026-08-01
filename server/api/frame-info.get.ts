import path from 'node:path'
import { getFrameWindowRatio } from '../utils/frameWindow'

const FRAME_PATH = path.resolve('public/frames/frame.png')
const FALLBACK_RATIO = 3 / 4

export default defineEventHandler(async () => {
  const aspectRatio = await getFrameWindowRatio(FRAME_PATH).catch(() => FALLBACK_RATIO)
  return { aspectRatio }
})
