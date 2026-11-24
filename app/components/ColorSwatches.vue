<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <button
      type="button"
      class="swatch-auto"
      :class="!modelValue ? 'is-active' : ''"
      title="Automático (el color original del diseño)"
      @click="emit('update:modelValue', undefined)"
    >
      Auto
    </button>
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="swatch"
      :class="modelValue === opt.value ? 'is-active' : ''"
      :style="{ backgroundColor: textColorCss(opt.value) }"
      :title="opt.label"
      :aria-label="opt.label"
      @click="emit('update:modelValue', opt.value)"
    />
    <label class="swatch swatch-custom" :class="isCustom ? 'is-active' : ''" title="Otro color">
      <input
        type="color"
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        :value="isCustom ? modelValue : '#FFFFFF'"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value.toUpperCase())"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { textColorCss } from '../../types/branding'

/** Selector de color: Auto, colores del tema (siguen al tema), fijos y libre. */
const props = defineProps<{ modelValue: string | undefined }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const options = [
  { value: 'primary', label: 'Color principal del tema' },
  { value: 'secondary', label: 'Color secundario del tema' },
  { value: 'accent', label: 'Color de acento del tema' },
  { value: '#FFFFFF', label: 'Blanco' },
  { value: '#A1A1AA', label: 'Gris' },
  { value: '#000000', label: 'Negro' }
]

const isCustom = computed(() => !!props.modelValue && !options.some((o) => o.value === props.modelValue))
</script>

<style scoped>
.swatch,
.swatch-auto {
  position: relative;
  height: 1.75rem;
  border-radius: 9999px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.25);
  transition: box-shadow 0.15s ease;
}
.swatch {
  width: 1.75rem;
}
.swatch-auto {
  padding: 0 0.6rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #d4d4d8;
}
.swatch-custom {
  cursor: pointer;
  background: conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
}
.swatch.is-active,
.swatch-auto.is-active {
  box-shadow: 0 0 0 2px rgb(var(--brand-surface)), 0 0 0 4px rgb(var(--brand-secondary));
}
</style>
