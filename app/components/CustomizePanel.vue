<template>
  <div v-if="draft" class="space-y-4">
    <button type="button" class="chip-btn" @click="customizeMode = false">← Volver a Diseño</button>

    <div class="rounded-2xl bg-brand-primary/10 px-4 py-3 text-xs text-zinc-300 ring-1 ring-brand-primary/30">
      <span class="font-bold text-brand-primary">Modo personalizar.</span>
      Haz clic en cualquier bloque de la página para elegirlo y ajustar su tamaño, color, alineación y posición.
      Doble clic en un texto para cambiar lo que dice.
    </div>

    <!-- Estilo general -->
    <details class="panel" open>
      <summary class="panel-title">Estilo general</summary>
      <div class="mt-3 space-y-3">
        <div>
          <label class="field-label" for="cz-font-display">Letra de los títulos</label>
          <select id="cz-font-display" class="field mt-1.5" :value="L.style.fontDisplay ?? ''" @change="setStyle('fontDisplay', selectValue($event))">
            <option value="">De la plantilla ({{ fontName(baseTpl, 'display') }})</option>
            <option v-for="f in displayFonts" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="cz-font-body">Letra de los textos</label>
          <select id="cz-font-body" class="field mt-1.5" :value="L.style.fontBody ?? ''" @change="setStyle('fontBody', selectValue($event))">
            <option value="">De la plantilla ({{ fontName(baseTpl, 'body') }})</option>
            <option v-for="f in bodyFonts" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
        <div>
          <div class="flex items-center justify-between">
            <label class="field-label" for="cz-radius">Redondeo de esquinas</label>
            <button v-if="L.style.radius !== undefined" type="button" class="reset-link" @click="setStyle('radius', undefined)">De la plantilla</button>
          </div>
          <input
            id="cz-radius"
            type="range"
            min="0"
            max="2.5"
            step="0.125"
            class="range mt-1.5"
            :value="L.style.radius ?? baseTpl.radius"
            @input="setStyle('radius', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label" for="cz-buttons">Botones</label>
            <select id="cz-buttons" class="field mt-1.5" :value="L.style.buttons ?? ''" @change="setStyle('buttons', selectValue($event))">
              <option value="">De la plantilla</option>
              <option v-for="b in BUTTON_STYLES" :key="b.value" :value="b.value">{{ b.label }}</option>
            </select>
          </div>
          <div>
            <label class="field-label" for="cz-pattern">Fondo</label>
            <select id="cz-pattern" class="field mt-1.5" :value="L.style.pattern ?? ''" @change="setStyle('pattern', selectValue($event))">
              <option value="">De la plantilla</option>
              <option v-for="p in PATTERN_STYLES" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="d in decorations"
            :key="d.key"
            type="button"
            class="toggle"
            :class="effective[d.key] ? 'is-on' : ''"
            @click="setStyle(d.key, !effective[d.key])"
          >
            {{ effective[d.key] ? '✓' : '✕' }} {{ d.label }}
          </button>
        </div>
      </div>
    </details>

    <!-- Logo -->
    <details class="panel" open>
      <summary class="panel-title">Logo</summary>
      <div class="mt-3 space-y-3">
        <div>
          <p class="field-label">Forma</p>
          <div class="mt-1.5 grid grid-cols-3 gap-1.5">
            <button
              v-for="opt in logoShapes"
              :key="opt.value"
              type="button"
              class="seg"
              :class="L.logoShape === opt.value ? 'is-on' : ''"
              @click="L.logoShape = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="field-label" for="cz-logo-size">Tamaño: {{ L.logoSize }} px</label>
          <input id="cz-logo-size" v-model.number="L.logoSize" type="range" min="24" max="160" step="2" class="range mt-1.5" />
        </div>
      </div>
    </details>

    <!-- Bloques -->
    <section v-for="group in groups" :key="group.title" class="panel">
      <p class="panel-title">{{ group.title }}</p>
      <ul class="mt-3 space-y-1.5">
        <li
          v-for="(item, index) in group.items"
          :id="`cz-${item.id}`"
          :key="item.id"
          class="rounded-xl ring-1 transition"
          :class="selectedEl === item.id ? 'bg-brand-bg/60 ring-brand-primary' : 'ring-white/5'"
        >
          <div class="flex items-center gap-2 px-2.5 py-2">
            <button
              type="button"
              class="icon-btn"
              :title="elStyle(item.id).hidden ? 'Mostrar' : 'Ocultar'"
              :aria-label="elStyle(item.id).hidden ? `Mostrar ${item.label}` : `Ocultar ${item.label}`"
              @click="patchEl(item.id, { hidden: !elStyle(item.id).hidden })"
            >
              <svg v-if="!elStyle(item.id).hidden" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            </button>
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left text-sm font-semibold"
              :class="elStyle(item.id).hidden ? 'text-zinc-500 line-through' : 'text-white'"
              @click="selectedEl = selectedEl === item.id ? null : item.id"
            >
              {{ item.label }}
            </button>
            <template v-if="group.reorder">
              <button type="button" class="icon-btn" :disabled="index === 0" aria-label="Subir" title="Subir" @click="moveHero(item.id, -1)">↑</button>
              <button type="button" class="icon-btn" :disabled="index === group.items.length - 1" aria-label="Bajar" title="Bajar" @click="moveHero(item.id, 1)">↓</button>
            </template>
          </div>

          <div v-if="selectedEl === item.id" class="space-y-3 border-t border-white/5 px-3 pb-3 pt-3">
            <!-- Contenido de bloques añadidos -->
            <template v-if="item.block?.type === 'text'">
              <div>
                <label class="field-label" :for="`cz-text-${item.id}`">Texto</label>
                <textarea :id="`cz-text-${item.id}`" v-model="item.block.text" rows="3" maxlength="400" class="field mt-1.5 resize-y" />
              </div>
            </template>
            <template v-if="item.block?.type === 'image'">
              <div class="flex items-center gap-3">
                <button type="button" class="chip-btn" :disabled="uploading" @click="pickBlockImage(item.block)">
                  {{ uploading ? 'Subiendo…' : item.block.image ? 'Cambiar imagen' : 'Subir imagen' }}
                </button>
              </div>
              <div>
                <label class="field-label" :for="`cz-w-${item.id}`">Ancho: {{ item.block.width }} px</label>
                <input :id="`cz-w-${item.id}`" v-model.number="item.block.width" type="range" min="40" max="900" step="10" class="range mt-1.5" />
              </div>
            </template>

            <div v-if="item.scale">
              <div class="flex items-center justify-between">
                <label class="field-label" :for="`cz-scale-${item.id}`">Tamaño: {{ Math.round((elStyle(item.id).scale ?? 1) * 100) }} %</label>
                <button v-if="elStyle(item.id).scale" type="button" class="reset-link" @click="patchEl(item.id, { scale: undefined })">Normal</button>
              </div>
              <input
                :id="`cz-scale-${item.id}`"
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                class="range mt-1.5"
                :value="elStyle(item.id).scale ?? 1"
                @input="patchEl(item.id, { scale: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>

            <div v-if="item.color">
              <p class="field-label mb-1.5">Color</p>
              <ColorSwatches :model-value="elStyle(item.id).color" @update:model-value="(v) => patchEl(item.id, { color: v })" />
            </div>

            <div v-if="item.align">
              <p class="field-label">Alineación</p>
              <div class="mt-1.5 grid grid-cols-4 gap-1.5">
                <button
                  v-for="a in aligns"
                  :key="a.label"
                  type="button"
                  class="seg"
                  :class="elStyle(item.id).align === a.value ? 'is-on' : ''"
                  @click="patchEl(item.id, { align: a.value })"
                >
                  {{ a.label }}
                </button>
              </div>
            </div>

            <button
              v-if="item.block"
              type="button"
              class="chip-btn danger"
              @click="removeBlock(item.id)"
            >
              Eliminar este bloque
            </button>
          </div>
        </li>
      </ul>

      <div v-if="group.reorder" class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="chip-btn" @click="addBlock('text')">+ Añadir texto</button>
        <button type="button" class="chip-btn" @click="addBlock('image')">+ Añadir imagen</button>
      </div>
    </section>

    <button type="button" class="chip-btn danger" @click="resetLayout">Restablecer toda la personalización</button>
  </div>
</template>

<script setup lang="ts">
import {
  BUTTON_STYLES,
  DESIGN_TEMPLATES,
  LAYOUT_ELEMENTS,
  PATTERN_STYLES,
  defaultLayout,
  effectiveTemplate,
  fontName,
  getTemplate,
  type Align,
  type CustomBlock,
  type ElementStyle,
  type LayoutConfig,
  type LogoShape,
  type StyleOverrides
} from '../../types/branding'

const { draft, customizeMode, selectedEl, uploadLogo } = useBranding()

const L = computed<LayoutConfig>(() => draft.value!.layout)
const baseTpl = computed(() => getTemplate(draft.value!.template))
const effective = computed(() => effectiveTemplate(draft.value!))
const uploading = ref(false)

const uniqueFonts = (which: 'display' | 'body') => {
  const seen = new Set<string>()
  return DESIGN_TEMPLATES.flatMap((t) => {
    const label = fontName(t, which)
    if (seen.has(label)) return []
    seen.add(label)
    return [{ value: t.id, label }]
  })
}
const displayFonts = uniqueFonts('display')
const bodyFonts = uniqueFonts('body')

const decorations = [
  { key: 'blobs', label: 'Manchas de color' },
  { key: 'stripes', label: 'Franjas' },
  { key: 'sparkles', label: 'Destellos' }
] as const

const logoShapes: { value: LogoShape; label: string }[] = [
  { value: 'none', label: 'Original' },
  { value: 'circle', label: 'Círculo' },
  { value: 'rounded', label: 'Redondeado' }
]

const aligns: { value: Align | undefined; label: string }[] = [
  { value: undefined, label: 'Auto' },
  { value: 'left', label: 'Izq.' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Der.' }
]

interface Item {
  id: string
  label: string
  align: boolean
  scale: boolean
  color: boolean
  block?: CustomBlock
}

const builtIn = (id: string): Item => {
  const meta = LAYOUT_ELEMENTS.find((e) => e.id === id)!
  return { id, label: meta.label, align: meta.align, scale: meta.scale, color: meta.color }
}

const groups = computed(() => {
  const hero: Item[] = L.value.heroOrder.map((id) => {
    const block = L.value.custom.find((b) => b.id === id)
    if (!block) return builtIn(id)
    const label = block.type === 'text' ? `Texto: ${block.text.slice(0, 24) || '(vacío)'}` : 'Imagen añadida'
    return { id, label, align: true, scale: true, color: block.type === 'text', block }
  })
  return [
    { title: 'Encabezado', reorder: false, items: ['logo', 'appName', 'organization'].map(builtIn) },
    { title: 'Portada', reorder: true, items: hero },
    { title: 'Toma de la foto', reorder: false, items: [builtIn('stepHeading')] },
    { title: 'Pie de página', reorder: false, items: [builtIn('footer')] }
  ]
})

function selectValue(e: Event): string | undefined {
  return (e.target as HTMLSelectElement).value || undefined
}

function setStyle<K extends keyof StyleOverrides>(key: K, value: StyleOverrides[K] | undefined) {
  const next = { ...L.value.style }
  if (value === undefined) delete next[key]
  else next[key] = value
  L.value.style = next
}

function elStyle(id: string): ElementStyle {
  return L.value.elements[id] ?? {}
}

function patchEl(id: string, patch: Partial<ElementStyle>) {
  const next: ElementStyle = { ...elStyle(id), ...patch }
  if (!next.hidden) delete next.hidden
  if (!next.scale || next.scale === 1) delete next.scale
  if (!next.color) delete next.color
  if (!next.align) delete next.align
  const elements = { ...L.value.elements }
  if (Object.keys(next).length) elements[id] = next
  else delete elements[id]
  L.value.elements = elements
}

function moveHero(id: string, dir: -1 | 1) {
  const order = [...L.value.heroOrder]
  const i = order.indexOf(id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= order.length) return
  ;[order[i], order[j]] = [order[j]!, order[i]!]
  L.value.heroOrder = order
}

function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return 'c' + [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 10)
}

function addBlock(type: 'text' | 'image') {
  const block: CustomBlock = { id: newId(), type, text: type === 'text' ? 'Nuevo texto' : '', image: null, width: 240 }
  L.value.custom = [...L.value.custom, block]
  L.value.heroOrder = [...L.value.heroOrder, block.id]
  selectedEl.value = block.id
  if (type === 'image') pickBlockImage(L.value.custom.at(-1)!)
}

function removeBlock(id: string) {
  if (!confirm('¿Eliminar este bloque?')) return
  L.value.custom = L.value.custom.filter((b) => b.id !== id)
  L.value.heroOrder = L.value.heroOrder.filter((x) => x !== id)
  const elements = { ...L.value.elements }
  delete elements[id]
  L.value.elements = elements
  selectedEl.value = null
}

function pickBlockImage(block: CustomBlock) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    uploading.value = true
    try {
      block.image = await uploadLogo(file, 'image')
    } catch (e) {
      const err = e as { data?: { message?: string } }
      alert(err?.data?.message ?? 'No se pudo subir la imagen.')
    } finally {
      uploading.value = false
    }
  }
  input.click()
}

function resetLayout() {
  if (!confirm('¿Quitar toda la personalización (tamaños, colores, orden, bloques añadidos) y volver a la plantilla?')) return
  draft.value!.layout = defaultLayout()
  selectedEl.value = null
}

// Al elegir un bloque en la página, la lista lo muestra.
watch(selectedEl, async (id) => {
  if (!id) return
  await nextTick()
  document.getElementById(`cz-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})
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
  font-family: var(--font-display);
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
}
.panel-title::-webkit-details-marker {
  display: none;
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
}
.field:focus {
  box-shadow: inset 0 0 0 2px rgb(var(--brand-secondary));
}
.range {
  width: 100%;
  accent-color: rgb(var(--brand-primary));
}
.chip-btn {
  border-radius: 9999px;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(var(--brand-secondary));
  box-shadow: inset 0 0 0 1px rgb(var(--brand-secondary) / 0.4);
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
.icon-btn {
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  color: #a1a1aa;
}
.icon-btn:hover:not(:disabled) {
  background-color: rgb(255 255 255 / 0.06);
  color: #fff;
}
.icon-btn:disabled {
  opacity: 0.3;
}
.seg,
.toggle {
  border-radius: 0.5rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #d4d4d8;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
}
.toggle {
  padding: 0.4rem 0.7rem;
  border-radius: 9999px;
}
.seg.is-on,
.toggle.is-on {
  color: rgb(var(--brand-bg));
  background-color: rgb(var(--brand-secondary));
  box-shadow: none;
}
.reset-link {
  font-size: 0.7rem;
  color: #a1a1aa;
  text-decoration: underline;
}
.reset-link:hover {
  color: #fff;
}
</style>
