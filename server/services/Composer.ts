import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'
import { FaceDetector } from './FaceDetector'
import type { DetectedFace } from './FaceDetector'
import type { BackgroundMode, CompositorInput } from '../../types/image'

const OUTPUT_DIR = path.resolve('public/output')
const BACKGROUND_DIR = path.resolve('public/backgrounds')
const FRAMES_DIR = path.resolve('public/frames')

const DEFAULT_BACKGROUND = path.join(BACKGROUND_DIR, 'default-black.jpg')
const DEFAULT_FRAME = path.join(FRAMES_DIR, 'frame.png')

// "Fondo original": un poco más amplio que la foto base para dar aire al recorte
const BG_ZOOM_SCALE = 1.3
// "Fondo ampliado": copia ampliada, desenfocada y oscurecida
const OFFSET_SCALE = 2.2
const FACE_TARGET_X_LEFT = 0.15
const FACE_TARGET_X_RIGHT = 0.85
const FACE_TARGET_Y = 0.42

export class Composer {
  private backgroundPath: string
  private framePath: string
  private faceDetector = new FaceDetector()

  constructor(backgroundPath?: string, framePath?: string) {
    this.backgroundPath = backgroundPath ?? DEFAULT_BACKGROUND
    this.framePath = framePath ?? DEFAULT_FRAME
  }

  async compose(input: CompositorInput): Promise<Buffer> {
    const mode: BackgroundMode = input.backgroundMode ?? 'black'

    console.log(`[Composer] Iniciando composición — modo: ${mode}`)
    console.log(`[Composer] Dimensiones persona: ${input.personWidth}x${input.personHeight}`)

    const [bgBuffer, frameBuffer] = await Promise.all([
      mode === 'original-overlay' && input.originalImage
        ? this.loadOriginalWithOverlay(input.originalImage, input.personWidth, input.personHeight)
        : mode === 'original-offset' && input.originalImage
          ? this.loadOffsetBackground(input.originalImage, input.personWidth, input.personHeight)
          : this.loadBackground(input.personWidth, input.personHeight),
      this.loadFrame(input.personWidth, input.personHeight)
    ])

    const bgMeta = await sharp(bgBuffer).metadata()
    console.log(`[Composer] Background listo para composición: ${bgMeta.width}x${bgMeta.height}`)

    const result = await sharp(bgBuffer)
      .composite([
        { input: input.personPng, top: 0, left: 0 },
        { input: frameBuffer, top: 0, left: 0 }
      ])
      .png({ compressionLevel: 9 })
      .toBuffer()

    const resultMeta = await sharp(result).metadata()
    console.log(`[Composer] Composición final: ${resultMeta.width}x${resultMeta.height}`)

    return result
  }

  private async normalizeOrientation(imageBuffer: Buffer, label: string): Promise<Buffer> {
    const meta = await sharp(imageBuffer).metadata()
    const orientation = meta.orientation ?? 1

    console.log(`[Composer] ${label} — antes: ${meta.width}x${meta.height}, orientación EXIF: ${orientation}`)

    if (orientation !== 1) {
      const normalized = await sharp(imageBuffer)
        .rotate()
        .jpeg({ quality: 100 })
        .toBuffer()

      const newMeta = await sharp(normalized).metadata()
      console.log(`[Composer] ${label} — después de rotate(): ${newMeta.width}x${newMeta.height}, orientación: 1 (normalizada)`)
      return normalized
    }

    console.log(`[Composer] ${label} — sin EXIF que corregir, se mantiene igual`)
    return imageBuffer
  }

  private async loadOriginalWithOverlay(original: Buffer, width: number, height: number): Promise<Buffer> {
    const normalizedOriginal = await this.normalizeOrientation(original, 'Original (overlay)')

    const zoomed = await sharp(normalizedOriginal)
      .resize(Math.round(width * BG_ZOOM_SCALE), Math.round(height * BG_ZOOM_SCALE), { fit: 'cover', position: 'center' })
      .resize(width, height, { fit: 'cover', position: 'center' })
      .blur(1.5)
      .toBuffer()

    const zoomMeta = await sharp(zoomed).metadata()
    console.log(`[Composer] Overlay zoom aplicado: ${zoomMeta.width}x${zoomMeta.height}`)

    const overlay = await this.createDarkOverlay(width, height)

    const result = await sharp(zoomed)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg()
      .toBuffer()

    const resultMeta = await sharp(result).metadata()
    console.log(`[Composer] Overlay + composición: ${resultMeta.width}x${resultMeta.height}`)

    return result
  }

  private async loadOffsetBackground(original: Buffer, width: number, height: number): Promise<Buffer> {
    const normalizedOriginal = await this.normalizeOrientation(original, 'Original (offset)')

    const faces = await this.faceDetector.detect(normalizedOriginal)
    console.log(`[Composer] Rostros detectados en la imagen original: ${faces.length}`)

    const offsetX = Math.round(width * (OFFSET_SCALE - 1) / 2)
    const offsetY = Math.round(height * (OFFSET_SCALE - 1) / 2)

    const face = faces[0]
    const facePosition = face ? this.facePosition(face) : 'center'
    console.log(`[Composer] Posición de rostro determinada: ${facePosition}`)

    const offsetMap = {
      left: { x: offsetX * -1, y: offsetY * -1 },
      right: { x: offsetX, y: offsetY },
      center: { x: 0, y: 0 }
    }
    const offset = offsetMap[facePosition]

    const bg = await sharp(normalizedOriginal)
      .resize(Math.round(width * OFFSET_SCALE), Math.round(height * OFFSET_SCALE), { fit: 'cover', position: 'center' })
      .blur(6)
      .extend({
        top: offsetY,
        bottom: offsetY,
        left: offsetX,
        right: offsetX,
        background: { r: 0, g: 0, b: 0 }
      })
      .extract({
        left: offsetX + offset.x,
        top: offsetY + offset.y,
        width,
        height
      })
      .modulate({ brightness: 0.5 })
      .blur(6)
      .toBuffer()

    const bgMeta = await sharp(bg).metadata()
    console.log(`[Composer] Offset background listo: ${bgMeta.width}x${bgMeta.height}`)

    return bg
  }

  private facePosition(face: DetectedFace): 'left' | 'right' | 'center' {
    const x = face.centerX
    if (x < FACE_TARGET_X_LEFT) return 'left'
    if (x > FACE_TARGET_X_RIGHT) return 'right'
    return 'center'
  }

  private async createDarkOverlay(width: number, height: number): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.65 }
      }
    }).png().toBuffer()
  }

  private async loadBackground(width: number, height: number): Promise<Buffer> {
    try {
      await fs.access(this.backgroundPath)

      const bgFileBuffer = await fs.readFile(this.backgroundPath)
      const normalizedBg = await this.normalizeOrientation(bgFileBuffer, 'Background file')

      console.log(`[Composer] Redimensionando background a: ${width}x${height}`)

      const bg = await sharp(normalizedBg)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .toBuffer()
      return bg
    } catch {
      console.log(`[Composer] Background no encontrado, usando negro sólido: ${width}x${height}`)
      return sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      }).jpeg().toBuffer()
    }
  }

  private async loadFrame(width: number, height: number): Promise<Buffer> {
    try {
      await fs.access(this.framePath)
      const frame = await sharp(this.framePath)
        .resize(width, height, { fit: 'fill' })
        .png()
        .toBuffer()
      return frame
    } catch {
      return this.generateFrame(width, height)
    }
  }

  private async generateFrame(width: number, height: number): Promise<Buffer> {
    const svgFrame = this.generateSvgFrame(width, height)
    return Buffer.from(svgFrame)
  }

  private generateSvgFrame(w: number, h: number): string {
    const borderWidth = Math.max(4, Math.round(Math.min(w, h) * 0.008))
    const innerBorder = Math.max(1, Math.round(borderWidth * 0.4))
    const radius = Math.max(8, Math.round(Math.min(w, h) * 0.02))

    const outerX = borderWidth * 0.5
    const outerY = borderWidth * 0.5
    const outerW = w - borderWidth
    const outerH = h - borderWidth

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      <rect
        x="${outerX}" y="${outerY}"
        width="${outerW}" height="${outerH}"
        rx="${radius}" ry="${radius}"
        fill="none"
        stroke="#1a1a1a"
        stroke-width="${borderWidth}"
        filter="url(#shadow)"
      />
      <rect
        x="${outerX + borderWidth + innerBorder}" y="${outerY + borderWidth + innerBorder}"
        width="${outerW - 2 * (borderWidth + innerBorder)}"
        height="${outerH - 2 * (borderWidth + innerBorder)}"
        rx="${Math.max(2, radius - borderWidth - innerBorder)}"
        ry="${Math.max(2, radius - borderWidth - innerBorder)}"
        fill="none"
        stroke="#ffffff"
        stroke-width="0.5"
        stroke-opacity="0.15"
      />
    </svg>`
  }
}
