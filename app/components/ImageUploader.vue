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

    <template v-if="!previewUrl">
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
      </div>
    </template>

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

function openFilePicker() {
  if (props.disabled) return
  fileInput.value?.click()
}

function onDrop(event: DragEvent) {
  isDragOver.value = false
  if (props.disabled) return
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
</script>
