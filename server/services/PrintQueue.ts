import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import { printLogger } from '../utils/printLogger'

const execFileAsync = promisify(execFile)

export const OUTPUT_DIR = path.resolve('public/output')
export const PRINTED_DIR = path.join(OUTPUT_DIR, 'printed')
export const FAILED_DIR = path.join(OUTPUT_DIR, 'failed')

const MAX_RETRIES = Number(process.env.PRINT_MAX_RETRIES ?? 3)
const RETRY_DELAY_MS = Number(process.env.PRINT_RETRY_DELAY_MS ?? 5000)
const PRINTER_NAME = process.env.PRINT_PRINTER_NAME || undefined
const DELETE_AFTER_PRINT = process.env.PRINT_DELETE_AFTER_PRINT === 'true'

interface QueueItem {
  filePath: string
  fileName: string
  attempts: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Single-worker FIFO print queue for `public/output`. One `enqueue()` call
 * per detected file; `processQueue()` runs alone (guarded by `processing`)
 * so only one `lp` job is ever in flight, which is what keeps prints in
 * arrival order even if several photos land within the same second.
 */
class PrintQueue {
  private queue: QueueItem[] = []
  private queuedNames = new Set<string>()
  private printedNames = new Set<string>()
  private processing = false

  async ensureDirs(): Promise<void> {
    await fs.mkdir(OUTPUT_DIR, { recursive: true })
    await fs.mkdir(PRINTED_DIR, { recursive: true })
    await fs.mkdir(FAILED_DIR, { recursive: true })
  }

  enqueue(filePath: string): void {
    const fileName = path.basename(filePath)

    if (this.queuedNames.has(fileName) || this.printedNames.has(fileName)) {
      printLogger.warn(`Imagen duplicada ignorada: ${fileName}`)
      return
    }

    printLogger.info(`Imagen detectada: ${fileName}`)

    this.queuedNames.add(fileName)
    this.queue.push({ filePath, fileName, attempts: 0 })
    printLogger.info(`Imagen agregada a la cola: ${fileName} (posición ${this.queue.length})`)

    void this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0) {
        const item = this.queue[0]!
        const success = await this.printWithRetries(item)
        this.queue.shift()
        this.queuedNames.delete(item.fileName)
        if (success) this.printedNames.add(item.fileName)
      }
    } finally {
      this.processing = false
    }
  }

  private async printWithRetries(item: QueueItem): Promise<boolean> {
    const totalAttempts = MAX_RETRIES + 1

    while (item.attempts < totalAttempts) {
      item.attempts += 1

      try {
        await fs.access(item.filePath)
      } catch {
        printLogger.error(`Imagen ya no existe, se omite: ${item.fileName}`)
        return false
      }

      printLogger.info(`Inicio de impresión: ${item.fileName} (intento ${item.attempts}/${totalAttempts})`)

      try {
        const args = PRINTER_NAME ? ['-d', PRINTER_NAME, item.filePath] : [item.filePath]
        await execFileAsync('lp', args)
        printLogger.info(`Impresión completada: ${item.fileName}`)
        await this.markPrinted(item)
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        printLogger.error(`Error de impresión (${item.fileName}, intento ${item.attempts}/${totalAttempts}): ${message}`)

        if (item.attempts < totalAttempts) {
          await sleep(RETRY_DELAY_MS)
        }
      }
    }

    printLogger.error(`Reintentos agotados para ${item.fileName}, se mueve a failed/`)
    await this.markFailed(item)
    return false
  }

  private async markPrinted(item: QueueItem): Promise<void> {
    try {
      if (DELETE_AFTER_PRINT) {
        await fs.unlink(item.filePath)
      } else {
        await fs.rename(item.filePath, path.join(PRINTED_DIR, item.fileName))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      printLogger.warn(`No se pudo archivar ${item.fileName} tras imprimir: ${message}`)
    }
  }

  private async markFailed(item: QueueItem): Promise<void> {
    try {
      await fs.rename(item.filePath, path.join(FAILED_DIR, item.fileName))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      printLogger.warn(`No se pudo mover ${item.fileName} a failed/: ${message}`)
    }
  }
}

export const printQueue = new PrintQueue()
