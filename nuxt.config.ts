export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],

  nitro: {
    experimental: {
      asyncContext: true
    }
  },

  tailwindcss: {
    config: {
      content: [
        './app/**/*.{vue,ts,tsx}'
      ],
      theme: {
        extend: {}
      }
    }
  }
})
