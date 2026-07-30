<template>
  <div class="flex flex-col items-center gap-6 w-full">
    <div class="relative w-full max-w-2xl rounded-2xl overflow-hidden bg-zinc-900/60 ring-1 ring-zinc-800">
      <img
        :src="imageUrl"
        alt="Resultado"
        class="w-full h-auto max-h-[600px] object-contain"
      />
    </div>

    <div class="flex gap-4">
      <button
        type="button"
        class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
        @click="$emit('download')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Descargar
      </button>

      <button
        type="button"
        class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors flex items-center gap-2"
        @click="$emit('reset')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Nueva imagen
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  imageUrl: string
}>()

defineEmits<{
  download: []
  reset: []
}>()
</script>
