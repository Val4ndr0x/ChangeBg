import { InferenceSession, Tensor } from 'onnxruntime-node'
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'
import { BackgroundRemover } from './BackgroundRemover'
import { MatteRefiner } from './MatteRefiner'
import type { BackgroundRemoverResult } from '../../types/image'

const MODEL_PATH = path.resolve('server/models/birefnet.onnx')
const MODEL_INPUT_SIZE = 1024

const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

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

  private upscaleMask(
    mask: Float32Array,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number
  ): Float32Array {
    const tmp = new Float32Array(dstW * srcH)
    const sx = srcW / dstW
    for (let y = 0; y < srcH; y++) {
      const srcRow = y * srcW
      const dstRow = y * dstW
      for (let x = 0; x < dstW; x++) {
        const fx = clamp((x + 0.5) * sx - 0.5, 0, srcW - 1)
        const x0 = Math.floor(fx)
        const t = fx - x0
        const xa = x0
        const xb = x0 + 1 < srcW ? x0 + 1 : x0
        tmp[dstRow + x] = mask[srcRow + xa] * (1 - t) + mask[srcRow + xb] * t
      }
    }

    const out = new Float32Array(dstW * dstH)
    const sy = srcH / dstH
    for (let y = 0; y < dstH; y++) {
      const fy = clamp((y + 0.5) * sy - 0.5, 0, srcH - 1)
      const y0 = Math.floor(fy)
      const t = fy - y0
      const rowA = y0 * dstW
      const rowB = (y0 + 1 < srcH ? y0 + 1 : y0) * dstW
      const dstRow = y * dstW
      for (let x = 0; x < dstW; x++) {
        out[dstRow + x] = tmp[rowA + x] * (1 - t) + tmp[rowB + x] * t
      }
    }

    return out
  }

  private shapeAlpha(
    alpha: Float32Array,
    width: number,
    height: number,
    gain: number
  ): Float32Array {
    const out = new Float32Array(alpha.length)
    for (let i = 0; i < alpha.length; i++) {
      out[i] = clamp((alpha[i] - 0.5) * gain + 0.5, 0, 1)
    }
    return out
  }

  private edgeGain(
    alpha: Float32Array,
    w: number,
    h: number,
    scale: number
  ): number {
    let gradAcc = 0
    let gradN = 0
    for (let i = 1; i < alpha.length; i++) {
      const a = alpha[i]
      const b = alpha[i - 1]
      const inBand = (a > 0.05 && a < 0.95) || (b > 0.05 && b < 0.95)
      if (inBand) {
        gradAcc += Math.abs(a - b)
        gradN++
      }
    }
    const meanGrad = gradN > 0 ? gradAcc / gradN : 0.25
    const bandModelPx = meanGrad > 0.01 ? 1 / meanGrad : 4
    const bandFullPx = bandModelPx * scale
    return clamp(bandFullPx / 2.2, 0.8, 2.2)
  }

  private decontaminateEdge(
    rgb: Buffer,
    alpha: Float32Array,
    width: number,
    height: number
  ): Buffer {
    const size = width * height
    const out = Buffer.from(rgb)
    const CORE = 0.98
    const INF = 1 << 28
    const rC = new Uint8Array(size)
    const gC = new Uint8Array(size)
    const bC = new Uint8Array(size)
    const dist = new Int32Array(size).fill(INF)

    for (let i = 0; i < size; i++) {
      if (alpha[i] >= CORE) {
        dist[i] = 0
        rC[i] = rgb[i * 3]
        gC[i] = rgb[i * 3 + 1]
        bC[i] = rgb[i * 3 + 2]
      }
    }

    const relax = (i: number, ni: number, cost: number): void => {
      if (dist[ni] === INF) return
      const nd = dist[ni] + cost
      if (nd < dist[i]) {
        dist[i] = nd
        rC[i] = rC[ni]
        gC[i] = gC[ni]
        bC[i] = bC[ni]
      }
    }

    for (let y = 0; y < height; y++) {
      const row = y * width
      for (let x = 0; x < width; x++) {
        const i = row + x
        if (x > 0) relax(i, i - 1, 3)
        if (y > 0) {
          if (x > 0) relax(i, i - width - 1, 4)
          relax(i, i - width, 3)
          if (x < width - 1) relax(i, i - width + 1, 4)
        }
      }
    }

    for (let y = height - 1; y >= 0; y--) {
      const row = y * width
      for (let x = width - 1; x >= 0; x--) {
        const i = row + x
        if (x < width - 1) relax(i, i + 1, 3)
        if (y < height - 1) {
          if (x < width - 1) relax(i, i + width + 1, 4)
          relax(i, i + width, 3)
          if (x > 0) relax(i, i + width - 1, 4)
        }
      }
    }

    for (let i = 0; i < size; i++) {
      const a = alpha[i]
      if (a >= 0.02 && a < CORE) {
        out[i * 3] = rC[i]
        out[i * 3 + 1] = gC[i]
        out[i * 3 + 2] = bC[i]
      }
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
    const pixels = await sharp(imageBuffer)
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
      .raw()
      .toBuffer()

    const refiner = new MatteRefiner()
    const refined = refiner.refine(maskSoft, contentW, contentH)

    const maskFull = this.upscaleMask(refined.alpha, contentW, contentH, width, height)

    const scale = Math.max(width / contentW, height / contentH)
    const alpha = this.shapeAlpha(maskFull, width, height, this.edgeGain(refined.alpha, contentW, contentH, scale))

    const { spikes, sawtooth, maxAlphaGradient, holesFilled, islandsRemoved } = refined.metrics
    console.log(
      `[BiRefNet] Refinamiento de matte — máscara: ${contentW}x${contentH} → ${width}x${height} ` +
      `(escala ${scale.toFixed(2)}x), ` +
      `picos: ${spikes}, dientes de sierra: ${sawtooth.toFixed(3)}, gradiente alpha máx: ${maxAlphaGradient.toFixed(2)}, ` +
      `huecos rellenados: ${holesFilled}, islas eliminadas: ${islandsRemoved}`
    )

    const decontaminated = this.decontaminateEdge(pixels, alpha, width, height)

    const rgba = Buffer.alloc(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = decontaminated[i * 3]
      rgba[i * 4 + 1] = decontaminated[i * 3 + 1]
      rgba[i * 4 + 2] = decontaminated[i * 3 + 2]
      rgba[i * 4 + 3] = Math.round(clamp(alpha[i], 0, 1) * 255)
    }

    const outPng = await sharp(rgba, {
      raw: { width, height, channels: 4 }
    })
      .png({ quality: 100 })
      .toBuffer()

    return outPng
  }
}
