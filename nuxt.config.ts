export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],

  vite: {
    server: {
      allowedHosts: ['.ngrok-free.app']
    }
  },

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
            // Colores editables desde el panel "Diseño" (variables en useBranding.ts).
            brand: {
              bg: 'rgb(var(--brand-bg) / <alpha-value>)',
              surface: 'rgb(var(--brand-surface) / <alpha-value>)',
              primary: 'rgb(var(--brand-primary) / <alpha-value>)',
              secondary: 'rgb(var(--brand-secondary) / <alpha-value>)',
              accent: 'rgb(var(--brand-accent) / <alpha-value>)'
            }
          },
          // Tipografía y redondeo cambian con la plantilla de diseño del evento.
          fontFamily: {
            display: ['var(--font-display)'],
            sans: ['var(--font-body)']
          },
          borderRadius: {
            lg: 'calc(var(--radius) * 0.5)',
            xl: 'calc(var(--radius) * 0.75)',
            '2xl': 'var(--radius)',
            '3xl': 'calc(var(--radius) * 1.5)'
          }
        }
      }
    }
  }
})
