import fs from 'node:fs'
import path from 'node:path'

const LOG_DIR = path.resolve('logs')
const LOG_FILE = path.join(LOG_DIR, 'print-queue.log')

let logDirReady = false

function ensureLogDir(): void {
  if (logDirReady) return
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    logDirReady = true
  } catch {
    // console logging below still works even if the log file is unwritable
  }
}

type LogLevel = 'info' | 'warn' | 'error'

function write(level: LogLevel, message: string): void {
  const line = `[${new Date().toISOString()}] [PrintQueue] [${level.toUpperCase()}] ${message}`

  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)

  ensureLogDir()
  try {
    fs.appendFileSync(LOG_FILE, line + '\n')
  } catch {
    // best-effort file logging; console output above already happened
  }
}

export const printLogger = {
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string) => write('error', message)
}
