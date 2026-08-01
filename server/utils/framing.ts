import sharp from 'sharp'
import { FaceDetector } from '../services/FaceDetector'

const faceDetector = new FaceDetector()

/**
 * Recorta la foto (centrada en el rostro si se detecta) a la proporción
 * objetivo, sin importar si esa proporción es más ancha o más alta que la
 * imagen original. Se usa para que la foto coincida con la ventana del
 * marco y no queden franjas negras al componer.
 */
export async function autoFrameToRatio(imageBuffer: Buffer, targetRatio: number): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata()
  const orientation = meta.orientation ?? 1

  let buffer = imageBuffer
  if (orientation !== 1) {
    buffer = await sharp(imageBuffer).rotate().png().toBuffer()
  }

  const { width, height } = await sharp(buffer).metadata()
  if (!width || !height) throw new Error('Could not read image dimensions')

  const currentRatio = width / height

  if (Math.abs(currentRatio - targetRatio) < 0.01) return buffer

  const faces = await faceDetector.detect(buffer).catch((error) => {
    console.log(`[Framing] Detección de rostro fallida, recorte centrado: ${error}`)
    return []
  })
  const face = faces[0]

  if (currentRatio > targetRatio) {
    const cropW = Math.round(height * targetRatio)
    const cropH = height

    let cropLeft = Math.round((width - cropW) / 2)
    if (face) {
      const left = Math.round(face.centerX * width - cropW / 2)
      cropLeft = Math.max(0, Math.min(width - cropW, left))
    }

    console.log(`[Framing] ${width}x${height} → ${cropW}x${cropH} (recorte horizontal), x=${cropLeft}`)

    return sharp(buffer)
      .extract({ left: cropLeft, top: 0, width: cropW, height: cropH })
      .png()
      .toBuffer()
  }

  const cropH = Math.round(width / targetRatio)
  const cropW = width

  let cropTop = Math.round((height - cropH) / 2)
  if (face) {
    const top = Math.round(face.centerY * height - cropH / 2)
    cropTop = Math.max(0, Math.min(height - cropH, top))
  }

  console.log(`[Framing] ${width}x${height} → ${cropW}x${cropH} (recorte vertical), y=${cropTop}`)

  return sharp(buffer)
    .extract({ left: 0, top: cropTop, width: cropW, height: cropH })
    .png()
    .toBuffer()
}
