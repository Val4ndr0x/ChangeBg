import { BackgroundRemover } from './BackgroundRemover'
import type { BackgroundRemoverResult } from '../../types/image'

export class RemoveBgService extends BackgroundRemover {
  private apiKey: string

  constructor(apiKey: string) {
    super()
    this.apiKey = apiKey
  }

  get name(): string {
    return 'remove.bg'
  }

  async removeBackground(imageBuffer: Buffer): Promise<BackgroundRemoverResult> {
    if (!this.apiKey) {
      throw new Error('Remove.bg API key not configured. Set NUXT_REMOVE_BG_API_KEY environment variable.')
    }

    const formData = new FormData()
    const blob = new Blob([imageBuffer], { type: 'image/png' })
    formData.append('image_file', blob, 'image.png')
    formData.append('size', 'auto')
    formData.append('format', 'png')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey
        },
        body: formData,
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Remove.bg API error (${response.status}): ${errorText}`)
      }

      const resultBuffer = Buffer.from(await response.arrayBuffer())
      const sharp = await import('sharp')
      const metadata = await sharp.default(resultBuffer).metadata()

      return {
        pngBuffer: resultBuffer,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
