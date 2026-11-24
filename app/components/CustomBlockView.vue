<template>
  <p v-if="block.type === 'text'" class="hero-sub mx-auto max-w-2xl whitespace-pre-line text-lg text-zinc-200">
    {{ block.text || (customizeMode ? '(texto vacío)' : '') }}
  </p>
  <img
    v-else-if="block.image"
    :src="`/brand-logo/${block.image}`"
    alt=""
    class="inline-block h-auto max-w-full"
    :style="{ width: `${block.width}px` }"
  />
  <div
    v-else-if="customizeMode"
    class="inline-flex items-center justify-center rounded-2xl border-2 border-dashed border-brand-secondary/40 px-6 py-8 text-sm text-zinc-400"
    :style="{ width: `${block.width}px`, maxWidth: '100%' }"
  >
    Imagen sin subir
  </div>
</template>

<script setup lang="ts">
import type { CustomBlock } from '../../types/branding'

/** Texto o imagen añadidos desde el modo "Personalizar". */
defineProps<{ block: CustomBlock }>()

const { customizeMode } = useBranding()
</script>
