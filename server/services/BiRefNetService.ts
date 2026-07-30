import { InferenceSession, Tensor } from 'onnxruntime-node'
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'
import { BackgroundRemover } from './BackgroundRemover'
import type { BackgroundRemoverResult } from '../../types/image'

const MODEL_PATH = path.resolve('server/models/birefnet.onnx')
const MODEL_INPUT_SIZE = 1024

const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

export class BiRefNetService extends BackgroundRemover {
  private session: InferenceSession | null = null
  private inputName: string = ''
  private outputName: string = ''

  get name(): string {
    return 'BiRefNet (ONNX)'
  }

  async removeBackground(imageBuffer: Buffer): Promise<BackgroundRemoverResult> {
    const session = await this.getSession()

    const inputMeta = await sharp(imageBuffer).metadata()
    const orientation = inputMeta.orientation ?? 1

    let workBuffer = imageBuffer
    if (orientation !== 1) {
      workBuffer = await sharp(imageBuffer)
        .rotate()
        .png()
        .toBuffer()
    }

    const sharpImage = sharp(workBuffer)
    const metadata = await sharpImage.metadata()
    const origWidth = metadata.width ?? 0
    const origHeight = metadata.height ?? 0

    if (origWidth === 0 || origHeight === 0) {
      throw new Error('Could not read image dimensions')
    }

    const { resized, padded, padLeft, padTop } = await this.preprocess(sharpImage)

    const inputTensor = new Tensor('float32', resized, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE])

    const feeds: Record<string, Tensor> = {}
    feeds[this.inputName] = inputTensor

    const outputs = await session.run(feeds)

    const outputTensor = outputs[this.outputName]
    const logits = outputTensor.data as Float32Array

    const maskData = new Float32Array(logits.length)
    for (let i = 0; i < logits.length; i++) {
      maskData[i] = 1 / (1 + Math.exp(-logits[i]))
    }

    const mask2D = this.extractMask(maskData, padLeft, padTop, padded.width, padded.height, origWidth, origHeight)

    const personPng = await this.applyMask(workBuffer, mask2D, origWidth, origHeight)

    return {
      pngBuffer: personPng,
      width: origWidth,
      height: origHeight
    }
  }

  private async getSession(): Promise<InferenceSession> {
    if (this.session) return this.session

    try {
      await fs.access(MODEL_PATH)
    } catch {
      throw new Error(
        `Modelo BiRefNet no encontrado en ${MODEL_PATH}. ` +
        'Ejecuta: npm run download-model'
      )
    }

    this.session = await InferenceSession.create(MODEL_PATH)

    const inputNames = this.session.inputNames
    const outputNames = this.session.outputNames

    if (inputNames.length === 0 || outputNames.length === 0) {
      throw new Error('El modelo ONNX no tiene inputs o outputs')
    }

    this.inputName = inputNames[0]
    this.outputName = outputNames[0]

    return this.session
  }

  private async preprocess(
    sharpImage: sharp.Sharp
  ): Promise<{
    resized: Float32Array
    padded: { width: number; height: number }
    padLeft: number
    padTop: number
  }> {
    const metadata = await sharpImage.metadata()
    const origW = metadata.width ?? 1
    const origH = metadata.height ?? 1

    const scale = Math.min(MODEL_INPUT_SIZE / origW, MODEL_INPUT_SIZE / origH)
    const newW = Math.round(origW * scale)
    const newH = Math.round(origH * scale)

    const padLeft = Math.floor((MODEL_INPUT_SIZE - newW) / 2)
    const padTop = Math.floor((MODEL_INPUT_SIZE - newH) / 2)

    const rawRgb = await sharpImage
      .resize(newW, newH, { fit: 'fill', kernel: 'lanczos3' })
      .raw()
      .toBuffer()

    const normalized = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE)

    const grayR = Math.round(IMAGENET_MEAN[0] * 255)
    const grayG = Math.round(IMAGENET_MEAN[1] * 255)
    const grayB = Math.round(IMAGENET_MEAN[2] * 255)

    for (let y = 0; y < MODEL_INPUT_SIZE; y++) {
      for (let x = 0; x < MODEL_INPUT_SIZE; x++) {
        const isPad = y < padTop || y >= padTop + newH || x < padLeft || x >= padLeft + newW

        for (let c = 0; c < 3; c++) {
          let pixel: number
          if (isPad) {
            pixel = c === 0 ? grayR : c === 1 ? grayG : grayB
          } else {
            const srcX = x - padLeft
            const srcY = y - padTop
            pixel = rawRgb[(srcY * newW + srcX) * 3 + c]
          }

          const idx = c * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE + y * MODEL_INPUT_SIZE + x
          normalized[idx] = (pixel / 255 - IMAGENET_MEAN[c]) / IMAGENET_STD[c]
        }
      }
    }

    return {
      resized: normalized,
      padded: { width: newW, height: newH },
      padLeft,
      padTop
    }
  }

  private extractMask(
    maskData: Float32Array,
    padLeft: number,
    padTop: number,
    contentW: number,
    contentH: number,
    origW: number,
    origH: number
  ): Float32Array {
    const out = new Float32Array(origW * origH)

    for (let y = 0; y < origH; y++) {
      const srcY = Math.round((y / origH) * contentH)
      for (let x = 0; x < origW; x++) {
        const srcX = Math.round((x / origW) * contentW)
        const maskIdx = (padTop + srcY) * MODEL_INPUT_SIZE + (padLeft + srcX)
        const value = maskData[maskIdx]
        out[y * origW + x] = value
      }
    }

    return out
  }

  private async applyMask(
    imageBuffer: Buffer,
    mask: Float32Array,
    width: number,
    height: number
  ): Promise<Buffer> {
    const pixels = await sharp(imageBuffer)
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
      .raw()
      .toBuffer()

    const rgba = Buffer.alloc(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = pixels[i * 3]
      rgba[i * 4 + 1] = pixels[i * 3 + 1]
      rgba[i * 4 + 2] = pixels[i * 3 + 2]
      const alpha = Math.min(1, Math.max(0, mask[i])) * 255
      rgba[i * 4 + 3] = Math.round(alpha)
    }

    const outPng = await sharp(rgba, {
      raw: { width, height, channels: 4 }
    })
      .png({ quality: 100 })
      .toBuffer()

    return outPng
  }
}
