/**
 * Todo lo que cambia de un evento a otro: textos, colores, logo y marco.
 * Lo comparten el cliente (panel "Diseño") y el servidor (validación).
 */

export const DEFAULT_TEXTS = {
  appName: 'Photo Liga',
  appNameHighlight: 'LPC',
  organization: 'Liga de Porrismo de Cundinamarca',

  badge: 'Temporada LPC · Cundinamarca',
  heroTitleStart: 'Vive el momento.',
  heroTitleHighlight: 'Llévate',
  heroTitleEnd: 'el recuerdo.',
  heroSubtitle: 'Tómate una foto en el stand y llévate un recuerdo con el sello oficial de la Liga de Porrismo de Cundinamarca.',
  chip1: 'Recuerdo de calidad',
  chip2: 'Listo en segundos',
  chip3: 'Descárgala y compártela',

  stepKicker: 'Tu turno',
  stepTitle: 'Sonríe, es hora de tu foto',
  uploaderTitle: 'Captura tu momento',
  uploaderSubtitle: 'Tómate la foto aquí mismo y llévate un recuerdo profesional',
  cameraButton: 'Tomar mi foto',
  uploadHint: 'o haz clic aquí para subir una foto ya tomada',
  shutterButton: 'Tomar foto',
  styleLabel: 'Elige el estilo de tu recuerdo',
  styleOption: '! Momento inolvidable ¡',
  processButton: '¡Quiero mi recuerdo!',

  processingTitle: 'Preparando tu recuerdo...',
  processingSubtitle: 'Ya casi está listo, un momento más',

  resultBadge: '¡Tu recuerdo está listo!',
  downloadButton: 'Descargar',
  printButton: 'Imprimir',
  retakeButton: 'Tomar otra foto',
  downloadFilename: 'recuerdo-lpc',

  footerLine: 'Photo Liga LPC · Liga de Porrismo de Cundinamarca',
  footerSubline: 'Tu recuerdo oficial de la temporada LPC'
}

export type BrandTexts = typeof DEFAULT_TEXTS
export type BrandTextKey = keyof BrandTexts

export const DEFAULT_COLORS = {
  background: '#051F43',
  surface: '#0B2A5C',
  primary: '#FFF200',
  secondary: '#00AEEF',
  accent: '#ED2024'
}

export type BrandColors = typeof DEFAULT_COLORS
export type BrandColorKey = keyof BrandColors

export interface BrandProfile {
  id: string
  /** Plantilla de diseño (tipografía, formas, fondo decorativo). Ver DESIGN_TEMPLATES. */
  template: string
  /** Nombre interno del evento (solo se ve en el panel). */
  name: string
  /** Archivo del logo subido, o null para usar el logo original. */
  logo: string | null
  /** Marco que se activa al elegir este evento, o null para no tocarlo. */
  frameId: string | null
  /** Segundos de cuenta regresiva antes de tomar la foto. */
  countdown: number
  colors: BrandColors
  texts: BrandTexts
  /** Color propio de algunos textos: hex (#RRGGBB) o un color del tema (TEXT_COLOR_TOKENS). */
  textColors: Partial<Record<BrandTextKey, string>>
  /** Ajustes del modo "Personalizar": tamaños, colores, orden, elementos extra. */
  layout: LayoutConfig
}

export interface BrandingState {
  active: string
  profiles: BrandProfile[]
}

export const DEFAULT_PROFILE_ID = 'default'
export const DEFAULT_TEMPLATE_ID = 'energia'

export function defaultProfile(): BrandProfile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: 'Liga de Porrismo (original)',
    template: DEFAULT_TEMPLATE_ID,
    logo: null,
    frameId: null,
    countdown: 5,
    colors: { ...DEFAULT_COLORS },
    texts: { ...DEFAULT_TEXTS },
    textColors: {},
    layout: defaultLayout()
  }
}

/** Colores de texto que siguen al tema: si cambia el tema, el texto cambia con él. */
export const TEXT_COLOR_TOKENS = ['primary', 'secondary', 'accent'] as const
const TOKEN_VARS: Record<string, string> = { primary: '--brand-primary', secondary: '--brand-secondary', accent: '--brand-accent' }

export function isValidTextColor(value: unknown): value is string {
  return typeof value === 'string' && (/^#[0-9a-f]{6}$/i.test(value) || value in TOKEN_VARS)
}

/** Valor CSS de un color de texto guardado. */
export function textColorCss(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value in TOKEN_VARS ? `rgb(var(${TOKEN_VARS[value]}))` : value
}

/** Etiquetas y agrupación de los campos para el panel de edición. */
export const TEXT_SECTIONS: { title: string; fields: { key: BrandTextKey; label: string; multiline?: boolean }[] }[] = [
  {
    title: 'Nombre y organización',
    fields: [
      { key: 'appName', label: 'Nombre de la app' },
      { key: 'appNameHighlight', label: 'Parte resaltada del nombre' },
      { key: 'organization', label: 'Organización / evento' }
    ]
  },
  {
    title: 'Portada',
    fields: [
      { key: 'badge', label: 'Etiqueta superior' },
      { key: 'heroTitleStart', label: 'Título (inicio)' },
      { key: 'heroTitleHighlight', label: 'Título (palabra resaltada)' },
      { key: 'heroTitleEnd', label: 'Título (final)' },
      { key: 'heroSubtitle', label: 'Descripción', multiline: true },
      { key: 'chip1', label: 'Insignia 1' },
      { key: 'chip2', label: 'Insignia 2' },
      { key: 'chip3', label: 'Insignia 3' }
    ]
  },
  {
    title: 'Toma de la foto',
    fields: [
      { key: 'stepKicker', label: 'Encabezado pequeño' },
      { key: 'stepTitle', label: 'Encabezado' },
      { key: 'uploaderTitle', label: 'Título del recuadro' },
      { key: 'uploaderSubtitle', label: 'Texto del recuadro', multiline: true },
      { key: 'cameraButton', label: 'Botón abrir cámara' },
      { key: 'uploadHint', label: 'Ayuda para subir foto' },
      { key: 'shutterButton', label: 'Botón disparar' },
      { key: 'styleLabel', label: 'Texto sobre el estilo' },
      { key: 'styleOption', label: 'Nombre del estilo' },
      { key: 'processButton', label: 'Botón crear recuerdo' }
    ]
  },
  {
    title: 'Espera y resultado',
    fields: [
      { key: 'processingTitle', label: 'Título mientras se procesa' },
      { key: 'processingSubtitle', label: 'Texto mientras se procesa' },
      { key: 'resultBadge', label: 'Mensaje de foto lista' },
      { key: 'downloadButton', label: 'Botón descargar' },
      { key: 'printButton', label: 'Botón imprimir' },
      { key: 'retakeButton', label: 'Botón otra foto' },
      { key: 'downloadFilename', label: 'Nombre del archivo descargado' }
    ]
  },
  {
    title: 'Pie de página',
    fields: [
      { key: 'footerLine', label: 'Línea principal' },
      { key: 'footerSubline', label: 'Línea secundaria' }
    ]
  }
]

export const COLOR_FIELDS: { key: BrandColorKey; label: string; hint: string }[] = [
  { key: 'background', label: 'Fondo', hint: 'Usa un tono oscuro: los textos son claros.' },
  { key: 'surface', label: 'Tarjetas y paneles', hint: 'Un poco más claro que el fondo.' },
  { key: 'primary', label: 'Principal', hint: 'Botones principales y palabras resaltadas.' },
  { key: 'secondary', label: 'Secundario', hint: 'Bordes, etiquetas y botones secundarios.' },
  { key: 'accent', label: 'Acento', hint: 'Detalles y mensajes de error.' }
]

/**
 * Temas de ejemplo. Al elegir uno se copian sus colores al evento y luego se
 * pueden ajustar uno por uno. Todos usan fondo oscuro porque los textos son claros.
 */
export const THEME_PRESETS: { name: string; colors: BrandColors }[] = [
  { name: 'Liga LPC', colors: { ...DEFAULT_COLORS } },
  { name: 'Boda elegante', colors: { background: '#1C1A1F', surface: '#2B2730', primary: '#D4AF37', secondary: '#E8C9C1', accent: '#B76E79' } },
  { name: 'XV años', colors: { background: '#2A0F3D', surface: '#3E1A57', primary: '#FF8AD8', secondary: '#C9A7FF', accent: '#FFD166' } },
  { name: 'Graduación', colors: { background: '#0B1A2E', surface: '#16304F', primary: '#F2C14E', secondary: '#7FB3E6', accent: '#E4572E' } },
  { name: 'Corporativo', colors: { background: '#111827', surface: '#1F2937', primary: '#38BDF8', secondary: '#94A3B8', accent: '#22C55E' } },
  { name: 'Navidad', colors: { background: '#0E2A1F', surface: '#17402F', primary: '#F4D35E', secondary: '#9ED8B5', accent: '#D7263D' } },
  { name: 'Halloween', colors: { background: '#160F1E', surface: '#271A33', primary: '#FF7A00', secondary: '#9B5DE5', accent: '#7CFC00' } },
  { name: 'Fiesta neón', colors: { background: '#0A0A14', surface: '#18182B', primary: '#39FF14', secondary: '#00E5FF', accent: '#FF2E9A' } },
  { name: 'Baby shower', colors: { background: '#1D2B3A', surface: '#2A3D52', primary: '#FFD6E0', secondary: '#A8DADC', accent: '#FFB4A2' } },
  { name: 'Tropical', colors: { background: '#062925', surface: '#0D3D37', primary: '#FFC857', secondary: '#2EC4B6', accent: '#FF6B6B' } }
]

/**
 * Plantillas de diseño: cambian la tipografía, la forma de tarjetas y botones,
 * el fondo decorativo y el estilo del título. Cada una trae una paleta
 * sugerida que luego se puede ajustar en "Tema y colores".
 */
export interface DesignTemplate {
  id: string
  name: string
  description: string
  /** Parámetro `family=...` de Google Fonts (sin `display`). */
  googleFonts: string
  fontDisplay: string
  fontBody: string
  /** Redondeo base de tarjetas y botones, en rem (0 = esquinas rectas). */
  radius: number
  title: { weight: number; italic: boolean; uppercase: boolean; tracking: string }
  align: 'center' | 'left'
  /** Patrón de fondo de toda la página. */
  pattern: 'none' | 'dots' | 'grid' | 'diagonal' | 'rays' | 'confetti'
  blobs: boolean
  stripes: boolean
  sparkles: boolean
  buttons: 'glow' | 'flat' | 'neon' | 'brutal' | 'outline'
  colors: BrandColors
}

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'energia',
    name: 'Energía deportiva',
    description: 'El diseño original: dinámico, cursivo y con franjas.',
    googleFonts: 'family=Poppins:ital,wght@0,600;0,800;1,800&family=Inter:wght@400;600;700',
    fontDisplay: "'Poppins', sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 1,
    title: { weight: 800, italic: true, uppercase: false, tracking: '-0.025em' },
    align: 'center',
    pattern: 'none',
    blobs: true,
    stripes: true,
    sparkles: true,
    buttons: 'glow',
    colors: { ...DEFAULT_COLORS }
  },
  {
    id: 'elegante',
    name: 'Elegante',
    description: 'Serif clásica, esquinas finas. Bodas y galas.',
    googleFonts: 'family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Lato:wght@400;700',
    fontDisplay: "'Playfair Display', Georgia, serif",
    fontBody: "'Lato', system-ui, sans-serif",
    radius: 0.25,
    title: { weight: 600, italic: false, uppercase: false, tracking: '0' },
    align: 'center',
    pattern: 'rays',
    blobs: false,
    stripes: false,
    sparkles: true,
    buttons: 'outline',
    colors: { background: '#1C1A1F', surface: '#2B2730', primary: '#D4AF37', secondary: '#E8C9C1', accent: '#B76E79' }
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Limpio, sin adornos, alineado a la izquierda.',
    googleFonts: 'family=Inter:wght@400;600;700;800',
    fontDisplay: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    radius: 0.5,
    title: { weight: 700, italic: false, uppercase: false, tracking: '-0.04em' },
    align: 'left',
    pattern: 'none',
    blobs: false,
    stripes: false,
    sparkles: false,
    buttons: 'flat',
    colors: { background: '#111111', surface: '#1C1C1C', primary: '#FFFFFF', secondary: '#A3A3A3', accent: '#EF4444' }
  },
  {
    id: 'neon',
    name: 'Neón',
    description: 'Fiesta nocturna: cuadrícula y botones que brillan.',
    googleFonts: 'family=Orbitron:wght@600;800&family=Exo+2:wght@400;600;700',
    fontDisplay: "'Orbitron', sans-serif",
    fontBody: "'Exo 2', system-ui, sans-serif",
    radius: 0.75,
    title: { weight: 800, italic: false, uppercase: true, tracking: '0.04em' },
    align: 'center',
    pattern: 'grid',
    blobs: true,
    stripes: false,
    sparkles: true,
    buttons: 'neon',
    colors: { background: '#0A0A14', surface: '#18182B', primary: '#39FF14', secondary: '#00E5FF', accent: '#FF2E9A' }
  },
  {
    id: 'retro',
    name: 'Retro 80s',
    description: 'Rayos de sol, letras gruesas y franjas.',
    googleFonts: 'family=Bungee&family=Space+Grotesk:wght@400;600;700',
    fontDisplay: "'Bungee', sans-serif",
    fontBody: "'Space Grotesk', system-ui, sans-serif",
    radius: 0.5,
    title: { weight: 400, italic: false, uppercase: true, tracking: '0.02em' },
    align: 'center',
    pattern: 'rays',
    blobs: false,
    stripes: true,
    sparkles: true,
    buttons: 'brutal',
    colors: { background: '#2B1055', surface: '#3D1A6E', primary: '#FFD319', secondary: '#FF2975', accent: '#00F0FF' }
  },
  {
    id: 'infantil',
    name: 'Fiesta infantil',
    description: 'Muy redondeado y con confeti. Cumpleaños.',
    googleFonts: 'family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700',
    fontDisplay: "'Fredoka', sans-serif",
    fontBody: "'Nunito', system-ui, sans-serif",
    radius: 1.75,
    title: { weight: 700, italic: false, uppercase: false, tracking: '0' },
    align: 'center',
    pattern: 'confetti',
    blobs: true,
    stripes: false,
    sparkles: true,
    buttons: 'glow',
    colors: { background: '#1E1B4B', surface: '#2E2A6B', primary: '#FFB703', secondary: '#8ECAE6', accent: '#FB5607' }
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Estilo revista: serif grande y esquinas rectas.',
    googleFonts: 'family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;600;700',
    fontDisplay: "'DM Serif Display', Georgia, serif",
    fontBody: "'DM Sans', system-ui, sans-serif",
    radius: 0,
    title: { weight: 400, italic: false, uppercase: false, tracking: '-0.01em' },
    align: 'left',
    pattern: 'none',
    blobs: false,
    stripes: false,
    sparkles: false,
    buttons: 'flat',
    colors: { background: '#14110F', surface: '#221E1B', primary: '#F2E8CF', secondary: '#DDA15E', accent: '#BC6C25' }
  },
  {
    id: 'urbano',
    name: 'Urbano',
    description: 'Brutalista: mayúsculas, bordes duros y sombras sólidas.',
    googleFonts: 'family=Archivo+Black&family=Archivo:wght@400;600;700',
    fontDisplay: "'Archivo Black', sans-serif",
    fontBody: "'Archivo', system-ui, sans-serif",
    radius: 0,
    title: { weight: 400, italic: false, uppercase: true, tracking: '-0.01em' },
    align: 'left',
    pattern: 'diagonal',
    blobs: false,
    stripes: true,
    sparkles: false,
    buttons: 'brutal',
    colors: { background: '#0D0D0D', surface: '#1A1A1A', primary: '#E9FF70', secondary: '#70D6FF', accent: '#FF70A6' }
  },
  {
    id: 'tropical',
    name: 'Tropical',
    description: 'Letra manuscrita y formas suaves. Fiestas al aire libre.',
    googleFonts: 'family=Pacifico&family=Quicksand:wght@400;600;700',
    fontDisplay: "'Pacifico', cursive",
    fontBody: "'Quicksand', system-ui, sans-serif",
    radius: 1.25,
    title: { weight: 400, italic: false, uppercase: false, tracking: '0' },
    align: 'center',
    pattern: 'dots',
    blobs: true,
    stripes: false,
    sparkles: true,
    buttons: 'glow',
    colors: { background: '#062925', surface: '#0D3D37', primary: '#FFC857', secondary: '#2EC4B6', accent: '#FF6B6B' }
  },
  {
    id: 'tech',
    name: 'Tecnología',
    description: 'Corporativo moderno con cuadrícula. Congresos y marcas.',
    googleFonts: 'family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;600;700',
    fontDisplay: "'Space Grotesk', sans-serif",
    fontBody: "'IBM Plex Sans', system-ui, sans-serif",
    radius: 0.375,
    title: { weight: 700, italic: false, uppercase: false, tracking: '-0.03em' },
    align: 'left',
    pattern: 'grid',
    blobs: false,
    stripes: false,
    sparkles: false,
    buttons: 'flat',
    colors: { background: '#0B1220', surface: '#162033', primary: '#38BDF8', secondary: '#94A3B8', accent: '#22C55E' }
  }
]

export function getTemplate(id: string | undefined): DesignTemplate {
  return DESIGN_TEMPLATES.find((t) => t.id === id) ?? DESIGN_TEMPLATES[0]!
}

/* ------------------------------------------------------------------
 * Modo "Personalizar": ajustes por elemento encima de la plantilla.
 * ------------------------------------------------------------------ */

export type Align = 'left' | 'center' | 'right'
export type LogoShape = 'none' | 'circle' | 'rounded'
export type ButtonStyle = DesignTemplate['buttons']
export type PatternStyle = DesignTemplate['pattern']

export interface ElementStyle {
  hidden?: boolean
  /** Multiplicador de tamaño (1 = normal). */
  scale?: number
  /** Hex o color del tema, igual que textColors. */
  color?: string
  align?: Align
}

export interface CustomBlock {
  id: string
  type: 'text' | 'image'
  text: string
  /** Archivo subido (mismo almacén que los logos). */
  image: string | null
  /** Ancho de la imagen en px. */
  width: number
}

/** Cambios sobre la plantilla elegida; lo que no se define usa el valor de la plantilla. */
export interface StyleOverrides {
  /** Id de la plantilla de la que se toma la letra de títulos / textos. */
  fontDisplay?: string
  fontBody?: string
  radius?: number
  buttons?: ButtonStyle
  pattern?: PatternStyle
  blobs?: boolean
  stripes?: boolean
  sparkles?: boolean
}

export interface LayoutConfig {
  elements: Record<string, ElementStyle>
  /** Orden de los bloques de la portada (fijos + añadidos). */
  heroOrder: string[]
  custom: CustomBlock[]
  logoShape: LogoShape
  /** Alto del logo en px. */
  logoSize: number
  style: StyleOverrides
}

export const HERO_BLOCKS = ['badge', 'title', 'subtitle', 'chips'] as const

export const LAYOUT_ELEMENTS: { id: string; label: string; section: string; align: boolean; scale: boolean; color: boolean }[] = [
  { id: 'logo', label: 'Logo', section: 'Encabezado', align: false, scale: false, color: false },
  { id: 'appName', label: 'Nombre de la app', section: 'Encabezado', align: false, scale: true, color: true },
  { id: 'organization', label: 'Organización', section: 'Encabezado', align: false, scale: true, color: true },
  { id: 'badge', label: 'Etiqueta superior', section: 'Portada', align: true, scale: true, color: true },
  { id: 'title', label: 'Título', section: 'Portada', align: true, scale: true, color: true },
  { id: 'subtitle', label: 'Descripción', section: 'Portada', align: true, scale: true, color: true },
  { id: 'chips', label: 'Insignias', section: 'Portada', align: true, scale: true, color: true },
  { id: 'stepHeading', label: 'Encabezado de la foto', section: 'Toma de la foto', align: true, scale: true, color: true },
  { id: 'footer', label: 'Pie de página', section: 'Pie de página', align: true, scale: true, color: true }
]

export const BUTTON_STYLES: { value: ButtonStyle; label: string }[] = [
  { value: 'glow', label: 'Con resplandor' },
  { value: 'flat', label: 'Planos' },
  { value: 'neon', label: 'Neón' },
  { value: 'brutal', label: 'Sombra sólida' },
  { value: 'outline', label: 'Contorno' }
]

export const PATTERN_STYLES: { value: PatternStyle; label: string }[] = [
  { value: 'none', label: 'Liso' },
  { value: 'dots', label: 'Puntos' },
  { value: 'grid', label: 'Cuadrícula' },
  { value: 'diagonal', label: 'Rayas diagonales' },
  { value: 'rays', label: 'Rayos de sol' },
  { value: 'confetti', label: 'Confeti' }
]

export function defaultLayout(): LayoutConfig {
  return { elements: {}, heroOrder: [...HERO_BLOCKS], custom: [], logoShape: 'none', logoSize: 44, style: {} }
}

/** Nombre legible de la letra de títulos / textos de una plantilla. */
export function fontName(tpl: DesignTemplate, which: 'display' | 'body'): string {
  const css = which === 'display' ? tpl.fontDisplay : tpl.fontBody
  return css.match(/'([^']+)'/)?.[1] ?? css
}

/** Plantilla con los cambios del modo "Personalizar" aplicados. */
export function effectiveTemplate(profile: Pick<BrandProfile, 'template' | 'layout'>): DesignTemplate {
  const base = getTemplate(profile.template)
  const s = profile.layout?.style ?? {}
  const fd = s.fontDisplay ? getTemplate(s.fontDisplay) : null
  const fb = s.fontBody ? getTemplate(s.fontBody) : null

  // Une las familias de Google Fonts sin repetir ninguna (Google rechaza duplicados).
  const families = new Map<string, string>()
  const add = (seg: string | undefined) => {
    if (!seg) return
    const name = seg.replace(/^family=/, '').split(':')[0]!
    if (!families.has(name)) families.set(name, seg)
  }
  base.googleFonts.split('&').forEach(add)
  add(fd?.googleFonts.split('&')[0])
  add(fb?.googleFonts.split('&').at(-1))

  return {
    ...base,
    googleFonts: [...families.values()].join('&'),
    fontDisplay: fd?.fontDisplay ?? base.fontDisplay,
    fontBody: fb?.fontBody ?? base.fontBody,
    radius: s.radius ?? base.radius,
    buttons: s.buttons ?? base.buttons,
    pattern: s.pattern ?? base.pattern,
    blobs: s.blobs ?? base.blobs,
    stripes: s.stripes ?? base.stripes,
    sparkles: s.sparkles ?? base.sparkles
  }
}
