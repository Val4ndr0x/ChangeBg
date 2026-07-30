<template>
  <div
    class="relative flex flex-col items-center justify-center w-full min-h-[320px] rounded-2xl border-2 border-dashed transition-colors cursor-pointer"
    :class="[
      isDragOver
        ? 'border-blue-400 bg-blue-50/10'
        : hasError
          ? 'border-red-400 bg-red-50/5'
          : 'border-zinc-600 hover:border-zinc-400 bg-zinc-900/40'
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
        <div class="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
          <svg class="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p class="text-lg font-medium text-zinc-300">Arrastra tu foto aquí</p>
          <p class="mt-1 text-sm text-zinc-500">o haz clic para seleccionar un archivo</p>
        </div>
        <p class="text-xs text-zinc-600">JPG, PNG o WebP · Máx 30MB</p>
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
        class="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-900/80 flex items-center justify-center hover:bg-zinc-800 transition-colors"
        :disabled="disabled"
        @click.stop="resetImage"
      >
        <svg class="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div
      v-if="hasError"
      class="absolute bottom-0 left-0 right-0 px-4 py-3 bg-red-500/10 border-t border-red-500/20 rounded-b-2xl"
    >
      <p class="text-sm text-red-400">{{ errorMessage }}</p>
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
