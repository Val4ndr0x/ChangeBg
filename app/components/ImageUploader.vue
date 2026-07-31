<template>
  <div
    class="relative flex flex-col items-center justify-center w-full min-h-[320px] rounded-3xl border-2 border-dashed transition-colors cursor-pointer"
    :class="[
      isDragOver
        ? 'border-brand-yellow bg-brand-yellow/5 ring-4 ring-brand-yellow/10'
        : hasError
          ? 'border-brand-red bg-brand-red/5'
          : 'border-brand-cyan/40 hover:border-brand-cyan bg-brand-navy-light/50'
    ]"
    @dragover.prevent="isDragOver = true"
    @dragleave.prevent="isDragOver = false"
    @drop.prevent="onDrop"
    @click="openFilePicker"
  >
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="hidden"
      @change="onFileSelected"
    />

    <template v-if="!previewUrl && !isCameraActive">
      <div class="flex flex-col items-center gap-4 p-8 text-center">
        <div class="relative w-16 h-16 rounded-full bg-brand-navy flex items-center justify-center ring-2 ring-brand-cyan/40">
          <svg class="w-7 h-7 text-brand-yellow" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
          </svg>
          <span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-cyan ring-2 ring-brand-navy" />
        </div>
        <div>
          <p class="font-display text-lg font-bold text-white">Arrastra tu foto aquí</p>
          <p class="mt-1 text-sm text-zinc-400">o haz clic para seleccionar un archivo</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold text-brand-cyan ring-1 ring-brand-cyan/25">JPG</span>
          <span class="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold text-brand-cyan ring-1 ring-brand-cyan/25">PNG</span>
          <span class="rounded-full bg-brand-navy px-3 py-1 text-xs font-semibold text-brand-cyan ring-1 ring-brand-cyan/25">WebP</span>
          <span class="text-xs text-zinc-500">· Máx 30MB</span>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-brand-cyan/10 px-5 py-2.5 text-sm font-bold text-brand-cyan ring-1 ring-brand-cyan/30 transition hover:bg-brand-cyan/20"
          :disabled="disabled"
          @click.stop="startCamera"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Usar cámara
        </button>
        <p v-if="cameraError" class="text-sm font-medium text-brand-red">{{ cameraError }}</p>
      </div>
    </template>

    <div v-else-if="isCameraActive" class="relative w-full p-4" @click.stop @dragover.prevent @drop.prevent>
      <div
        class="relative mx-auto w-full overflow-hidden rounded-2xl bg-black ring-1 ring-brand-cyan/30"
        :style="videoContainerStyle"
      >
        <video
          ref="videoRef"
          autoplay
          playsinline
          :muted="true"
          class="block w-full h-full object-contain"
          @loadedmetadata="onVideoLoaded"
        />
        <div v-if="videoDims" class="absolute inset-0 pointer-events-none">
          <div
            class="absolute border-2 border-brand-yellow rounded-xl shadow-[0_0_0_9999px_rgba(5,31,67,0.45)]"
            :style="guideStyle"
          />
        </div>

        <div
          v-if="countdown !== null"
          class="absolute inset-0 flex items-center justify-center bg-brand-navy/60 backdrop-blur-sm pointer-events-none"
        >
          <span class="font-display text-8xl font-black text-brand-yellow drop-shadow-lg">{{ countdown }}</span>
        </div>
      </div>

      <p v-if="cameraError" class="mt-3 text-sm font-medium text-brand-red text-center">{{ cameraError }}</p>

      <div class="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-6 py-2.5 text-sm font-bold text-zinc-300 ring-1 ring-zinc-600 transition hover:text-white"
          @click="stopCamera"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-brand-yellow px-8 py-2.5 font-display font-bold text-brand-navy shadow-lg shadow-brand-yellow/20 transition hover:brightness-105"
          :disabled="isCountingDown"
          @click="capturePhoto"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
          </svg>
          Tomar foto
        </button>
      </div>
    </div>

    <div v-else class="relative w-full h-full p-4">
      <img
        :src="previewUrl"
        alt="Preview"
        class="w-full max-h-[400px] object-contain rounded-xl"
      />
      <button
        type="button"
        class="absolute top-6 right-6 w-8 h-8 rounded-full bg-brand-navy/90 flex items-center justify-center text-brand-red hover:bg-brand-navy ring-1 ring-brand-red/40 transition-colors"
        :disabled="disabled"
        @click.stop="resetImage"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div
      v-if="hasError"
      class="absolute bottom-0 left-0 right-0 px-4 py-3 bg-brand-red/10 border-t border-brand-red/25 rounded-b-3xl"
    >
      <p class="text-sm font-medium text-brand-red">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  previewUrl: string | null
  errorMessage: string | null
  disabled: boolean
}>()

const emit = defineEmits<{
  fileSelected: [file: File]
  reset: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const hasError = computed(() => props.errorMessage !== null)

const videoRef = ref<HTMLVideoElement | null>(null)
const streamRef = ref<MediaStream | null>(null)
const isCameraActive = ref(false)
const cameraError = ref<string | null>(null)
const videoDims = ref<{ vw: number; vh: number } | null>(null)
const countdown = ref<number | null>(null)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const isCountingDown = computed(() => countdown.value !== null)

const PORTRAIT_RATIO = 3 / 4

const videoContainerStyle = computed(() => {
  if (!videoDims.value) return {}
  const { vw, vh } = videoDims.value
  return {
    aspectRatio: `${vw} / ${vh}`,
    maxHeight: '420px',
    maxWidth: `${Math.round(420 * (vw / vh))}px`
  }
})

const guideStyle = computed(() => {
  if (!videoDims.value) return {}
  const { vw, vh } = videoDims.value
  const a = vw / vh

  if (a >= 1) {
    const w = (PORTRAIT_RATIO / a) * 100
    const left = (100 - w) / 2
    return { left: `${left}%`, width: `${w}%`, top: '0%', height: '100%' }
  }

  const h = (a / PORTRAIT_RATIO) * 100
  const top = (100 - h) / 2
  return { top: `${top}%`, height: `${h}%`, left: '0%', width: '100%' }
})

function openFilePicker() {
  if (props.disabled || isCameraActive.value) return
  fileInput.value?.click()
}

function onDrop(event: DragEvent) {
  isDragOver.value = false
  if (props.disabled || isCameraActive.value) return
  const file = event.dataTransfer?.files?.[0]
  if (file) emit('fileSelected', file)
}

function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    emit('fileSelected', file)
    target.value = ''
  }
}

function resetImage() {
  emit('reset')
}

async function startCamera() {
  if (props.disabled) return

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'Tu navegador no permite acceso a la cámara.'
    return
  }

  try {
    streamRef.value = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    })

    isCameraActive.value = true
    cameraError.value = null
    videoDims.value = null

    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = streamRef.value
    }
  } catch {
    cameraError.value = 'No se pudo acceder a la cámara. Verifica los permisos del navegador.'
  }
}

function onVideoLoaded() {
  const video = videoRef.value
  if (video && video.videoWidth > 0) {
    videoDims.value = { vw: video.videoWidth, vh: video.videoHeight }
  }
}

function capturePhoto() {
  if (countdown.value !== null) return
  countdown.value = 5
  countdownTimer = setInterval(() => {
    if (countdown.value === null) return
    if (countdown.value <= 1) {
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = null
      countdown.value = null
      doCapturePhoto()
    } else {
      countdown.value -= 1
    }
  }, 1000)
}

function doCapturePhoto() {
  const video = videoRef.value
  if (!video || video.videoWidth === 0) return

  const vw = video.videoWidth
  const vh = video.videoHeight
  let cropX = 0
  let cropY = 0
  let cropW = vw
  let cropH = vh

  if (vw / vh >= PORTRAIT_RATIO) {
    cropW = Math.round(vh * PORTRAIT_RATIO)
    cropX = Math.round((vw - cropW) / 2)
  } else {
    cropH = Math.round(vw / PORTRAIT_RATIO)
    cropY = Math.round((vh - cropH) / 2)
  }

  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

  canvas.toBlob((blob) => {
    if (!blob) return
    const file = new File([blob], `camara-${Date.now()}.jpg`, { type: 'image/jpeg' })
    stopCamera()
    emit('fileSelected', file)
  }, 'image/jpeg', 0.95)
}

function stopCamera() {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = null
  countdown.value = null
  streamRef.value?.getTracks().forEach((track) => track.stop())
  streamRef.value = null
  isCameraActive.value = false
  videoDims.value = null
}

onUnmounted(() => {
  stopCamera()
})
</script>
