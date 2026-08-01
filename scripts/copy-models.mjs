import { cpSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = resolve(__dirname, '..', 'server', 'models')
const DEST_DIR = resolve(__dirname, '..', '.output', 'server', 'models')

if (!existsSync(SRC_DIR)) {
  console.error(`No se encontró ${SRC_DIR}. Ejecuta: npm run download-model`)
  process.exit(1)
}

if (!existsSync(DEST_DIR.replace(/models$/, ''))) {
  console.error(`No se encontró ${dirname(DEST_DIR)}. Ejecuta: npm run build primero.`)
  process.exit(1)
}

cpSync(SRC_DIR, DEST_DIR, { recursive: true })
console.log(`✓ Modelos copiados a ${DEST_DIR}`)
