import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODEL_DIR = resolve(__dirname, '..', 'server', 'models')
const MODEL_PATH = resolve(MODEL_DIR, 'birefnet.onnx')

const MODEL_URL = 'https://github.com/ZhengPeng7/BiRefNet/releases/download/v1/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx'

async function main() {
  mkdirSync(MODEL_DIR, { recursive: true })

  console.log(`Downloading BiRefNet ONNX model...`)
  console.log(`URL: ${MODEL_URL}`)
  console.log(`Destination: ${MODEL_PATH}`)

  const response = await fetch(MODEL_URL)

  if (!response.ok) {
    throw new Error(`Download failed (HTTP ${response.status})`)
  }

  const total = Number(response.headers.get('content-length') ?? 0)
  let downloaded = 0
  let lastLog = 0

  const reader = response.body.getReader()
  const chunks = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    downloaded += value.length

    const pct = total ? Math.round((downloaded / total) * 100) : 0
    const now = Date.now()
    if (now - lastLog > 2000) {
      const mb = (downloaded / 1024 / 1024).toFixed(1)
      const totalMB = total ? (total / 1024 / 1024).toFixed(1) : '?'
      console.log(`  ${mb}MB / ${totalMB}MB (${pct}%)`)
      lastLog = now
    }
  }

  const buffer = Buffer.concat(chunks)
  writeFileSync(MODEL_PATH, buffer)

  const totalMB = (buffer.length / 1024 / 1024).toFixed(1)
  console.log(`\n✓ Model downloaded: ${totalMB}MB`)
  console.log(`  ${MODEL_PATH}`)
}

main().catch((err) => {
  console.error('Failed to download model:', err.message)
  process.exit(1)
})
