<template>
  <Teleport to="body">
    <div v-if="target && draft" class="fixed inset-0 z-[60]" @mousedown.self="close">
      <div
        class="absolute rounded-2xl bg-brand-surface p-3 shadow-2xl ring-1 ring-brand-secondary/40"
        :style="boxStyle"
        role="dialog"
        aria-label="Editar texto"
      >
        <p class="mb-1.5 text-[11px] font-semibold text-zinc-400">{{ label }}</p>
        <textarea
          v-if="multiline"
          ref="field"
          v-model="draft.texts[target.key]"
          rows="3"
          maxlength="400"
          class="inline-field resize-y"
          @keydown="onKeydown"
        />
        <input
          v-else
          ref="field"
          v-model="draft.texts[target.key]"
          maxlength="400"
          class="inline-field"
          @keydown="onKeydown"
        />
        <div class="mt-3">
          <p class="mb-1.5 text-[11px] font-semibold text-zinc-400">Color del texto</p>
          <ColorSwatches :model-value="currentColor" @update:model-value="setColor" />
        </div>
        <div class="mt-3 flex items-center justify-end gap-2">
          <span class="mr-auto text-[10px] text-zinc-500">{{ multiline ? 'Ctrl+Enter' : 'Enter' }} para aceptar · Esc para cancelar</span>
          <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white" @click="cancel">
            Cancelar
          </button>
          <button type="button" class="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-brand-bg" @click="close">
            Listo
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { TEXT_SECTIONS } from '../../types/branding'

const { draft } = useBranding()
const target = useInlineEdit()
const field = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)

const fieldInfo = computed(() =>
  TEXT_SECTIONS.flatMap((s) => s.fields).find((f) => f.key === target.value?.key)
)
const label = computed(() => fieldInfo.value?.label ?? 'Texto')
const multiline = computed(() => !!fieldInfo.value?.multiline)

const BOX_MIN = 300
const MARGIN = 16

// Se coloca justo debajo del texto (o encima si no cabe), dentro de la pantalla.
const boxStyle = computed(() => {
  const r = target.value?.rect
  if (!r) return {}
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(Math.max(r.width, BOX_MIN), vw - MARGIN * 2)
  const left = Math.min(Math.max(r.left, MARGIN), vw - width - MARGIN)
  const estimatedHeight = multiline.value ? 230 : 180
  const below = r.top + r.height + 8
  const top = below + estimatedHeight > vh ? Math.max(MARGIN, r.top - estimatedHeight - 8) : below
  return { top: `${top}px`, left: `${left}px`, width: `${width}px` }
})

const currentColor = computed(() => (target.value ? draft.value?.textColors?.[target.value.key] : undefined))

function setColor(value: string | undefined) {
  if (!target.value || !draft.value) return
  const colors = { ...(draft.value.textColors ?? {}) }
  if (value) colors[target.value.key] = value
  else delete colors[target.value.key]
  draft.value.textColors = colors
}

function close() {
  target.value = null
}

function cancel() {
  if (target.value && draft.value) {
    draft.value.texts[target.value.key] = target.value.original
    setColor(target.value.originalColor)
  }
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    cancel()
  } else if (e.key === 'Enter' && (!multiline.value || e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    close()
  }
}

watch(target, async (t) => {
  if (!t) return
  await nextTick()
  field.value?.focus()
  field.value?.select()
})

// Si se cierra el panel "Diseño", se cierra también esta caja.
watch(draft, (d) => {
  if (!d) close()
})
</script>

<style scoped>
.inline-field {
  width: 100%;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  color: #fff;
  background-color: rgb(var(--brand-bg) / 0.8);
  outline: none;
  box-shadow: inset 0 0 0 2px rgb(var(--brand-secondary));
}
</style>
