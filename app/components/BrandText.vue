<template>
  <span
    :class="editMode ? 'brand-editable' : ''"
    :style="color ? { color } : undefined"
    :title="editMode ? 'Doble clic para editar' : undefined"
    @click="onClick"
    @dblclick="onDoubleClick"
  >{{ value || (editMode ? '(vacío)' : '') }}</span>
</template>

<script setup lang="ts">
import { textColorCss, type BrandTextKey } from '../../types/branding'

/** Texto de la marca. Con el panel "Diseño" abierto se edita con doble clic. */
const props = defineProps<{ k: BrandTextKey }>()

const { texts, brand, editMode } = useBranding()
const inlineEdit = useInlineEdit()
const value = computed(() => texts.value[props.k])
const color = computed(() => textColorCss(brand.value.textColors?.[props.k]))

// En modo edición, el clic sobre el texto no debe activar el botón que lo contiene.
function onClick(e: MouseEvent) {
  if (!editMode.value) return
  e.preventDefault()
  e.stopPropagation()
}

function onDoubleClick(e: MouseEvent) {
  if (!editMode.value) return
  e.preventDefault()
  e.stopPropagation()
  window.getSelection()?.removeAllRanges()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  inlineEdit.value = {
    key: props.k,
    original: value.value,
    originalColor: brand.value.textColors?.[props.k],
    rect: { top: r.top, left: r.left, width: r.width, height: r.height }
  }
}
</script>
