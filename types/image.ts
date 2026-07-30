export interface ProcessedImage {
  buffer: Buffer
  width: number
  height: number
  format: string
}

export type BackgroundMode = 'black' | 'original-overlay'

export interface BackgroundRemoverResult {
  pngBuffer: Buffer
  width: number
  height: number
}

export interface CompositorInput {
  personPng: Buffer
  personWidth: number
  personHeight: number
  backgroundMode?: BackgroundMode
  originalImage?: Buffer
}

export interface ProcessingResult {
  success: true
  url: string
}

export interface ProcessingError {
  success: false
  message: string
  code: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_FORMAT' | 'MODEL_FAILURE' | 'SHARP_ERROR' | 'TIMEOUT' | 'INTERNAL_ERROR'
}

export type ApiResponse = ProcessingResult | ProcessingError

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number]

export const MAX_FILE_SIZE = 30 * 1024 * 1024
