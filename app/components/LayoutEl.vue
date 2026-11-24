<template>
  <div
    v-show="!s.hidden || customizeMode"
    class="el"
    :class="{
      'el-customizable': customizeMode,
      'el-selected': customizeMode && selectedEl === id,
      'el-hidden': s.hidden
    }"
    :data-align="s.align"
    :data-colored="s.color ? '' : undefined"
    :style="style"
    :title="customizeMode ? 'Clic para personalizar' : undefined"
    @click.capture="onSelect"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { textColorCss } from '../../types/branding'

/**
 * Envoltorio de un elemento de la página que se puede personalizar
 * (tamaño, color, alineación, ocultar). En modo "Personalizar" se elige con clic.
 */
const props = defineProps<{ id: string }>()

const { layout, customizeMode, selectedEl } = useBranding()
const s = computed(() => layout.value.elements[props.id] ?? {})

const style = computed(() => ({
  zoom: s.value.scale && s.value.scale !== 1 ? String(s.value.scale) : undefined,
  color: textColorCss(s.value.color),
  textAlign: s.value.align
}))

function onSelect() {
  if (customizeMode.value) selectedEl.value = props.id
}
</script>
