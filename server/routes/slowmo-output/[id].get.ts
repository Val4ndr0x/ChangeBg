import { getJob, jobOutputPath } from '../../services/SlowMoService'
import { sendFileRange } from '../../utils/sendFileRange'

// ?download=1 fuerza la descarga; sin él se reproduce en el navegador.
export default defineEventHandler((event) => {
  const job = getJob(getRouterParam(event, 'id') ?? '')
  if (job?.status !== 'done') throw createError({ statusCode: 404 })
  if (getQuery(event).download) {
    setHeader(event, 'Content-Disposition', `attachment; filename="${job.outputName}"`)
  }
  return sendFileRange(event, jobOutputPath(job.id), 'video/mp4')
})
