import path from 'node:path'
import { SLOWMO_MUSIC_DIR } from '../../services/SlowMoService'
import { sendFileRange } from '../../utils/sendFileRange'

// Para escuchar la pista y elegir el punto de inicio.
export default defineEventHandler((event) => {
  const name = path.basename(getRouterParam(event, 'name') ?? '')
  return sendFileRange(event, path.join(SLOWMO_MUSIC_DIR, name), 'audio/mpeg')
})
