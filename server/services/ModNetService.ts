import { InferenceSession, Tensor } from 'onnxruntime-node'
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'
import { BackgroundRemover } from './BackgroundRemover'
import type { BackgroundRemoverResult } from '../../types/image'

const MODEL_PATH = path.resolve('server/models/modnet.onnx')
// MODNet trabaja bien a 512 px y acepta cualquier tamaño múltiplo de 32.
const REF_SIZE = 512

/**
 * Recorte de persona "ligero": MODNet (25 MB) en vez de BiRefNet (224 MB).
 * Usa unos cientos de MB de RAM y 2 hilos, pensado para PCs modestos.
 * Todo el trabajo pesado de píxeles lo hace sharp (libvips), no JavaScript.
 */
export class ModNetService extends BackgroundRemover {
  private session: InferenceSession | null = null

  get name(): string {
    return 'MODNet (ligero)'
  }

  async release(): Promise<void> {
    await this.session?.release()
    this.session = null
  }

  async removeBackground(imageBuffer: Buffer): Promise<BackgroundRemoverResult> {
    const session = await this.getSession()

    const work = await sharp(imageBuffer).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width, height } = work.info

    const scale = REF_SIZE / Math.max(width, height)
    const inW = Math.max(32, Math.round((width * scale) / 32) * 32)
    const inH = Math.max(32, Math.round((height * scale) / 32) * 32)

    const small = await sharp(work.data, { raw: { width, height, channels: 3 } })
      .resize(inW, inH, { fit: 'fill' })
      .raw()
      .toBuffer()

    const plane = inW * inH
    const input = new Float32Array(3 * plane)
    for (let i = 0; i < plane; i++) {
      input[i] = small[i * 3] / 127.5 - 1
      input[plane + i] = small[i * 3 + 1] / 127.5 - 1
      input[2 * plane + i] = small[i * 3 + 2] / 127.5 - 1
    }

    const outputs = await session.run({
      [session.inputNames[0]]: new Tensor('float32', input, [1, 3, inH, inW])
    })
    const matte = outputs[session.outputNames[0]].data as Float32Array

    const mask = Buffer.alloc(plane)
    for (let i = 0; i < plane; i++) {
      const v = matte[i]
      mask[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255)
    }

    const alpha = await sharp(mask, { raw: { width: inW, height: inH, channels: 1 } })
      .resize(width, height, { fit: 'fill', kernel: 'cubic' })
      // sharp devuelve 3 canales aunque la entrada sea de 1; nos quedamos con uno.
      .extractChannel(0)
      .raw()
      .toBuffer()

    const pngBuffer = await sharp(work.data, { raw: { width, height, channels: 3 } })
      .joinChannel(alpha, { raw: { width, height, channels: 1 } })
      .png({ compressionLevel: 1 })
      .toBuffer()

    return { pngBuffer, width, height }
  }

  private async getSession(): Promise<InferenceSession> {
    if (this.session) return this.session

    try {
      await fs.access(MODEL_PATH)
    } catch {
      throw new Error(`Modelo ligero no encontrado en ${MODEL_PATH}. Ejecuta: npm run download-model`)
    }

    this.session = await InferenceSession.create(MODEL_PATH, {
      intraOpNumThreads: 2,
      interOpNumThreads: 1,
      enableCpuMemArena: false
    })
    return this.session
  }
}
