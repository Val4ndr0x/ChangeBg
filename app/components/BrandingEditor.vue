<template>
  <Teleport to="body">
    <Transition name="slide">
      <aside
        v-if="open && draft"
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-brand-bg shadow-2xl ring-1 ring-brand-secondary/25"
        role="dialog"
        aria-modal="false"
        aria-labelledby="branding-title"
      >
        <!-- Encabezado -->
        <div class="flex items-center justify-between border-b border-brand-secondary/15 px-5 py-4">
          <div>
            <h2 id="branding-title" class="font-display text-lg font-extrabold text-white">Diseño del evento</h2>
            <p class="text-xs text-zinc-400">
              Los cambios se ven en vivo. <span class="text-brand-primary">Doble clic</span> en un texto o en el logo de la página para editarlo ahí mismo.
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
            @click="close"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div v-if="customizeMode" class="flex-1 overflow-y-auto px-5 py-5">
          <CustomizePanel />
        </div>

        <div v-else class="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <!-- Eventos guardados -->
          <section class="rounded-2xl bg-brand-surface/50 p-4 ring-1 ring-brand-secondary/20">
            <label class="field-label" for="event-select">Evento en uso</label>
            <div class="mt-1.5 flex gap-2">
              <select
                id="event-select"
                class="field flex-1"
                :value="state?.active"
                :disabled="busy"
                @change="switchEvent($event.target as HTMLSelectElement)"
              >
                <option v-for="p in state?.profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" class="chip-btn" :disabled="busy" @click="newEvent">
                + Nuevo evento (copia del actual)
              </button>
              <button
                v-if="draft.id !== DEFAULT_PROFILE_ID"
                type="button"
                class="chip-btn danger"
                :disabled="busy"
                @click="deleteEvent"
              >
                Borrar evento
              </button>
            </div>
            <label class="field-label mt-4" for="event-name">Nombre interno del evento</label>
            <input id="event-name" v-model="draft.name" class="field mt-1.5" maxlength="60" />
          </section>

          <!-- Logo -->
          <details class="group panel" open>
            <summary class="panel-title">Logo</summary>
            <div class="mt-3 flex items-center gap-4">
              <img :src="logoUrl" alt="Logo actual" class="h-16 w-auto max-w-[8rem] object-contain" />
              <div class="flex flex-col gap-2">
                <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" @change="onLogoPicked" />
                <button type="button" class="chip-btn" :disabled="busy" @click="logoInput?.click()">
                  {{ uploadingLogo ? 'Subiendo…' : 'Cambiar logo' }}
                </button>
                <button v-if="draft.logo" type="button" class="text-left text-xs text-zinc-400 underline hover:text-white" @click="draft.logo = null">
                  Usar el logo original
                </button>
              </div>
            </div>
            <p class="mt-2 text-xs text-zinc-500">Cuadrado, PNG con fondo transparente. También se usa como ícono de la pestaña.</p>
          </details>

          <!-- Plantillas -->
          <details class="group panel" open>
            <summary class="panel-title">Plantilla de diseño</summary>
            <p class="mt-3 text-xs text-zinc-400">
              Cambia la tipografía, las formas, el fondo y los botones. Después puedes ajustar colores y textos.
            </p>
            <button type="button" class="customize-cta mt-3" @click="customizeMode = true">
              <span class="text-base">✦</span>
              <span class="flex-1 text-left">
                <span class="block text-sm font-bold">Personalizar</span>
                <span class="block text-[11px] font-normal opacity-80">Tamaños, colores, posiciones, letras; añade o quita bloques.</span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
            <label class="mt-3 flex items-center gap-2 text-xs text-zinc-300">
              <input v-model="applyTemplateColors" type="checkbox" class="h-4 w-4 accent-current" />
              Aplicar también su paleta de colores
            </label>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                v-for="tpl in DESIGN_TEMPLATES"
                :key="tpl.id"
                type="button"
                class="tpl-card"
                :class="draft.template === tpl.id ? 'is-active' : ''"
                :style="{
                  backgroundColor: tpl.colors.background,
                  borderRadius: `${Math.min(tpl.radius, 1)}rem`,
                  '--tpl-primary': tpl.colors.primary,
                  '--tpl-secondary': tpl.colors.secondary
                }"
                :aria-pressed="draft.template === tpl.id"
                @click="applyTemplate(tpl)"
              >
                <span
                  class="block truncate text-lg leading-tight text-white"
                  :style="{
                    fontFamily: tpl.fontDisplay,
                    fontWeight: tpl.title.weight,
                    fontStyle: tpl.title.italic ? 'italic' : 'normal',
                    textTransform: tpl.title.uppercase ? 'uppercase' : 'none'
                  }"
                >
                  {{ tpl.name }}
                </span>
                <span class="mt-1 block text-[11px] leading-snug text-zinc-400" :style="{ fontFamily: tpl.fontBody }">
                  {{ tpl.description }}
                </span>
                <span class="mt-2 flex items-center gap-1.5">
                  <span
                    class="inline-block px-2 py-0.5 text-[10px] font-bold"
                    :style="{
                      backgroundColor: tpl.buttons === 'outline' ? 'transparent' : tpl.colors.primary,
                      color: tpl.buttons === 'outline' ? tpl.colors.primary : tpl.colors.background,
                      border: tpl.buttons === 'outline' ? `1px solid ${tpl.colors.primary}` : tpl.buttons === 'brutal' ? '1.5px solid #000' : 'none',
                      boxShadow: tpl.buttons === 'brutal' ? `2px 2px 0 ${tpl.colors.secondary}` : tpl.buttons === 'neon' ? `0 0 8px ${tpl.colors.primary}` : 'none',
                      borderRadius: `${tpl.radius * 0.5}rem`,
                      fontFamily: tpl.fontDisplay
                    }"
                  >Botón</span>
                  <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: tpl.colors.secondary }" />
                  <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: tpl.colors.accent }" />
                </span>
              </button>
            </div>
          </details>

          <!-- Colores -->
          <details class="group panel">
            <summary class="panel-title">Tema y colores</summary>
            <p class="mt-3 text-xs text-zinc-400">Elige un tema de ejemplo y luego ajusta cada color a tu gusto.</p>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <button
                v-for="theme in THEME_PRESETS"
                :key="theme.name"
                type="button"
                class="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 ring-1 transition hover:text-white"
                :class="isThemeApplied(theme.colors) ? 'ring-2 ring-brand-primary' : 'ring-white/10 hover:ring-white/30'"
                :style="{ backgroundColor: theme.colors.background }"
                @click="draft.colors = { ...theme.colors }"
              >
                <span class="flex shrink-0 -space-x-1">
                  <span
                    v-for="c in [theme.colors.primary, theme.colors.secondary, theme.colors.accent]"
                    :key="c"
                    class="h-4 w-4 rounded-full ring-1 ring-black/30"
                    :style="{ backgroundColor: c }"
                  />
                </span>
                <span class="truncate">{{ theme.name }}</span>
              </button>
            </div>

            <div class="mt-4 space-y-3">
              <div v-for="field in COLOR_FIELDS" :key="field.key" class="flex items-center gap-3">
                <input
                  v-model="draft.colors[field.key]"
                  type="color"
                  class="h-9 w-11 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  :aria-label="field.label"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-white">{{ field.label }}</p>
                  <p class="text-[11px] leading-tight text-zinc-500">{{ field.hint }}</p>
                </div>
                <input
                  :value="draft.colors[field.key]"
                  class="field field-narrow font-mono text-xs uppercase"
                  maxlength="7"
                  @change="setHex(field.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </details>

          <!-- Textos -->
          <details v-for="section in TEXT_SECTIONS" :key="section.title" class="group panel">
            <summary class="panel-title">{{ section.title }}</summary>
            <div class="mt-3 space-y-3">
              <div v-for="field in section.fields" :key="field.key">
                <label class="field-label" :for="`txt-${field.key}`">{{ field.label }}</label>
                <textarea
                  v-if="field.multiline"
                  :id="`txt-${field.key}`"
                  v-model="draft.texts[field.key]"
                  rows="3"
                  maxlength="400"
                  class="field mt-1.5 resize-y"
                />
                <input
                  v-else
                  :id="`txt-${field.key}`"
                  v-model="draft.texts[field.key]"
                  maxlength="400"
                  class="field mt-1.5"
                />
              </div>
            </div>
          </details>

          <!-- Foto y marco -->
          <details class="group panel">
            <summary class="panel-title">Cámara y marco</summary>
            <div class="mt-3 space-y-3">
              <div>
                <label class="field-label" for="countdown">Cuenta regresiva (segundos)</label>
                <input id="countdown" v-model.number="draft.countdown" type="number" min="0" max="10" class="field field-narrow mt-1.5" />
              </div>
              <div>
                <label class="field-label" for="frame-select">Marco de este evento</label>
                <select id="frame-select" v-model="draft.frameId" class="field mt-1.5">
                  <option :value="null">No cambiar el marco al elegir el evento</option>
                  <option v-for="f in frames" :key="f.id" :value="f.id">{{ f.name }}</option>
                </select>
                <p class="mt-1 text-[11px] text-zinc-500">Los marcos se suben desde el botón «Marcos».</p>
              </div>
            </div>
          </details>
        </div>

        <!-- Pie con acciones -->
        <div class="border-t border-brand-secondary/15 px-5 py-4">
          <p v-if="errorMessage" class="mb-3 rounded-xl bg-brand-accent/10 px-3 py-2 text-sm text-red-300 ring-1 ring-brand-accent/30">
            {{ errorMessage }}
          </p>
          <div class="flex items-center gap-2">
            <span class="mr-auto text-xs" :class="dirty ? 'text-brand-primary' : 'text-zinc-500'">
              {{ dirty ? 'Cambios sin guardar' : savedFlash ? 'Guardado ✓' : 'Todo guardado' }}
            </span>
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-300 ring-1 ring-zinc-600 transition hover:text-white disabled:opacity-40"
              :disabled="!dirty || busy"
              @click="discard"
            >
              Descartar
            </button>
            <button
              type="button"
              class="rounded-xl bg-brand-primary px-5 py-2.5 font-display text-sm font-bold text-brand-bg shadow-lg shadow-brand-primary/20 transition hover:brightness-105 disabled:opacity-40"
              :disabled="!dirty || busy"
              @click="saveDraft"
            >
              Guardar
            </button>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  COLOR_FIELDS,
  DEFAULT_PROFILE_ID,
  DESIGN_TEMPLATES,
  TEXT_SECTIONS,
  THEME_PRESETS,
  type BrandColorKey,
  type BrandColors,
  type BrandProfile,
  type DesignTemplate
} from '../../types/branding'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { state, draft, active, logoUrl, save, uploadLogo, customizeMode, selectedEl } = useBranding()
const frameVersion = useState('frame-version', () => 0)

const frames = ref<{ id: string; name: string }[]>([])
const busy = ref(false)
const uploadingLogo = ref(false)
const savedFlash = ref(false)
const errorMessage = ref<string | null>(null)
const logoInput = ref<HTMLInputElement | null>(null)
const applyTemplateColors = ref(true)

// Carga la fuente de título de cada plantilla para mostrarlas en las tarjetas.
const previewFontsHref = googleFontsHref(
  DESIGN_TEMPLATES.map((t) => t.googleFonts.split('&')[0]).join('&')
)
useHead(computed(() => ({
  link: props.open ? [{ key: 'template-previews', rel: 'stylesheet', href: previewFontsHref }] : []
})))

function applyTemplate(tpl: DesignTemplate) {
  if (!draft.value) return
  draft.value.template = tpl.id
  if (applyTemplateColors.value) draft.value.colors = { ...tpl.colors }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== JSON.stringify(active.value))

function errorText(e: unknown): string {
  const err = e as { data?: { message?: string; statusMessage?: string } }
  return err?.data?.message ?? err?.data?.statusMessage ?? 'Ocurrió un error inesperado'
}

/** crypto.randomUUID solo existe en https/localhost; esto funciona también por IP en la red local. */
function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
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

async function persist(next: { active: string; profiles: BrandProfile[] }) {
  await save(next)
  draft.value = clone(active.value)
  // El servidor activa el marco del evento: avisa a la guía de la cámara.
  if (active.value.frameId) frameVersion.value++
}

function confirmDiscard(): boolean {
  return !dirty.value || confirm('Tienes cambios sin guardar. ¿Descartarlos?')
}

async function saveDraft() {
  const d = draft.value
  if (!d || !state.value) return
  await run(async () => {
    await persist({
      active: d.id,
      profiles: state.value!.profiles.map((p) => (p.id === d.id ? d : p))
    })
    savedFlash.value = true
    setTimeout(() => (savedFlash.value = false), 2000)
  })
}

function discard() {
  draft.value = clone(active.value)
}

async function switchEvent(select: HTMLSelectElement) {
  const id = select.value
  if (!state.value || id === state.value.active) return
  if (!confirmDiscard()) {
    select.value = state.value.active
    return
  }
  await run(() => persist({ active: id, profiles: state.value!.profiles }))
}

async function newEvent() {
  if (!state.value || !confirmDiscard()) return
  const copy: BrandProfile = { ...clone(active.value), id: uuid(), name: `Nuevo evento ${state.value.profiles.length}` }
  await run(() => persist({ active: copy.id, profiles: [...state.value!.profiles, copy] }))
}

async function deleteEvent() {
  const d = draft.value
  if (!state.value || !d || d.id === DEFAULT_PROFILE_ID) return
  if (!confirm(`¿Borrar el evento "${active.value.name}"? No se puede deshacer.`)) return
  await run(() =>
    persist({ active: DEFAULT_PROFILE_ID, profiles: state.value!.profiles.filter((p) => p.id !== d.id) })
  )
}

async function onLogoPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !draft.value) return
  uploadingLogo.value = true
  await run(async () => {
    draft.value!.logo = await uploadLogo(file)
  })
  uploadingLogo.value = false
}

function setHex(key: BrandColorKey, value: string) {
  if (!draft.value) return
  const v = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`
  if (/^#[0-9a-f]{6}$/i.test(v)) draft.value.colors[key] = v.toUpperCase()
}

function isThemeApplied(colors: BrandColors): boolean {
  const c = draft.value?.colors
  return !!c && (Object.keys(colors) as BrandColorKey[]).every((k) => c[k].toLowerCase() === colors[k].toLowerCase())
}

function close() {
  if (!confirmDiscard()) return
  customizeMode.value = false
  selectedEl.value = null
  draft.value = null
  emit('close')
}

async function loadFrames() {
  try {
    const data = await $fetch<{ frames: { id: string; name: string }[] }>('/api/frames')
    frames.value = data.frames
  } catch {
    frames.value = []
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      errorMessage.value = null
      draft.value = clone(active.value)
      loadFrames()
    } else {
      draft.value = null
      customizeMode.value = false
      selectedEl.value = null
    }
  },
  { immediate: true }
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.panel {
  border-radius: 1rem;
  padding: 1rem;
  background-color: rgb(var(--brand-surface) / 0.5);
  box-shadow: inset 0 0 0 1px rgb(var(--brand-secondary) / 0.2);
}
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  list-style: none;
  font-family: Poppins, Inter, sans-serif;
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
}
.panel-title::-webkit-details-marker {
  display: none;
}
.panel-title::after {
  content: '+';
  font-size: 1.125rem;
  line-height: 1;
  color: rgb(var(--brand-secondary));
}
details[open] > .panel-title::after {
  content: '−';
}
.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #a1a1aa;
}
.field {
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #fff;
  background-color: rgb(var(--brand-bg) / 0.7);
  outline: none;
  box-shadow: inset 0 0 0 1px rgb(var(--brand-secondary) / 0.25);
  transition: box-shadow 0.15s ease;
}
.field-narrow {
  width: 6.5rem;
  flex: none;
}
.field:focus {
  box-shadow: inset 0 0 0 2px rgb(var(--brand-secondary));
}
.chip-btn {
  border-radius: 9999px;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(var(--brand-secondary));
  box-shadow: inset 0 0 0 1px rgb(var(--brand-secondary) / 0.4);
  transition: background-color 0.15s ease;
}
.chip-btn:hover {
  background-color: rgb(var(--brand-secondary) / 0.1);
}
.chip-btn:disabled {
  opacity: 0.5;
}
.chip-btn.danger {
  color: #fca5a5;
  box-shadow: inset 0 0 0 1px rgb(var(--brand-accent) / 0.4);
}
.chip-btn.danger:hover {
  background-color: rgb(var(--brand-accent) / 0.1);
}
.customize-cta {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.875rem;
  padding: 0.75rem 0.9rem;
  color: rgb(var(--brand-bg));
  background: linear-gradient(120deg, rgb(var(--brand-primary)), rgb(var(--brand-secondary)));
  transition: filter 0.15s ease;
}
.customize-cta:hover {
  filter: brightness(1.08);
}
.tpl-card {
  display: block;
  min-width: 0;
  padding: 0.75rem;
  text-align: left;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.tpl-card:hover {
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.3);
}
.tpl-card.is-active {
  box-shadow: inset 0 0 0 2px var(--tpl-primary), 0 0 0 2px rgb(var(--brand-primary));
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
