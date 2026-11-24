import defaultLogoUrl from '../../assets/img/logo.png'
import {
  defaultLayout,
  defaultProfile,
  effectiveTemplate,
  type BrandColors,
  type BrandProfile,
  type BrandTextKey,
  type BrandingState,
  type DesignTemplate
} from '../../types/branding'

/**
 * Diseño del evento activo. Mientras el panel "Diseño" está abierto, `brand`
 * muestra el borrador para que la página se vea en vivo antes de guardar.
 */
export function useBranding() {
  const state = useState<BrandingState | null>('branding', () => null)
  const draft = useState<BrandProfile | null>('branding-draft', () => null)

  const active = computed<BrandProfile>(() => {
    const s = state.value
    return s?.profiles.find((p) => p.id === s.active) ?? defaultProfile()
  })
  const brand = computed(() => draft.value ?? active.value)
  const texts = computed(() => brand.value.texts)
  const template = computed(() => effectiveTemplate(brand.value))
  const layout = computed(() => brand.value.layout ?? defaultLayout())
  /** Modo "Personalizar" del panel y elemento elegido con clic en la página. */
  const customizeMode = useState('branding-customize', () => false)
  const selectedEl = useState<string | null>('branding-selected', () => null)
  const logoUrl = computed(() => (brand.value.logo ? `/brand-logo/${brand.value.logo}` : defaultLogoUrl))

  async function load() {
    try {
      state.value = await $fetch<BrandingState>('/api/branding')
    } catch {
      state.value = { active: 'default', profiles: [defaultProfile()] }
    }
  }

  async function save(next: BrandingState) {
    state.value = await $fetch<BrandingState>('/api/branding', { method: 'PUT', body: next })
  }

  /** Sube un logo y devuelve su nombre de archivo (aún no queda guardado en el evento). */
  async function uploadLogo(file: File, kind: 'logo' | 'image' = 'logo'): Promise<string> {
    const form = new FormData()
    form.append('logo', file)
    form.append('kind', kind)
    const { logo } = await $fetch<{ logo: string }>('/api/branding/logo', { method: 'POST', body: form })
    return logo
  }

  /** Abre el selector de archivos y pone el logo elegido en el borrador. */
  function pickLogo() {
    if (!draft.value) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const logo = await uploadLogo(file)
        if (draft.value) draft.value.logo = logo
      } catch (e) {
        const err = e as { data?: { message?: string } }
        alert(err?.data?.message ?? 'No se pudo subir el logo.')
      }
    }
    input.click()
  }

  /** Con el panel "Diseño" abierto, los textos y el logo se editan con doble clic. */
  const editMode = computed(() => !!draft.value)

  return {
    state,
    draft,
    active,
    brand,
    texts,
    template,
    layout,
    customizeMode,
    selectedEl,
    logoUrl,
    editMode,
    load,
    save,
    uploadLogo,
    pickLogo
  }
}

export interface InlineEditTarget {
  key: BrandTextKey
  original: string
  originalColor: string | undefined
  rect: { top: number; left: number; width: number; height: number }
}

/** Texto que se está editando con doble clic (lo muestra InlineTextEditor.vue). */
export function useInlineEdit() {
  return useState<InlineEditTarget | null>('inline-edit', () => null)
}

function hexToChannels(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

export function googleFontsHref(families: string): string {
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

/**
 * Atributos de <html> que aplican la plantilla: variables de tipografía y
 * redondeo en `style`, y `data-*` que leen las reglas de assets/css/tailwind.css.
 */
export function templateHtmlAttrs(tpl: DesignTemplate, colors: BrandColors) {
  const vars = [
    brandCssVars(colors),
    `--font-display:${tpl.fontDisplay}`,
    `--font-body:${tpl.fontBody}`,
    `--radius:${tpl.radius}rem`,
    `--title-weight:${tpl.title.weight}`,
    `--title-style:${tpl.title.italic ? 'italic' : 'normal'}`,
    `--title-transform:${tpl.title.uppercase ? 'uppercase' : 'none'}`,
    `--title-tracking:${tpl.title.tracking}`
  ].join(';')
  return {
    style: vars,
    'data-tpl': tpl.id,
    'data-pattern': tpl.pattern,
    'data-align': tpl.align,
    'data-buttons': tpl.buttons,
    'data-blobs': tpl.blobs ? '1' : '0',
    'data-stripes': tpl.stripes ? '1' : '0',
    'data-sparkles': tpl.sparkles ? '1' : '0'
  }
}

/**
 * Variables CSS que usan las clases `brand-*` de Tailwind (ver nuxt.config.ts).
 * Van como estilo en línea de <html> para ganarle a los valores por defecto de tailwind.css.
 */
export function brandCssVars(colors: BrandColors): string {
  return `--brand-bg:${hexToChannels(colors.background)};--brand-surface:${hexToChannels(colors.surface)};--brand-primary:${hexToChannels(colors.primary)};--brand-secondary:${hexToChannels(colors.secondary)};--brand-accent:${hexToChannels(colors.accent)}`
}
