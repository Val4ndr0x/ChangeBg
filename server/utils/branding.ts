import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  DEFAULT_COLORS,
  DEFAULT_PROFILE_ID,
  DEFAULT_TEXTS,
  BUTTON_STYLES,
  DESIGN_TEMPLATES,
  HERO_BLOCKS,
  LAYOUT_ELEMENTS,
  PATTERN_STYLES,
  defaultLayout,
  defaultProfile,
  isValidTextColor,
  type CustomBlock,
  type ElementStyle,
  type LayoutConfig,
  type BrandProfile,
  type BrandingState
} from '../../types/branding'
import { isValidFrameId, listFrames, setActiveFrame } from './frames'

const BRANDING_DIR = path.resolve('server/branding')
const LOGOS_DIR = path.join(BRANDING_DIR, 'logos')
const STATE_PATH = path.join(BRANDING_DIR, 'branding.json')

const LOGO_SIZE = 512
const IMAGE_SIZE = 1600
const CUSTOM_ID = /^c[0-9a-z]{6,16}$/
const MAX_CUSTOM_BLOCKS = 20
const UNUSED_LOGO_GRACE_MS = 24 * 60 * 60 * 1000
const MAX_TEXT = 400
const MAX_PROFILES = 50
const HEX = /^#[0-9a-f]{6}$/i
const PROFILE_ID = /^(default|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
const LOGO_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/

export class BrandingError extends Error {}

export function isValidLogoFile(name: string): boolean {
  return LOGO_FILE.test(name)
}

export function getLogoPath(name: string): string {
  return path.join(LOGOS_DIR, name)
}

const clamp = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined
}
const isTemplateId = (v: unknown): v is string => DESIGN_TEMPLATES.some((t) => t.id === v)

function sanitizeLayout(raw: any): LayoutConfig {
  const layout = defaultLayout()
  if (!raw || typeof raw !== 'object') return layout

  const seen = new Set<string>()
  for (const b of Array.isArray(raw.custom) ? raw.custom : []) {
    if (!b || !CUSTOM_ID.test(String(b.id)) || seen.has(b.id) || layout.custom.length >= MAX_CUSTOM_BLOCKS) continue
    if (b.type !== 'text' && b.type !== 'image') continue
    seen.add(b.id)
    const block: CustomBlock = {
      id: b.id,
      type: b.type,
      text: typeof b.text === 'string' ? b.text.slice(0, MAX_TEXT) : '',
      image: typeof b.image === 'string' && isValidLogoFile(b.image) ? b.image : null,
      width: Math.round(clamp(b.width, 40, 900) ?? 240)
    }
    layout.custom.push(block)
  }

  const validIds = new Set([...LAYOUT_ELEMENTS.map((e) => e.id), ...seen])
  for (const [id, s] of Object.entries((raw.elements ?? {}) as Record<string, any>)) {
    if (!validIds.has(id) || !s || typeof s !== 'object') continue
    const style: ElementStyle = {}
    if (s.hidden === true) style.hidden = true
    const scale = clamp(s.scale, 0.5, 3)
    if (scale !== undefined && scale !== 1) style.scale = Math.round(scale * 100) / 100
    if (isValidTextColor(s.color)) style.color = s.color
    if (['left', 'center', 'right'].includes(s.align)) style.align = s.align
    if (Object.keys(style).length) layout.elements[id] = style
  }

  // Orden de la portada: lo guardado primero, y lo que falte al final.
  const heroIds = new Set<string>([...HERO_BLOCKS, ...seen])
  const order = (Array.isArray(raw.heroOrder) ? raw.heroOrder : []).filter((id: unknown) => typeof id === 'string' && heroIds.has(id))
  layout.heroOrder = [...new Set<string>([...order, ...heroIds])]

  if (['none', 'circle', 'rounded'].includes(raw.logoShape)) layout.logoShape = raw.logoShape
  layout.logoSize = Math.round(clamp(raw.logoSize, 24, 200) ?? layout.logoSize)

  const st = raw.style ?? {}
  if (isTemplateId(st.fontDisplay)) layout.style.fontDisplay = st.fontDisplay
  if (isTemplateId(st.fontBody)) layout.style.fontBody = st.fontBody
  const radius = clamp(st.radius, 0, 3)
  if (radius !== undefined && st.radius !== null) layout.style.radius = radius
  if (BUTTON_STYLES.some((b) => b.value === st.buttons)) layout.style.buttons = st.buttons
  if (PATTERN_STYLES.some((p) => p.value === st.pattern)) layout.style.pattern = st.pattern
  for (const k of ['blobs', 'stripes', 'sparkles'] as const) {
    if (typeof st[k] === 'boolean') layout.style[k] = st[k]
  }
  return layout
}

/**
 * Limpia un perfil que viene del disco o del navegador: campos faltantes
 * toman el valor por defecto y lo inválido se descarta.
 */
function sanitizeProfile(raw: any, frameIds: Set<string>): BrandProfile | null {
  if (!raw || typeof raw !== 'object' || !PROFILE_ID.test(String(raw.id))) return null
  const base = defaultProfile()

  const texts = { ...DEFAULT_TEXTS }
  for (const key of Object.keys(texts) as (keyof typeof texts)[]) {
    const value = raw.texts?.[key]
    if (typeof value === 'string') texts[key] = value.slice(0, MAX_TEXT)
  }

  const colors = { ...DEFAULT_COLORS }
  for (const key of Object.keys(colors) as (keyof typeof colors)[]) {
    const value = raw.colors?.[key]
    if (typeof value === 'string' && HEX.test(value)) colors[key] = value.toUpperCase()
  }

  const textColors: BrandProfile['textColors'] = {}
  for (const key of Object.keys(texts) as (keyof typeof texts)[]) {
    const value = raw.textColors?.[key]
    if (isValidTextColor(value)) textColors[key] = value
  }

  const countdown = Math.round(Number(raw.countdown))

  return {
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : 'Evento sin nombre',
    template: DESIGN_TEMPLATES.some((t) => t.id === raw.template) ? raw.template : base.template,
    logo: typeof raw.logo === 'string' && isValidLogoFile(raw.logo) ? raw.logo : null,
    frameId: typeof raw.frameId === 'string' && frameIds.has(raw.frameId) ? raw.frameId : null,
    countdown: Number.isFinite(countdown) ? Math.min(10, Math.max(0, countdown)) : base.countdown,
    colors,
    texts,
    textColors,
    layout: sanitizeLayout(raw.layout)
  }
}

async function frameIdSet(): Promise<Set<string>> {
  const { frames } = await listFrames()
  return new Set(frames.map((f) => f.id))
}

function normalize(raw: any, frameIds: Set<string>): BrandingState {
  const seen = new Set<string>()
  const profiles: BrandProfile[] = []
  for (const item of Array.isArray(raw?.profiles) ? raw.profiles : []) {
    const profile = sanitizeProfile(item, frameIds)
    if (profile && !seen.has(profile.id)) {
      seen.add(profile.id)
      profiles.push(profile)
    }
  }
  // El evento original siempre existe para poder volver a él.
  if (!seen.has(DEFAULT_PROFILE_ID)) profiles.unshift(defaultProfile())

  const active = profiles.some((p) => p.id === raw?.active) ? raw.active : DEFAULT_PROFILE_ID
  return { active, profiles: profiles.slice(0, MAX_PROFILES) }
}

export async function readBranding(): Promise<BrandingState> {
  let raw: unknown = null
  try {
    raw = JSON.parse(await fs.readFile(STATE_PATH, 'utf8'))
  } catch {
    // Primera vez: se usa el diseño original.
  }
  return normalize(raw, await frameIdSet())
}

/**
 * Guarda todos los eventos, activa el marco del evento elegido y borra los
 * logos que ya nadie usa.
 */
export async function writeBranding(input: unknown): Promise<BrandingState> {
  const state = normalize(input, await frameIdSet())

  await fs.mkdir(BRANDING_DIR, { recursive: true })
  const tmp = `${STATE_PATH}.tmp`
  await fs.writeFile(tmp, JSON.stringify(state, null, 2))
  await fs.rename(tmp, STATE_PATH)

  const active = state.profiles.find((p) => p.id === state.active)
  if (active?.frameId && isValidFrameId(active.frameId)) {
    await setActiveFrame(active.frameId).catch(() => {})
  }

  await removeUnusedLogos(state)
  return state
}

async function removeUnusedLogos(state: BrandingState): Promise<void> {
  const used = new Set<string>()
  for (const p of state.profiles) {
    if (p.logo) used.add(p.logo)
    for (const b of p.layout.custom) if (b.image) used.add(b.image)
  }
  // Solo se borran archivos viejos: uno recién subido puede estar en un
  // borrador que todavía no se ha guardado (o abierto en otra pestaña).
  const cutoff = Date.now() - UNUSED_LOGO_GRACE_MS
  const files = await fs.readdir(LOGOS_DIR).catch(() => [] as string[])
  for (const file of files) {
    if (!isValidLogoFile(file) || used.has(file)) continue
    const filePath = path.join(LOGOS_DIR, file)
    const stat = await fs.stat(filePath).catch(() => null)
    if (stat && stat.mtimeMs < cutoff) await fs.unlink(filePath).catch(() => {})
  }
}

/**
 * Guarda un logo (máx. 512 px) o una imagen de la portada (máx. 1600 px) como
 * PNG y devuelve su nombre.
 */
export async function saveLogo(input: Buffer, kind: 'logo' | 'image' = 'logo'): Promise<string> {
  const max = kind === 'image' ? IMAGE_SIZE : LOGO_SIZE
  let output: Buffer
  try {
    output = await sharp(input)
      .rotate()
      .resize(max, max, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer()
  } catch {
    throw new BrandingError('No se pudo leer la imagen del logo. Usa PNG, JPG, WebP o SVG.')
  }

  const name = `${randomUUID()}.png`
  await fs.mkdir(LOGOS_DIR, { recursive: true })
  await fs.writeFile(getLogoPath(name), output)
  return name
}
