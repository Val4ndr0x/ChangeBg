import sharp from 'sharp'
import { FaceDetector } from '../services/FaceDetector'

const PORTRAIT_RATIO = 3 / 4

const faceDetector = new FaceDetector()

/**
 * Encuadra la foto como la haría un celular: si la imagen es horizontal
 * (paisaje, típico de cámaras de PC), se recorta automáticamente a formato
 * vertical 3:4 centrado en el rostro. Las fotos ya verticales no se tocan.
 */
export async function autoFrameToPortrait(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata()
  const orientation = meta.orientation ?? 1

  let buffer = imageBuffer
  if (orientation !== 1) {
    buffer = await sharp(imageBuffer).rotate().png().toBuffer()
  }

  const { width, height } = await sharp(buffer).metadata()
  if (!width || !height) throw new Error('Could not read image dimensions')

  if (height >= width) return buffer

  const cropW = Math.round(height * PORTRAIT_RATIO)
  const cropH = height

  let cropLeft = Math.round((width - cropW) / 2)

  try {
    const faces = await faceDetector.detect(buffer)
    const face = faces[0]
    if (face) {
      const left = Math.round(face.centerX * width - cropW / 2)
      cropLeft = Math.max(0, Math.min(width - cropW, left))
      console.log(`[Framing] Rostro detectado, recorte en x=${cropLeft}`)
    }
  } catch (error) {
    console.log(`[Framing] Detección de rostro fallida, recorte centrado: ${error}`)
  }

  console.log(`[Framing] Paisaje ${width}x${height} → retrato ${cropW}x${cropH}, x=${cropLeft}`)

  return sharp(buffer)
    .extract({ left: cropLeft, top: 0, width: cropW, height: cropH })
    .png()
    .toBuffer()
}
