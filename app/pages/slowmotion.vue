<template>
  <div class="lonc min-h-dvh bg-black text-zinc-100 antialiased">
    <header class="border-b border-white/10">
      <div class="mx-auto flex h-16 max-w-4xl items-center gap-3 px-6">
        <NuxtLink
          v-if="!busy" to="/"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300 ring-1 ring-white/10 transition hover:text-white"
          aria-label="Volver a Herramientas"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </NuxtLink>
        <h1 class="text-lg font-semibold tracking-tight">Slow Motion <span class="text-red-500">Glambot</span></h1>
      </div>
    </header>

    <main class="mx-auto grid max-w-4xl gap-8 px-6 py-8 md:grid-cols-2">
      <!-- Entrada -->
      <section class="space-y-5">
        <label
          class="flex aspect-[9/16] max-h-[60dvh] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl bg-zinc-900 ring-1 ring-white/10 transition hover:ring-white/25"
          :class="dragging ? 'ring-white/40' : ''"
          @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop"
        >
          <video v-if="sourceUrl" :src="sourceUrl" class="h-full w-full object-cover" muted loop autoplay playsinline />
          <span v-else class="px-6 text-center text-sm text-zinc-400">
            Toca o arrastra el video aquí<br><span class="text-xs text-zinc-600">MP4, MOV, WebM · hasta 2 GB · se usan los primeros 6 s</span>
          </span>
          <input type="file" accept="video/*" class="sr-only" :disabled="busy" @change="onPick">
        </label>
        <p v-if="file" class="truncate text-sm text-zinc-400">{{ file.name }} · {{ (file.size / 1024 / 1024).toFixed(1) }} MB</p>
      </section>

      <!-- Ajustes y resultado -->
      <section class="space-y-6">
        <div class="space-y-5 rounded-3xl bg-zinc-900 p-5 ring-1 ring-white/10">
          <div>
            <label class="text-sm font-medium" for="zoom">Acercamiento: {{ Math.round(zoom * 100) }}%</label>
            <input id="zoom" v-model.number="zoom" type="range" min="0" max="0.4" step="0.02" class="mt-2 w-full accent-red-500" :disabled="busy">
          </div>
          <div v-if="track">
            <label class="text-sm font-medium" for="fill">Acercar si se ve lejos: llena {{ Math.round(fill * 100) }}% del cuadro</label>
            <input id="fill" v-model.number="fill" type="range" min="0.4" max="0.9" step="0.02" class="mt-2 w-full accent-red-500" :disabled="busy">
          </div>
          <label class="flex items-center gap-2 text-sm font-medium">
            <input v-model="track" type="checkbox" class="accent-red-500" :disabled="busy"> Detectar poses y mejores tomas
          </label>
          <label class="flex items-center gap-2 text-sm font-medium">
            <input v-model="rewind" type="checkbox" class="accent-red-500" :disabled="busy"> Rebobinar hacia atrás (rewind)
          </label>
          <div>
            <label class="text-sm font-medium" for="music">Música</label>
            <div class="mt-2 flex gap-2">
              <select id="music" v-model="music" class="min-w-0 flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm ring-1 ring-white/10" :disabled="busy">
                <option value="">Sin música</option>
                <option v-for="m in musicList" :key="m" :value="m">{{ m }}</option>
              </select>
              <label class="cursor-pointer rounded-xl bg-zinc-800 px-3 py-2 text-sm ring-1 ring-white/10 transition hover:bg-zinc-700">
                Subir
                <input type="file" accept="audio/*" class="sr-only" :disabled="busy" @change="onMusic">
              </label>
            </div>
            <div v-if="music" class="mt-3 space-y-2">
              <audio ref="audioEl" :src="`/slowmo-music/${encodeURIComponent(music)}`" controls class="w-full" @loadedmetadata="musicLen = audioEl?.duration || 0" />
              <label class="block text-xs text-zinc-400" for="mstart">Empieza en {{ fmt(musicStart) }}<template v-if="musicLen"> de {{ fmt(musicLen) }}</template></label>
              <input id="mstart" v-model.number="musicStart" type="range" min="0" :max="Math.max(0, Math.floor(musicLen) - 1)" step="0.5" class="w-full accent-red-500" :disabled="busy" @input="seek">
              <button type="button" class="text-xs text-red-400 hover:text-red-300 disabled:opacity-40" :disabled="busy" @click="musicStart = Math.round((audioEl?.currentTime ?? 0) * 2) / 2">Empezar donde suena ahora</button>
            </div>
          </div>
          <div>
            <label class="flex items-center gap-2 text-sm font-medium">
              <input v-model="outro" type="checkbox" class="accent-red-500" :disabled="busy || !outroVersion"> Tarjeta final con logos
            </label>
            <div class="mt-2 flex items-center gap-3">
              <img v-if="outroVersion" :src="`/slowmo-outro?v=${outroVersion}`" alt="Tarjeta final" class="h-20 rounded-lg ring-1 ring-white/10">
              <p v-else class="text-xs text-zinc-500">Aún no hay tarjeta. Sube una imagen con los logos.</p>
              <label class="cursor-pointer rounded-xl bg-zinc-800 px-3 py-2 text-sm ring-1 ring-white/10 transition hover:bg-zinc-700">
                {{ outroVersion ? 'Cambiar' : 'Subir' }}
                <input type="file" accept="image/*" class="sr-only" :disabled="busy" @change="onOutro">
              </label>
            </div>
          </div>
          <button
            class="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!file || busy" @click="start"
          >
            {{ busy ? 'Procesando…' : 'Crear slow motion' }}
          </button>
        </div>

        <div v-if="busy" class="space-y-2" role="status">
          <div class="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div class="h-full rounded-full bg-red-500 transition-[width] duration-500" :style="{ width: `${Math.round(progress * 100)}%` }" />
          </div>
          <p class="text-sm text-zinc-400">
            {{ phase === 'uploading' ? 'Subiendo video…' : phase === 'queued' ? 'En cola…' : note ? note : `Generando ${Math.round(progress * 100)}% · puede tardar un par de minutos` }}
          </p>
        </div>

        <p v-if="error" class="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/30" role="alert">{{ error }}</p>

        <div v-if="resultUrl" class="space-y-3">
          <video :src="resultUrl" class="mx-auto max-h-[60dvh] rounded-3xl ring-1 ring-white/10" controls autoplay loop playsinline />
          <a
            :href="`${resultUrl}?download=1`"
            class="block rounded-2xl bg-red-500 py-3 text-center text-sm font-semibold text-white transition hover:bg-red-400"
          >Descargar MP4</a>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'LONC · Slow Motion',
  htmlAttrs: { style: 'background-color:#000' },
  link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }]
})

interface Job { id: string, status: 'queued' | 'processing' | 'done' | 'error', progress: number, message?: string }

const file = ref<File | null>(null)
const sourceUrl = ref<string | null>(null)
const dragging = ref(false)
const zoom = ref(0.18)
const music = ref('')
const musicList = ref<string[]>([])
const outro = ref(true)
const rewind = ref(true)
const track = ref(true)
const fill = ref(0.72)
const note = ref('')
const outroVersion = ref(0)
async function loadOutro() {
  try { outroVersion.value = (await $fetch<{ version: number }>('/api/slowmo/outro')).version } catch {}
}
async function onOutro(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  try {
    const body = new FormData()
    body.append('card', f)
    await $fetch('/api/slowmo/outro', { method: 'POST', body })
    await loadOutro()
    outro.value = true
  } catch (err) {
    error.value = errMsg(err)
  }
}
const musicStart = ref(0)
const musicLen = ref(0)
const audioEl = ref<HTMLAudioElement | null>(null)
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const seek = () => { if (audioEl.value) audioEl.value.currentTime = musicStart.value }
watch(music, () => { musicStart.value = 0; musicLen.value = 0 })
const phase = ref<'idle' | 'uploading' | 'queued' | 'processing'>('idle')
const progress = ref(0)
const error = ref<string | null>(null)
const resultUrl = ref<string | null>(null)
const busy = computed(() => phase.value !== 'idle')

const errMsg = (e: any) => e?.data?.statusMessage || e?.statusMessage || e?.message || 'Ocurrió un error inesperado.'

async function loadMusic() {
  try { musicList.value = (await $fetch<{ files: string[] }>('/api/slowmo/music')).files } catch {}
}
onMounted(() => { loadMusic(); loadOutro() })
onBeforeUnmount(() => sourceUrl.value && URL.revokeObjectURL(sourceUrl.value))

function setFile(f?: File | null) {
  if (!f) return
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  file.value = f
  sourceUrl.value = URL.createObjectURL(f)
  resultUrl.value = null
  error.value = null
}
const onPick = (e: Event) => setFile((e.target as HTMLInputElement).files?.[0])
function onDrop(e: DragEvent) {
  dragging.value = false
  setFile(e.dataTransfer?.files?.[0])
}

async function onMusic(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  try {
    const body = new FormData()
    body.append('music', f)
    const { name } = await $fetch<{ name: string }>('/api/slowmo/music', { method: 'POST', body })
    await loadMusic()
    music.value = name
  } catch (err) {
    error.value = errMsg(err)
  }
}

async function start() {
  if (!file.value) return
  error.value = null
  resultUrl.value = null
  progress.value = 0
  phase.value = 'uploading'
  try {
    const params = new URLSearchParams({
      ext: file.value.name.match(/\.[^.]+$/)?.[0] ?? '.mp4',
      zoom: String(zoom.value),
      outro: String(outro.value),
      rewind: String(rewind.value),
      track: String(track.value),
      fill: String(fill.value)
    })
    if (music.value) {
      params.set('music', music.value)
      params.set('musicStart', String(musicStart.value))
    }
    // Cuerpo crudo: el servidor lo guarda en streaming (los videos de celular son muy grandes).
    let job = await $fetch<Job>(`/api/slowmo?${params}`, {
      method: 'POST',
      body: file.value,
      headers: { 'Content-Type': 'application/octet-stream' }
    })

    while (job.status === 'queued' || job.status === 'processing') {
      phase.value = job.status
      progress.value = job.progress
      note.value = job.message ?? ''
      await new Promise((r) => setTimeout(r, 1000))
      job = await $fetch<Job>(`/api/slowmo/${job.id}`)
    }
    if (job.status === 'error') throw new Error(job.message || 'No se pudo procesar el video.')
    resultUrl.value = `/slowmo-output/${job.id}`
  } catch (err) {
    error.value = errMsg(err)
  } finally {
    phase.value = 'idle'
  }
}
</script>

<style scoped>
.lonc { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
</style>
