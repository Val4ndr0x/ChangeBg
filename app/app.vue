<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <header class="border-b border-zinc-800">
      <div class="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </div>
        <h1 class="text-lg font-semibold">ChangeBG</h1>
        <span class="text-xs text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-md">Profesional</span>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-12">
      <div class="text-center mb-10">
        <h2 class="text-3xl font-bold tracking-tight">Cambia el fondo de tus fotos</h2>
        <p class="mt-2 text-zinc-400">Resultados con calidad de edición profesional</p>
      </div>

      <div v-if="!processor.resultUrl.value" class="flex flex-col items-center gap-8">
        <ImageUploader
          :preview-url="processor.previewUrl.value"
          :error-message="processor.error.value"
          :disabled="processor.isProcessing.value"
          @file-selected="onFileSelected"
          @reset="processor.reset()"
        />

        <div
          v-if="processor.previewUrl.value && !processor.isProcessing.value"
          class="flex flex-col items-center gap-4"
        >
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <span
              class="text-sm font-medium"
              :class="processor.backgroundMode.value === 'black' ? 'text-zinc-100' : 'text-zinc-500'"
            >Fondo negro</span>
            <div
              class="relative w-12 h-6 rounded-full transition-colors"
              :class="processor.backgroundMode.value === 'original-overlay' ? 'bg-blue-600' : 'bg-zinc-700'"
              @click="processor.backgroundMode.value = processor.backgroundMode.value === 'black' ? 'original-overlay' : 'black'"
            >
              <div
                class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow"
                :class="processor.backgroundMode.value === 'original-overlay' ? 'translate-x-6' : 'translate-x-0.5'"
              />
            </div>
            <span
              class="text-sm font-medium"
              :class="processor.backgroundMode.value === 'original-overlay' ? 'text-zinc-100' : 'text-zinc-500'"
            >Fondo original</span>
          </label>

          <button
            type="button"
            class="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-xl transition-colors"
            @click="processor.process()"
          >
            Procesar imagen
          </button>
        </div>
      </div>

      <ResultPreview
        v-else
        :image-url="processor.resultUrl.value"
        @download="processor.download()"
        @reset="processor.reset()"
      />
    </main>

    <footer class="border-t border-zinc-800 mt-24">
      <div class="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-zinc-600">
        ChangeBG — Procesamiento profesional de imágenes
      </div>
    </footer>

    <ProcessingOverlay :visible="processor.isProcessing.value" />
  </div>
</template>

<script setup lang="ts">
const processor = useImageProcessor()

function onFileSelected(file: File) {
  processor.setFile(file)
}
</script>
