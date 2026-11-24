<template>
  <div class="relative min-h-screen overflow-x-hidden bg-brand-bg text-zinc-100">
    <div class="pointer-events-none fixed inset-0">
      <div class="deco-pattern absolute inset-0" />
      <div class="deco-blob absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-brand-secondary/10 blur-3xl" />
      <div class="deco-blob absolute top-1/3 -left-44 w-[420px] h-[420px] rounded-full bg-brand-primary/5 blur-3xl" />
      <div class="deco-blob absolute bottom-0 right-1/4 w-[380px] h-[380px] rounded-full bg-brand-accent/10 blur-3xl" />
    </div>

    <header class="sticky top-0 z-40 border-b border-brand-secondary/15 bg-brand-bg/80 backdrop-blur-md">
      <div class="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        <NuxtLink
          v-if="!processor.isProcessing.value"
          to="/"
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-surface/60 text-zinc-300 ring-1 ring-brand-secondary/25 transition hover:text-white"
          title="Volver a Herramientas"
          aria-label="Volver a Herramientas"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </NuxtLink>
        <LayoutEl id="logo" class="flex shrink-0">
          <img
            :src="logoUrl"
            :alt="`Logo ${t.organization}`"
            :class="[logoShapeClass, branding.editMode.value ? 'brand-editable cursor-pointer' : '']"
            :style="logoStyle"
            :title="branding.editMode.value ? 'Doble clic para cambiar el logo' : undefined"
            @dblclick="branding.editMode.value && branding.pickLogo()"
          />
        </LayoutEl>
        <div class="leading-tight">
          <LayoutEl id="appName">
            <h1 class="font-display text-lg font-extrabold tracking-tight text-white">
              <BrandText k="appName" /> <span class="text-brand-primary"><BrandText k="appNameHighlight" /></span>
            </h1>
          </LayoutEl>
          <LayoutEl id="organization">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-secondary">
              <svg class="w-3 h-3 text-brand-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
              </svg>
              <BrandText k="organization" />
            </span>
          </LayoutEl>
        </div>

        <button
          type="button"
          class="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-surface/60 px-3 py-2 text-xs font-bold text-zinc-200 ring-1 ring-brand-secondary/25 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="processor.isProcessing.value"
          @click="showFrames = true"
        >
          <svg class="h-4 w-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="16" rx="2" stroke-width="2" />
            <rect x="7" y="8" width="10" height="8" rx="1" stroke-width="2" />
          </svg>
          Marcos
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full bg-brand-surface/60 px-3 py-2 text-xs font-bold text-zinc-200 ring-1 ring-brand-secondary/25 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="processor.isProcessing.value"
          @click="showDesign = true"
        >
          <svg class="h-4 w-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          Diseño
        </button>

        <div
          class="flex items-center rounded-full bg-brand-surface/60 p-1 ring-1 ring-brand-secondary/25"
          role="radiogroup"
          aria-label="Versión del recorte"
        >
          <button
            v-for="option in engineOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="processor.engine.value === option.value"
            :title="option.hint"
            :disabled="processor.isProcessing.value"
            class="rounded-full px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
            :class="processor.engine.value === option.value
              ? 'bg-brand-secondary text-brand-bg shadow shadow-brand-secondary/25'
              : 'text-zinc-300 hover:text-white'"
            @click="processor.engine.value = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </header>

    <section class="relative overflow-hidden">
      <div
        class="absolute inset-x-0 bottom-0 h-24 opacity-20 stripe-energy deco-stripes"
      />
      <svg
        class="sparkle deco-sparkle absolute left-[8%] top-14 w-6 h-6 text-brand-primary"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
      </svg>
      <svg
        class="sparkle-delay deco-sparkle absolute right-[10%] top-24 w-5 h-5 text-brand-secondary"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
      </svg>
      <svg
        class="sparkle-delay-2 deco-sparkle absolute right-[22%] top-10 w-4 h-4 text-brand-accent"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
      </svg>

      <div class="hero relative max-w-5xl mx-auto px-4 pt-12 pb-14 text-center">
        <template v-for="blockId in layout.heroOrder" :key="blockId">
          <LayoutEl v-if="blockId === 'badge'" id="badge">
            <p
              class="inline-flex items-center gap-2 rounded-full border border-brand-secondary/30 bg-brand-secondary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-secondary"
            >
              <svg class="w-3.5 h-3.5 text-brand-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
              </svg>
              <BrandText k="badge" />
            </p>
          </LayoutEl>

          <LayoutEl v-else-if="blockId === 'title'" id="title">
            <h2 class="hero-title font-display text-4xl sm:text-6xl text-white">
              <BrandText k="heroTitleStart" />{{ ' ' }}<span class="hero-highlight text-brand-primary"><BrandText k="heroTitleHighlight" /></span>{{ ' ' }}<BrandText k="heroTitleEnd" />
            </h2>
          </LayoutEl>

          <LayoutEl v-else-if="blockId === 'subtitle'" id="subtitle">
            <p class="hero-sub mx-auto max-w-xl text-base sm:text-lg text-zinc-400">
              <BrandText k="heroSubtitle" />
            </p>
          </LayoutEl>

          <LayoutEl v-else-if="blockId === 'chips'" id="chips">
            <div class="hero-chips flex flex-wrap items-center justify-center gap-3">
              <span
                class="inline-flex items-center gap-2 rounded-full bg-brand-surface/60 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-brand-secondary/25"
              >
                <svg class="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
                </svg>
                <BrandText k="chip1" />
              </span>
              <span
                class="inline-flex items-center gap-2 rounded-full bg-brand-surface/60 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-brand-secondary/25"
              >
                <svg class="w-4 h-4 text-brand-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <BrandText k="chip2" />
              </span>
              <span
                class="inline-flex items-center gap-2 rounded-full bg-brand-surface/60 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-brand-secondary/25"
              >
                <svg class="w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <BrandText k="chip3" />
              </span>
            </div>
          </LayoutEl>

          <LayoutEl v-else-if="customBlocks.get(blockId)" :id="blockId">
            <CustomBlockView :block="customBlocks.get(blockId)!" />
          </LayoutEl>
        </template>
      </div>
    </section>

    <main class="relative max-w-3xl mx-auto px-4 pb-16">
      <div v-if="!processor.resultUrl.value" class="flex flex-col items-center gap-8">
        <LayoutEl id="stepHeading" class="self-stretch text-center">
          <p class="font-display text-sm font-bold uppercase tracking-widest text-brand-secondary">
            <BrandText k="stepKicker" />
          </p>
          <h3 class="mt-1 font-display text-2xl font-extrabold text-white">
            <BrandText k="stepTitle" />
          </h3>
        </LayoutEl>

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
          <p class="text-sm font-semibold text-zinc-400"><BrandText k="styleLabel" /></p>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <button
              v-for="option in backgroundOptions"
              :key="option.value"
              type="button"
              class="rounded-full px-4 py-2 text-sm font-semibold transition"
              :class="processor.backgroundMode.value === option.value
                ? 'bg-brand-secondary text-brand-bg shadow-lg shadow-brand-secondary/25'
                : 'bg-brand-surface/60 text-zinc-300 ring-1 ring-brand-secondary/25 hover:text-white'"
              @click="processor.backgroundMode.value = option.value"
            >
              <BrandText k="styleOption" />
            </button>
          </div>

          <button
            type="button"
            class="inline-flex items-center gap-2 btn-primary rounded-xl bg-brand-primary px-8 py-3 font-display font-bold text-brand-bg shadow-lg shadow-brand-primary/20 transition hover:brightness-105 hover:shadow-brand-primary/30 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500 disabled:shadow-none"
            @click="processor.process()"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
            </svg>
            <BrandText k="processButton" />
          </button>
        </div>
      </div>

      <ResultPreview
        v-else
        :image-url="processor.resultUrl.value"
        @download="processor.download(t.downloadFilename)"
        @print="processor.print()"
        @reset="processor.reset()"
      />
    </main>

    <footer class="relative border-t border-brand-secondary/15">
      <LayoutEl id="footer" class="max-w-5xl mx-auto px-4 py-8 text-center">
        <p class="text-sm font-semibold text-zinc-400">
          <BrandText k="footerLine" />
        </p>
        <p class="mt-1 text-xs text-zinc-600"><BrandText k="footerSubline" /></p>
      </LayoutEl>
    </footer>

    <ProcessingOverlay :visible="processor.isProcessing.value" />
    <FrameManager :open="showFrames" @close="showFrames = false" />
    <BrandingEditor :open="showDesign" @close="showDesign = false" />
    <InlineTextEditor />
  </div>
</template>

<script setup lang="ts">
import type { BackgroundMode, Engine } from '../types/image'

const branding = useBranding()
await callOnce('branding', branding.load)

const t = branding.texts
const logoUrl = branding.logoUrl
const layout = branding.layout
const customBlocks = computed(() => new Map(layout.value.custom.map((b) => [b.id, b])))

// Forma y tamaño del logo (modo "Personalizar"). Sin forma = el logo tal cual, sin recortar.
const logoShapeClass = computed(() => ({
  none: 'object-contain',
  circle: 'rounded-full object-cover ring-2 ring-brand-primary/70 shadow-lg shadow-brand-bg/60',
  rounded: 'rounded-xl object-cover shadow-lg shadow-brand-bg/60'
})[layout.value.logoShape])
const logoStyle = computed(() => {
  const size = `${layout.value.logoSize}px`
  return layout.value.logoShape === 'none'
    ? { height: size, width: 'auto', maxWidth: `${layout.value.logoSize * 4}px` }
    : { height: size, width: size }
})

useHead(computed(() => ({
  title: `${t.value.appName} ${t.value.appNameHighlight}`.trim(),
  htmlAttrs: templateHtmlAttrs(branding.template.value, branding.brand.value.colors),
  link: [
    { key: 'brand-icon', rel: 'icon', href: logoUrl.value },
    { key: 'brand-fonts', rel: 'stylesheet', href: googleFontsHref(branding.template.value.googleFonts) }
  ]
})))

const processor = useImageProcessor()
const showFrames = ref(false)
const showDesign = ref(false)

const backgroundOptions: { value: BackgroundMode }[] = [
  { value: 'original-overlay' }
]

const engineOptions: { value: Engine; label: string; hint: string }[] = [
  { value: 'ligero', label: 'Modo ligero', hint: 'Rápido y usa poca memoria. Recomendado para PCs de 8 GB o menos.' },
  { value: 'calidad', label: 'Alta calidad', hint: 'Bordes más finos (pelo, dedos), pero necesita ~6 GB de RAM libre (PCs de 16 GB).' }
]

function onFileSelected(file: File) {
  processor.setFile(file)
}
</script>

<style scoped>
.stripe-energy {
  background: repeating-linear-gradient(
    -45deg,
    rgb(var(--brand-primary)) 0 26px,
    rgb(var(--brand-secondary)) 26px 52px,
    rgb(var(--brand-accent)) 52px 78px
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
