<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div class="relative flex flex-col items-center gap-6">
        <div class="w-12 h-12 rounded-full border-2 border-transparent border-t-blue-400 border-r-blue-400 animate-spin" />
        <p class="text-lg font-medium text-zinc-200">Procesando imagen...</p>
        <p class="text-sm text-zinc-500">Eliminando fondo y componiendo resultado</p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
