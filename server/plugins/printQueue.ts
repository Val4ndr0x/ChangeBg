import chokidar from 'chokidar'
import path from 'node:path'
import { printQueue, OUTPUT_DIR } from '../services/PrintQueue'
import { printLogger } from '../utils/printLogger'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg'])

export default defineNitroPlugin(async () => {
  await printQueue.ensureDirs()

  if (process.platform !== 'darwin') {
    printLogger.warn(
      `Plataforma "${process.platform}" detectada: la impresión usa el comando 'lp' (CUPS), disponible en macOS. ` +
      'El watcher seguirá activo, pero los trabajos de impresión probablemente fallarán en este equipo.'
    )
  }

  // depth: 0 -> solo archivos directamente dentro de OUTPUT_DIR, para no
  // reaccionar a los propios movimientos hacia printed/ y failed/.
  const watcher = chokidar.watch(OUTPUT_DIR, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  })

  watcher.on('add', (filePath) => {
    if (!IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return
    printQueue.enqueue(filePath)
  })

  watcher.on('error', (error) => {
    printLogger.error(`Error del observador de archivos: ${error instanceof Error ? error.message : String(error)}`)
  })

  printLogger.info(`Cola de impresión activa, observando: ${OUTPUT_DIR}`)
})
