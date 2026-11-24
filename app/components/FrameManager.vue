<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-brand-bg ring-1 ring-brand-secondary/25 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="frame-manager-title"
      >
        <div class="flex items-center justify-between border-b border-brand-secondary/15 px-6 py-4">
          <div>
            <h2 id="frame-manager-title" class="font-display text-lg font-extrabold text-white">Marcos</h2>
            <p class="text-xs text-zinc-400">Elige el marco que se usa en las fotos o sube uno nuevo.</p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="overflow-y-auto px-6 py-5">
          <div class="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-brand-secondary/30 bg-brand-surface/40 p-5 sm:flex-row sm:items-center">
            <div class="flex-1">
              <p class="font-display text-sm font-bold text-white">Subir marco personalizado</p>
              <p class="mt-1 text-xs text-zinc-400">
                PNG con el hueco de la foto transparente. Se ajusta solo a {{ frameHeight }} px de alto
                sin deformarse. Ideal: {{ frameHeight }} px de alto o más.
              </p>
            </div>
            <input ref="fileInput" type="file" accept="image/png,image/webp" class="hidden" @change="onFilePicked" />
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 btn-primary rounded-xl bg-brand-primary px-5 py-2.5 font-display text-sm font-bold text-brand-bg shadow-lg shadow-brand-primary/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
              :disabled="busy"
              @click="fileInput?.click()"
            >
              <svg v-if="uploading" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {{ uploading ? 'Ajustando marco…' : 'Subir marco' }}
            </button>
          </div>

          <p v-if="errorMessage" class="mt-3 rounded-xl bg-brand-accent/10 px-4 py-2.5 text-sm text-red-300 ring-1 ring-brand-accent/30">
            {{ errorMessage }}
          </p>
          <p v-if="warningMessage" class="mt-3 rounded-xl bg-brand-primary/10 px-4 py-2.5 text-sm text-yellow-200 ring-1 ring-brand-primary/30">
            {{ warningMessage }}
          </p>

          <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              v-for="frame in frames"
              :key="frame.id"
              class="overflow-hidden rounded-2xl bg-brand-surface/50 ring-2 transition"
              :class="frame.id === active ? 'ring-brand-secondary' : 'ring-transparent'"
            >
              <div class="checker flex aspect-[3/2] items-center justify-center p-2">
                <img
                  :src="`/frame-thumb/${frame.id}.png?v=${thumbVersion}`"
                  :alt="frame.name"
                  class="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              </div>
              <div class="flex items-center gap-2 px-3 py-2.5">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-white" :title="frame.name">{{ frame.name }}</p>
                  <p class="text-[11px] text-zinc-500">{{ frame.width }} × {{ frame.height }} px</p>
                </div>
                <span
                  v-if="frame.id === active"
                  class="rounded-full bg-brand-secondary px-2.5 py-1 text-[11px] font-bold text-brand-bg"
                >
                  En uso
                </span>
                <button
                  v-else
                  type="button"
                  class="rounded-full px-3 py-1 text-xs font-bold text-brand-secondary ring-1 ring-brand-secondary/40 transition hover:bg-brand-secondary/10 disabled:opacity-50"
                  :disabled="busy"
                  @click="activate(frame.id)"
                >
                  Usar
                </button>
                <button
                  v-if="!frame.builtIn"
                  type="button"
                  class="rounded-full p-1.5 text-zinc-500 transition hover:bg-brand-accent/10 hover:text-red-300 disabled:opacity-50"
                  :aria-label="`Borrar ${frame.name}`"
                  :disabled="busy"
                  @click="remove(frame)"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface FrameEntry {
  id: string
  name: string
  width: number
  height: number
  builtIn: boolean
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const frameHeight = 2400
const frames = ref<FrameEntry[]>([])
const active = ref('default')
const uploading = ref(false)
const busy = ref(false)
const errorMessage = ref<string | null>(null)
const warningMessage = ref<string | null>(null)
const thumbVersion = ref(Date.now())
const fileInput = ref<HTMLInputElement | null>(null)

// Avisa al resto de la app (guía de la cámara) que cambió el marco.
const frameVersion = useState('frame-version', () => 0)

function errorText(e: unknown): string {
  const err = e as { data?: { statusMessage?: string; message?: string }; statusMessage?: string }
  return err?.data?.message ?? err?.data?.statusMessage ?? err?.statusMessage ?? 'Ocurrió un error inesperado'
}

async function load() {
  try {
    const data = await $fetch<{ active: string; frames: FrameEntry[] }>('/api/frames')
    frames.value = data.frames
    active.value = data.active
  } catch (e) {
    errorMessage.value = errorText(e)
  }
}

async function run(task: () => Promise<void>) {
  busy.value = true
  errorMessage.value = null
  try {
    await task()
  } catch (e) {
    errorMessage.value = errorText(e)
  } finally {
    busy.value = false
  }
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  warningMessage.value = null
  uploading.value = true
  await run(async () => {
    const form = new FormData()
    form.append('frame', file)
    const result = await $fetch<{ warning: string | null }>('/api/frames', { method: 'POST', body: form })
    warningMessage.value = result.warning
    thumbVersion.value = Date.now()
    frameVersion.value++
    await load()
  })
  uploading.value = false
}

async function activate(id: string) {
  await run(async () => {
    await $fetch('/api/frames/active', { method: 'POST', body: { id } })
    active.value = id
    frameVersion.value++
  })
}

async function remove(frame: FrameEntry) {
  if (!confirm(`¿Borrar el marco "${frame.name}"? No se puede deshacer.`)) return
  await run(async () => {
    await $fetch(`/api/frames/${frame.id}`, { method: 'DELETE' })
    frameVersion.value++
    await load()
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      errorMessage.value = null
      warningMessage.value = null
      load()
    }
  },
  { immediate: true }
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.checker {
  background-color: #1b2a44;
  background-image:
    linear-gradient(45deg, #24365a 25%, transparent 25%),
    linear-gradient(-45deg, #24365a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #24365a 75%),
    linear-gradient(-45deg, transparent 75%, #24365a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
</style>
