import { InferenceSession, Tensor } from 'onnxruntime-node'
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'

const MODEL_PATH = path.resolve('server/models/face_detection_yunet.onnx')
const INPUT_SIZE = 640
const STRIDES = [8, 16, 32]
const SCORE_THRESHOLD = 0.6
const NMS_THRESHOLD = 0.3
const NOSE_OFFSET_RATIO = 0.08

export interface DetectedFace {
  score: number
  centerX: number
  centerY: number
  width: number
  height: number
  rightEyeX: number
  rightEyeY: number
  leftEyeX: number
  leftEyeY: number
  noseX: number
  noseY: number
}

export type GazeDirection = 'left' | 'right' | 'neutral'

interface CandidateFace {
  score: number
  x1: number
  y1: number
  width: number
  height: number
  landmarks: number[]
}

export class FaceDetector {
  private session: InferenceSession | null = null

  /**
   * Detects faces in the image and returns them normalized to fractions of the
   * input image (0..1). Empty array if no face is found or the model is missing.
   */
  async detect(imageBuffer: Buffer): Promise<DetectedFace[]> {
    const session = await this.getSession().catch(() => null)
    if (!session) return []

    const { resized } = await this.preprocess(imageBuffer)
    const inputTensor = new Tensor('float32', resized, [1, 3, INPUT_SIZE, INPUT_SIZE])

    const feeds: Record<string, Tensor> = {}
    feeds[session.inputNames[0]] = inputTensor

    const outputs = await session.run(feeds)

    const candidates = this.decode(outputs)
    const kept = this.nms(candidates)

    return kept.map((f) => this.normalize(f))
  }

  getGazeDirection(face: DetectedFace): GazeDirection {
    const eyeMidX = (face.rightEyeX + face.leftEyeX) / 2
    const dx = face.noseX - eyeMidX
    const threshold = face.width * NOSE_OFFSET_RATIO

    if (dx > threshold) return 'right'
    if (dx < -threshold) return 'left'
    return 'neutral'
  }

  private async getSession(): Promise<InferenceSession> {
    if (this.session) return this.session
    await fs.access(MODEL_PATH)
    this.session = await InferenceSession.create(MODEL_PATH)
    return this.session
  }

  private async preprocess(imageBuffer: Buffer): Promise<{ resized: Float32Array }> {
    const { data, info } = await sharp(imageBuffer)
      .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { width, height } = info
    const nchw = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)

    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      nchw[i] = b
      nchw[width * height + i] = g
      nchw[2 * width * height + i] = r
    }

    return { resized: nchw }
  }

  private decode(outputs: Record<string, Tensor>): CandidateFace[] {
    const faces: CandidateFace[] = []

    for (const stride of STRIDES) {
      const rows = INPUT_SIZE / stride
      const cols = INPUT_SIZE / stride

      const cls = outputs[`cls_${stride}`].data as Float32Array
      const obj = outputs[`obj_${stride}`].data as Float32Array
      const bbox = outputs[`bbox_${stride}`].data as Float32Array
      const kps = outputs[`kps_${stride}`].data as Float32Array

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c

          const clsScore = Math.min(1, Math.max(0, cls[idx]))
          const objScore = Math.min(1, Math.max(0, obj[idx]))
          const score = Math.sqrt(clsScore * objScore)

          if (score < SCORE_THRESHOLD) continue

          const cx = (c + bbox[idx * 4]) * stride
          const cy = (r + bbox[idx * 4 + 1]) * stride
          const w = Math.exp(bbox[idx * 4 + 2]) * stride
          const h = Math.exp(bbox[idx * 4 + 3]) * stride

          const landmarks: number[] = []
          for (let n = 0; n < 5; n++) {
            landmarks.push((kps[idx * 10 + 2 * n] + c) * stride)
            landmarks.push((kps[idx * 10 + 2 * n + 1] + r) * stride)
          }

          faces.push({
            score,
            x1: cx - w / 2,
            y1: cy - h / 2,
            width: w,
            height: h,
            landmarks
          })
        }
      }
    }

    return faces
  }

  private nms(faces: CandidateFace[]): CandidateFace[] {
    const sorted = [...faces].sort((a, b) => b.score - a.score)
    const kept: CandidateFace[] = []

    for (const face of sorted) {
      const overlap = kept.some((k) => this.iou(k, face) > NMS_THRESHOLD)
      if (!overlap) kept.push(face)
    }

    return kept
  }

  private iou(a: CandidateFace, b: CandidateFace): number {
    const x1 = Math.max(a.x1, b.x1)
    const y1 = Math.max(a.y1, b.y1)
    const x2 = Math.min(a.x1 + a.width, b.x1 + b.width)
    const y2 = Math.min(a.y1 + a.height, b.y1 + b.height)

    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
    const union = a.width * a.height + b.width * b.height - inter
    return union > 0 ? inter / union : 0
  }

  private normalize(face: CandidateFace): DetectedFace {
    const [reX, reY, leX, leY, noseX, noseY] = face.landmarks

    return {
      score: face.score,
      centerX: (face.x1 + face.width / 2) / INPUT_SIZE,
      centerY: (face.y1 + face.height / 2) / INPUT_SIZE,
      width: face.width / INPUT_SIZE,
      height: face.height / INPUT_SIZE,
      rightEyeX: reX / INPUT_SIZE,
      rightEyeY: reY / INPUT_SIZE,
      leftEyeX: leX / INPUT_SIZE,
      leftEyeY: leY / INPUT_SIZE,
      noseX: noseX / INPUT_SIZE,
      noseY: noseY / INPUT_SIZE
    }
  }
}
