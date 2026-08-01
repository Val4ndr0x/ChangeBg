<template>
  <div class="flex flex-col items-center gap-6 w-full">
    <div
      class="inline-flex items-center gap-2 rounded-full bg-brand-yellow/10 px-4 py-1.5 text-sm font-bold text-brand-yellow ring-1 ring-brand-yellow/30"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
      </svg>
      ¡Tu recuerdo está listo!
    </div>

    <div class="relative w-full max-w-2xl rounded-3xl overflow-hidden bg-brand-navy-light/70 ring-2 ring-brand-cyan/25 shadow-xl shadow-brand-navy/60">
      <img
        :src="imageUrl"
        alt="Tu recuerdo de la Liga de Porrismo de Cundinamarca"
        class="w-full h-auto max-h-[600px] object-contain"
      />
      <div class="pointer-events-none absolute inset-x-0 top-0 h-1 stripe-energy" />
    </div>

    <div class="flex flex-wrap justify-center gap-4">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-brand-yellow px-6 py-2.5 font-display font-bold text-brand-navy shadow-lg shadow-brand-yellow/20 transition hover:brightness-105"
        @click="$emit('download')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Descargar
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-brand-navy-light px-6 py-2.5 font-semibold text-brand-cyan ring-1 ring-brand-cyan/40 transition hover:bg-brand-cyan/10"
        @click="$emit('print')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Imprimir
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl bg-brand-navy-light px-6 py-2.5 font-semibold text-brand-cyan ring-1 ring-brand-cyan/40 transition hover:bg-brand-cyan/10"
        @click="$emit('reset')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Tomar otra foto
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
  print: []
  reset: []
}>()
</script>

<style scoped>
.stripe-energy {
  background: repeating-linear-gradient(
    90deg,
    #fff200 0 26px,
    #00aeef 26px 52px,
    #ed2024 52px 78px
  );
  opacity: 0.7;
}
</style>
