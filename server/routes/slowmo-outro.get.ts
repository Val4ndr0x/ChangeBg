import { OUTRO_CARD } from '../services/SlowMoService'
import { sendFileRange } from '../utils/sendFileRange'

export default defineEventHandler((event) => sendFileRange(event, OUTRO_CARD, 'image/png'))
