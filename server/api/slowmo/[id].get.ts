import { getJob } from '../../services/SlowMoService'

export default defineEventHandler((event) => {
  const job = getJob(getRouterParam(event, 'id') ?? '')
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Trabajo no encontrado' })
  return job
})
