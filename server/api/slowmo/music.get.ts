import { listMusic } from '../../services/SlowMoService'

export default defineEventHandler(async () => ({ files: await listMusic() }))
