<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-navy/90 backdrop-blur-sm"
    >
      <div class="relative flex flex-col items-center gap-6">
        <div class="relative w-16 h-16">
          <div class="absolute inset-0 rounded-full border-4 border-brand-cyan/20 border-t-brand-cyan animate-spin" />
          <div class="absolute inset-2 rounded-full border-4 border-brand-yellow/20 border-b-brand-yellow animate-spin-reverse" />
          <svg class="absolute inset-0 m-auto w-6 h-6 text-brand-yellow sparkle" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" />
          </svg>
        </div>
        <div class="text-center">
          <p class="font-display text-lg font-bold text-white">Procesando tu foto...</p>
          <p class="mt-1 text-sm text-brand-cyan">Eliminando el fondo y componiendo tu resultado</p>
        </div>
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

@keyframes spin-reverse {
  to {
    transform: rotate(-360deg);
  }
}

.animate-spin-reverse {
  animation: spin-reverse 1.1s linear infinite;
}

@keyframes sparkle-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.7;
  }
}

.sparkle {
  animation: sparkle-pulse 1.1s ease-in-out infinite;
}
</style>
