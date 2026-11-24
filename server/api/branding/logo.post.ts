import { BrandingError, saveLogo } from '../../utils/branding'

const MAX_LOGO_SIZE = 10 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  const file = formData?.find((f) => f.name === 'logo')

  if (!file?.data?.length) {
    throw createError({ statusCode: 400, message: 'No se envió ningún logo' })
  }
  if (!ALLOWED.includes(file.type ?? '')) {
    throw createError({ statusCode: 400, message: 'El logo debe ser PNG, JPG, WebP o SVG' })
  }
  if (file.data.length > MAX_LOGO_SIZE) {
    throw createError({ statusCode: 400, message: 'El logo pesa más de 10 MB' })
  }

  try {
    const kind = formData?.find((f) => f.name === 'kind')?.data.toString() === 'image' ? 'image' : 'logo'
    return { logo: await saveLogo(file.data, kind) }
  } catch (error) {
    if (error instanceof BrandingError) throw createError({ statusCode: 400, message: error.message })
    throw error
  }
})
