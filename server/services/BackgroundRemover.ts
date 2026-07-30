import type { BackgroundRemoverResult } from '../../types/image'

export abstract class BackgroundRemover {
  abstract removeBackground(imageBuffer: Buffer): Promise<BackgroundRemoverResult>
  abstract get name(): string
}
