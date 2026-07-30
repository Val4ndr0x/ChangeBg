import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'
import type { CompositorInput, BackgroundMode } from '../../types/image'

const OUTPUT_DIR = path.resolve('public/output')
const BACKGROUND_DIR = path.resolve('public/backgrounds')
const FRAMES_DIR = path.resolve('public/frames')

const DEFAULT_BACKGROUND = path.join(BACKGROUND_DIR, 'default-black.jpg')
const DEFAULT_FRAME = path.join(FRAMES_DIR, 'frame.png')
const BG_ZOOM_SCALE = 1.3

export class Composer {
  private backgroundPath: string
  private framePath: string

  constructor(backgroundPath?: string, framePath?: string) {
    this.backgroundPath = backgroundPath ?? DEFAULT_BACKGROUND
    this.framePath = framePath ?? DEFAULT_FRAME
  }

  async compose(input: CompositorInput): Promise<Buffer> {
    const mode: BackgroundMode = input.backgroundMode ?? 'black'

    const [bgBuffer, frameBuffer] = await Promise.all([
      mode === 'original-overlay' && input.originalImage
        ? this.loadOriginalWithOverlay(input.originalImage, input.personWidth, input.personHeight)
        : this.loadBackground(input.personWidth, input.personHeight),
      this.loadFrame(input.personWidth, input.personHeight)
    ])

    const result = await sharp(bgBuffer)
      .composite([
        { input: input.personPng, top: 0, left: 0 },
        { input: frameBuffer, top: 0, left: 0 }
      ])
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
        trellisQuantisation: true,
        overshootDeringing: true,
        force: true
      })
      .toBuffer()

    return result
  }

  private async loadOriginalWithOverlay(original: Buffer, width: number, height: number): Promise<Buffer> {
    const zoomed = await sharp(original)
      .resize(Math.round(width * BG_ZOOM_SCALE), Math.round(height * BG_ZOOM_SCALE), { fit: 'cover', position: 'center' })
      .resize(width, height, { fit: 'cover', position: 'center' })
      .toBuffer()

    const overlay = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.7 }
      }
    }).png().toBuffer()

    return sharp(zoomed)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg()
      .toBuffer()
  }

  private async loadBackground(width: number, height: number): Promise<Buffer> {
    try {
      await fs.access(this.backgroundPath)
      const bg = await sharp(this.backgroundPath)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .toBuffer()
      return bg
    } catch {
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
