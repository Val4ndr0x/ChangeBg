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

const CORE_THRESHOLD = 0.5
const DILATION_PIXELS = 1
const FEATHER_SIGMA = 2.0
const EDGE_BLEED_EROSION = 2

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

    const maskSoft = this.extractMaskContent(maskData, padLeft, padTop, padded.width, padded.height)
    const personPng = await this.applyMask(workBuffer, maskSoft, padded.width, padded.height, origWidth, origHeight)

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

  private extractMaskContent(
    maskData: Float32Array,
    padLeft: number,
    padTop: number,
    contentW: number,
    contentH: number
  ): Float32Array {
    const out = new Float32Array(contentW * contentH)

    for (let y = 0; y < contentH; y++) {
      const srcRow = (padTop + y) * MODEL_INPUT_SIZE + padLeft
      const dstRow = y * contentW
      for (let x = 0; x < contentW; x++) {
        out[dstRow + x] = maskData[srcRow + x]
      }
    }

    return out
  }

  private erode3x3(
    mask: Float32Array,
    width: number,
    height: number
  ): Float32Array {
    const out = new Float32Array(mask.length)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let min = 1.0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const v = mask[ny * width + nx]
              if (v < min) min = v
            }
          }
        }
        out[y * width + x] = min
      }
    }

    return out
  }

  private dilate3x3(
    mask: Float32Array,
    width: number,
    height: number
  ): Float32Array {
    const out = new Float32Array(mask.length)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let max = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const v = mask[ny * width + nx]
              if (v > max) max = v
            }
          }
        }
        out[y * width + x] = max
      }
    }

    return out
  }

  private async upscaleMask(
    mask: Float32Array,
    contentW: number,
    contentH: number,
    targetW: number,
    targetH: number
  ): Promise<Float32Array> {
    const source = Buffer.alloc(mask.length)
    for (let i = 0; i < mask.length; i++) {
      source[i] = Math.round(Math.max(0, Math.min(1, mask[i])) * 255)
    }

    const resized = await sharp(source, { raw: { width: contentW, height: contentH, channels: 1 } })
      .toColourspace('b-w')
      .resize(targetW, targetH, { fit: 'fill', kernel: 'lanczos3' })
      .raw()
      .toBuffer()

    const out = new Float32Array(resized.length)
    for (let i = 0; i < resized.length; i++) {
      out[i] = resized[i] / 255
    }

    return out
  }

  private async featherAlpha(
    mask: Float32Array,
    width: number,
    height: number,
    sigma: number
  ): Promise<Float32Array> {
    const source = Buffer.alloc(mask.length)
    for (let i = 0; i < mask.length; i++) {
      source[i] = Math.round(Math.max(0, Math.min(1, mask[i])) * 255)
    }

    const blurred = await sharp(source, { raw: { width, height, channels: 1 } })
      .toColourspace('b-w')
      .blur(sigma)
      .raw()
      .toBuffer()

    const out = new Float32Array(blurred.length)
    for (let i = 0; i < blurred.length; i++) {
      out[i] = blurred[i] / 255
    }

    return out
  }

  private buildFinalAlpha(
    maskSoft: Float32Array,
    feathered: Float32Array,
    width: number,
    height: number
  ): { alpha: Float32Array; core: Float32Array } {
    const binary = new Float32Array(maskSoft.length)
    for (let i = 0; i < maskSoft.length; i++) {
      binary[i] = maskSoft[i] > CORE_THRESHOLD ? 1 : 0
    }

    const core = this.erode3x3(binary, width, height)

    const alpha = new Float32Array(feathered.length)
    for (let i = 0; i < feathered.length; i++) {
      const value = Math.max(0, Math.min(1, feathered[i]))
      alpha[i] = core[i] > 0.5 ? 1 : value
    }

    return { alpha, core }
  }

  private decontaminateEdge(
    rgb: Buffer,
    alpha: Float32Array,
    core: Float32Array,
    width: number,
    height: number
  ): Buffer {
    const size = width * height
    const out = Buffer.from(rgb)

    let source = core
    for (let i = 0; i < EDGE_BLEED_EROSION; i++) {
      source = this.erode3x3(source, width, height)
    }

    let pending: number[] = []
    for (let i = 0; i < size; i++) {
      if (source[i] === 0 && alpha[i] > 0) {
        pending.push(i)
      }
    }

    const MAX_PASSES = 32
    let passes = 0
    while (pending.length > 0 && passes < MAX_PASSES) {
      passes++
      const next: number[] = []
      const filled: number[] = []
      for (const idx of pending) {
        const x = idx % width
        const y = Math.floor(idx / width)
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= width) continue
            const ni = ny * width + nx
            if (source[ni] > 0.5) {
              r += out[ni * 3]
              g += out[ni * 3 + 1]
              b += out[ni * 3 + 2]
              n++
            }
          }
        }
        if (n > 0) {
          out[idx * 3] = Math.round(r / n)
          out[idx * 3 + 1] = Math.round(g / n)
          out[idx * 3 + 2] = Math.round(b / n)
          filled.push(idx)
        } else {
          next.push(idx)
        }
      }
      for (const idx of filled) {
        source[idx] = 1
      }
      pending = next
    }

    return out
  }

  private async applyMask(
    imageBuffer: Buffer,
    maskSoft: Float32Array,
    contentW: number,
    contentH: number,
    width: number,
    height: number
  ): Promise<Buffer> {
    const [pixels, maskFull] = await Promise.all([
      sharp(imageBuffer)
        .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
        .raw()
        .toBuffer(),
      this.upscaleMask(maskSoft, contentW, contentH, width, height)
    ])

    let dilated = maskFull
    for (let i = 0; i < DILATION_PIXELS; i++) {
      dilated = this.dilate3x3(dilated, width, height)
    }

    const feathered = await this.featherAlpha(dilated, width, height, FEATHER_SIGMA)
    const { alpha, core } = this.buildFinalAlpha(maskFull, feathered, width, height)

    const decontaminated = this.decontaminateEdge(pixels, alpha, core, width, height)

    const rgba = Buffer.alloc(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = decontaminated[i * 3]
      rgba[i * 4 + 1] = decontaminated[i * 3 + 1]
      rgba[i * 4 + 2] = decontaminated[i * 3 + 2]
      rgba[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, alpha[i])) * 255)
    }

    const outPng = await sharp(rgba, {
      raw: { width, height, channels: 4 }
    })
      .png({ quality: 100 })
      .toBuffer()

    return outPng
  }
}
