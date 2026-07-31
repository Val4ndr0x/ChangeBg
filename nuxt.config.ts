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
        extend: {
          colors: {
            brand: {
              navy: '#051F43',
              'navy-light': '#0B2A5C',
              'navy-soft': '#102F5E',
              yellow: '#FFF200',
              cyan: '#00AEEF',
              red: '#ED2024'
            }
          },
          fontFamily: {
            display: ['Poppins', 'Inter', 'sans-serif'],
            sans: ['Inter', 'system-ui', 'sans-serif']
          }
        }
      }
    }
  }
})
