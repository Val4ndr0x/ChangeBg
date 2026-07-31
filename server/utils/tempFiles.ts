import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const OUTPUT_DIR = path.resolve('public/output')
const CLEANUP_AGE_MS = 60 * 60 * 1000
let lastCleanup = 0

export function generateOutputFilename(): string {
  return `${randomUUID()}.png`
}

export function getOutputPath(filename: string): string {
  return path.join(OUTPUT_DIR, filename)
}

export async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
}

export async function cleanupOldFiles(): Promise<void> {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_AGE_MS) return
  lastCleanup = now

  try {
    const files = await fs.readdir(OUTPUT_DIR)
    const entries = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(OUTPUT_DIR, file)
        try {
          const stat = await fs.stat(filePath)
          return { filePath, age: now - stat.mtimeMs }
        } catch {
          return null
        }
      })
    )

    const deletions = entries
      .filter((e): e is NonNullable<typeof e> => e !== null && e.age > CLEANUP_AGE_MS)
      .map((e) => fs.unlink(e.filePath).catch(() => {}))

    await Promise.all(deletions)
  } catch {
    // cleanup errors are non-critical
  }
}

export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // non-critical
  }
}
