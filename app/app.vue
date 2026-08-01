<template>
  <div class="relative min-h-screen overflow-x-hidden bg-brand-navy text-zinc-100">
    <div class="pointer-events-none fixed inset-0">
      <div class="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-brand-cyan/10 blur-3xl" />
      <div class="absolute top-1/3 -left-44 w-[420px] h-[420px] rounded-full bg-brand-yellow/5 blur-3xl" />
      <div class="absolute bottom-0 right-1/4 w-[380px] h-[380px] rounded-full bg-brand-red/10 blur-3xl" />
    </div>

    <header class="sticky top-0 z-40 border-b border-brand-cyan/15 bg-brand-navy/80 backdrop-blur-md">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <img
          :src="logoUrl"
          alt="Logo Liga de Porrismo de Cundinamarca"
          class="w-11 h-11 rounded-full ring-2 ring-brand-yellow/70 shadow-lg shadow-brand-navy/60"
        />
        <div class="leading-tight">
          <h1 class="font-display text-lg font-extrabold tracking-tight text-white">
            Photo Liga <span class="text-brand-yellow">LPC</span>
          </h1>
          <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-cyan">
            <svg class="w-3 h-3 text-brand-yellow" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
            </svg>
            Liga de Porrismo de Cundinamarca
          </span>
        </div>
      </div>
    </header>

    <section class="relative overflow-hidden">
      <div
        class="absolute inset-x-0 bottom-0 h-24 opacity-20 stripe-energy"
      />
      <svg
        class="sparkle absolute left-[8%] top-14 w-6 h-6 text-brand-yellow"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
      </svg>
      <svg
        class="sparkle-delay absolute right-[10%] top-24 w-5 h-5 text-brand-cyan"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
      </svg>
      <svg
        class="sparkle-delay-2 absolute right-[22%] top-10 w-4 h-4 text-brand-red"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
      </svg>

      <div class="relative max-w-5xl mx-auto px-4 pt-12 pb-14 text-center">
        <p
          class="inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-cyan"
        >
          <svg class="w-3.5 h-3.5 text-brand-yellow" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
          </svg>
          Temporada LPC · Cundinamarca
        </p>

        <h2 class="mt-6 font-display text-4xl sm:text-6xl font-extrabold italic tracking-tight text-white">
          Vive el momento.
          <span class="text-brand-yellow not-italic">Llévate</span>
          el recuerdo.
        </h2>

        <p class="mx-auto mt-4 max-w-xl text-base sm:text-lg text-zinc-400">
          Tómate una foto en el stand y llévate un recuerdo con el sello oficial de la Liga de Porrismo de Cundinamarca.
        </p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span
            class="inline-flex items-center gap-2 rounded-full bg-brand-navy-light/60 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-brand-cyan/25"
          >
            <svg class="w-4 h-4 text-brand-yellow" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
            </svg>
            Recuerdo de calidad
          </span>
          <span
            class="inline-flex items-center gap-2 rounded-full bg-brand-navy-light/60 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-brand-cyan/25"
          >
            <svg class="w-4 h-4 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Listo en segundos
          </span>
          <span
            class="inline-flex items-center gap-2 rounded-full bg-brand-navy-light/60 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-brand-cyan/25"
          >
            <svg class="w-4 h-4 text-brand-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descárgala y compártela
          </span>
        </div>
      </div>
    </section>

    <main class="relative max-w-3xl mx-auto px-4 pb-16">
      <div v-if="!processor.resultUrl.value" class="flex flex-col items-center gap-8">
        <div class="text-center">
          <p class="font-display text-sm font-bold uppercase tracking-widest text-brand-cyan">
            Tu turno
          </p>
          <h3 class="mt-1 font-display text-2xl font-extrabold text-white">
            Sonríe, es hora de tu foto
          </h3>
        </div>

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
          <p class="text-sm font-semibold text-zinc-400">Elige el estilo de tu recuerdo</p>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <button
              v-for="option in backgroundOptions"
              :key="option.value"
              type="button"
              class="rounded-full px-4 py-2 text-sm font-semibold transition"
              :class="processor.backgroundMode.value === option.value
                ? 'bg-brand-cyan text-brand-navy shadow-lg shadow-brand-cyan/25'
                : 'bg-brand-navy-light/60 text-zinc-300 ring-1 ring-brand-cyan/25 hover:text-white'"
              @click="processor.backgroundMode.value = option.value"
            >
              {{ option.label }}
            </button>
          </div>

          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-brand-yellow px-8 py-3 font-display font-bold text-brand-navy shadow-lg shadow-brand-yellow/20 transition hover:brightness-105 hover:shadow-brand-yellow/30 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500 disabled:shadow-none"
            @click="processor.process()"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
            </svg>
            ¡Quiero mi recuerdo!
          </button>
        </div>
      </div>

      <ResultPreview
        v-else
        :image-url="processor.resultUrl.value"
        @download="processor.download()"
        @print="processor.print()"
        @reset="processor.reset()"
      />
    </main>

    <footer class="relative border-t border-brand-cyan/15">
      <div class="max-w-5xl mx-auto px-4 py-8 text-center">
        <p class="text-sm font-semibold text-zinc-400">
          Photo Liga <span class="text-brand-yellow">LPC</span>
          · Liga de Porrismo de Cundinamarca
        </p>
        <p class="mt-1 text-xs text-zinc-600">Tu recuerdo oficial de la temporada LPC</p>
      </div>
    </footer>

    <ProcessingOverlay :visible="processor.isProcessing.value" />
  </div>
</template>

<script setup lang="ts">
import logoUrl from '../assets/img/logo.png'
import type { BackgroundMode } from '../types/image'

const processor = useImageProcessor()

const backgroundOptions: { value: BackgroundMode; label: string }[] = [
  { value: 'original-overlay', label: '! Momento inolvidable ¡' },
]

function onFileSelected(file: File) {
  processor.setFile(file)
}
</script>

<style scoped>
.stripe-energy {
  background: repeating-linear-gradient(
    -45deg,
    #fff200 0 26px,
    #00aeef 26px 52px,
    #ed2024 52px 78px
  );
  -webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.15));
  mask-image: linear-gradient(to top, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.15));
}

@keyframes sparkle-float {
  0%, 100% {
    transform: translateY(0) scale(1) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) scale(1.15) rotate(12deg);
  }
}

.sparkle {
  animation: sparkle-float 3.2s ease-in-out infinite;
}

.sparkle-delay {
  animation: sparkle-float 3.6s ease-in-out 0.6s infinite;
}

.sparkle-delay-2 {
  animation: sparkle-float 4s ease-in-out 1.2s infinite;
}
</style>
