import fs from 'node:fs/promises'
import { OUTRO_CARD } from '../../services/SlowMoService'

export default defineEventHandler(async () => {
  const st = await fs.stat(OUTRO_CARD).catch(() => null)
  return { exists: !!st, version: st ? Math.round(st.mtimeMs) : 0 }
})
