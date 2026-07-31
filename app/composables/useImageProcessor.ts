import type { ApiResponse, BackgroundMode } from '../../types/image'

export function useImageProcessor() {
  const isProcessing = ref(false)
  const error = ref<string | null>(null)
  const resultUrl = ref<string | null>(null)
  const previewUrl = ref<string | null>(null)
  const selectedFile = ref<File | null>(null)
  const backgroundMode = ref<BackgroundMode>('black')

  async function process(): Promise<void> {
    if (!selectedFile.value) return

    isProcessing.value = true
    error.value = null
    resultUrl.value = null

    try {
      const formData = new FormData()
      formData.append('image', selectedFile.value)
      formData.append('mode', backgroundMode.value)

      if (backgroundMode.value !== 'black') {
        formData.append('originalImage', selectedFile.value)
      }

      const response = await fetch('/api/remove-background', {
        method: 'POST',
        body: formData
      })

      const result: ApiResponse = await response.json()

      if (!result.success) {
        throw new Error(result.message)
      }

      resultUrl.value = result.url
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error inesperado'
    } finally {
      isProcessing.value = false
    }
  }

  function setFile(file: File): string | null {
    selectedFile.value = file
    error.value = null
    resultUrl.value = null

    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      error.value = `Formato no soportado: ${file.type}. Usa JPG, PNG o WebP.`
      return null
    }

    if (file.size > 30 * 1024 * 1024) {
      error.value = `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 30MB.`
      return null
    }

    previewUrl.value = URL.createObjectURL(file)
    return previewUrl.value
  }

  function download(): void {
    if (!resultUrl.value) return
    const link = document.createElement('a')
    link.href = resultUrl.value
    link.download = 'cambio-fondo.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function reset(): void {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }
    previewUrl.value = null
    resultUrl.value = null
    error.value = null
    isProcessing.value = false
    selectedFile.value = null
  }

  onUnmounted(() => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }
  })

  return {
    isProcessing,
    error,
    resultUrl,
    previewUrl,
    selectedFile,
    backgroundMode,
    process,
    setFile,
    download,
    reset
  }
}
