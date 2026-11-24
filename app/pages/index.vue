<template>
  <div class="lonc flex min-h-dvh flex-col bg-black text-zinc-100 antialiased">
    <div class="glow pointer-events-none fixed inset-0" aria-hidden="true" />

    <!-- ============ Barra superior ============ -->
    <header class="relative z-10">
      <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div class="flex items-center gap-3">
          <span class="wordmark text-lg font-bold tracking-tight text-white">LONC</span>
          <span class="hidden text-sm text-zinc-500 sm:inline">La Oveja Negra Creativa</span>
        </div>
        <div class="flex items-center gap-4 text-sm text-zinc-400">
          <span v-if="activeEvent" class="hidden items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 sm:inline-flex">
            <span class="live-dot h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            {{ activeEvent }}
          </span>
          <span class="tabular-nums text-zinc-300" aria-label="Hora actual">{{ clock }}</span>
        </div>
      </div>
    </header>

    <!-- ============ Herramientas ============ -->
    <main class="relative z-10 flex flex-1 items-center">
      <div class="mx-auto w-full max-w-5xl px-6 py-10">
        <div class="enter" style="--d: 0ms">
          <p class="text-sm text-zinc-500">{{ greeting }}</p>
          <h1 class="mt-1 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Herramientas</h1>
        </div>

        <ul class="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          <li
            v-for="(tool, i) in tools"
            :key="tool.name"
            class="enter"
            :style="{ '--d': `${80 + i * 45}ms` }"
          >
            <component
              :is="tool.to ? NuxtLinkComp : 'div'"
              :to="tool.to"
              :aria-disabled="tool.to ? undefined : 'true'"
              class="tile group relative flex h-full flex-col rounded-3xl p-5 sm:p-6"
              :class="tool.to
                ? 'tile-active bg-zinc-900 ring-1 ring-white/10 hover:bg-zinc-800/80 hover:ring-white/20'
                : 'cursor-default bg-zinc-950 ring-1 ring-white/[0.05]'"
            >
              <div class="flex items-start justify-between">
                <!-- Icono tipo app -->
                <span
                  class="icon flex h-12 w-12 items-center justify-center rounded-[14px] sm:h-14 sm:w-14 sm:rounded-2xl"
                  :class="tool.to ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-500'"
                >
                  <svg class="h-6 w-6 sm:h-7 sm:w-7" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24" aria-hidden="true" v-html="tool.icon" />
                </span>

                <span
                  v-if="tool.to"
                  class="inline-flex items-center gap-1.5 text-xs font-medium text-red-400"
                ><span class="live-dot h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />Activo</span>
                <span v-else class="text-xs text-zinc-600">Próximamente</span>
              </div>

              <div class="mt-8 sm:mt-10" :class="tool.to ? 'pr-7' : ''">
                <h2 class="text-base font-semibold sm:text-lg" :class="tool.to ? 'text-white' : 'text-zinc-400'">
                  {{ tool.name }}
                </h2>
                <p class="mt-1 text-sm leading-snug" :class="tool.to ? 'text-zinc-400' : 'text-zinc-600'">
                  {{ tool.desc }}
                </p>
              </div>

              <svg
                v-if="tool.to"
                class="absolute bottom-6 right-6 h-5 w-5 text-zinc-500 transition duration-300 group-hover:translate-x-0.5 group-hover:text-white"
                fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </component>
          </li>
        </ul>
      </div>
    </main>

    <footer class="relative z-10">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 text-xs text-zinc-600">
        <span>La Oveja Negra Creativa S.A.S</span>
        <span>Sistema LONC</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const NuxtLinkComp = resolveComponent('NuxtLink')

const branding = useBranding()
await callOnce('branding', branding.load)
const activeEvent = computed(() => branding.active.value.name)

useHead({
  title: 'LONC · Herramientas',
  htmlAttrs: { style: 'background-color:#000' },
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }
  ]
})

// Reloj y saludo; se calculan en el cliente para no romper la hidratación.
const clock = ref('')
const greeting = ref('Hola')
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  const update = () => {
    const now = new Date()
    clock.value = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    const h = now.getHours()
    greeting.value = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  }
  update()
  timer = setInterval(update, 10_000)
})
onBeforeUnmount(() => clearInterval(timer))

// Iconos de trazo 24x24 con el mismo grosor.
const tools = [
  {
    name: 'Change BG',
    desc: 'Photo booth: cambia el fondo e imprime.',
    to: '/change-bg',
    icon: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path stroke-linejoin="round" d="M8.5 6l1.2-2h4.6l1.2 2"/>'
  },
  {
    name: 'Slow Motion',
    desc: 'Efecto glambot: cámara lenta, zoom y color.',
    to: '/slowmotion',
    icon: '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2"/>'
  },
  {
    name: 'Grabación',
    desc: 'Cobertura de eventos.',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>'
  },
  {
    name: 'Multicámara',
    desc: 'Señales en vivo y repeticiones.',
    icon: '<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>'
  },
  {
    name: 'Streaming',
    desc: 'Transmisión en directo.',
    icon: '<circle cx="12" cy="12" r="2"/><path stroke-linecap="round" d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.6 5.6a9 9 0 000 12.8M18.4 5.6a9 9 0 010 12.8"/>'
  },
  {
    name: 'Edición',
    desc: 'Montaje, color y sonido.',
    icon: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path stroke-linecap="round" d="M8.5 8.5L20 19M8.5 15.5L20 5"/>'
  },
  {
    name: 'Biblioteca',
    desc: 'Fotos y videos de cada evento.',
    icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path stroke-linecap="round" d="M3 9h18M7 5v4M12 5v4M17 5v4"/>'
  }
]
</script>

<style scoped>
.lonc {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.wordmark::after {
  content: '';
  display: inline-block;
  width: 0.3em;
  height: 0.3em;
  margin-left: 0.1em;
  border-radius: 9999px;
  background: #ef4444;
}

.glow {
  background: radial-gradient(ellipse 70% 50% at 50% -10%, rgba(255, 255, 255, 0.06), transparent 70%);
}

/* Entrada única y escalonada */
.enter {
  animation: enter 0.7s var(--ease) both;
  animation-delay: var(--d, 0ms);
}
@keyframes enter {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

.tile {
  transition: background-color 0.25s var(--ease), box-shadow 0.25s var(--ease), transform 0.25s var(--ease);
}
.tile-active:hover {
  transform: translateY(-2px);
}
.tile-active:active {
  transform: scale(0.98);
}
.tile-active:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}

.live-dot {
  animation: breathe 2.4s ease-in-out infinite;
}
@keyframes breathe {
  50% { opacity: 0.35; }
}

@media (prefers-reduced-motion: reduce) {
  .enter,
  .live-dot {
    animation: none;
  }
  .tile {
    transition: none;
  }
}
</style>
