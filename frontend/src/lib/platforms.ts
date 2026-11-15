import {
  siSupabase, siVercel, siGithub, siNetlify, siCloudflare, siFirebase, siGooglecloud,
  siDocker, siHuggingface, siRailway, siRender, siNeon, siMongodb, siPostgresql, siStripe, siFigma,
  siNotion, siDigitalocean, siNpm, siExpo, siAppwrite, siHostinger, siNamecheap, siGodaddy, siGitlab,
  siTurso, siUpstash, siClerk, siSentry, siGoogleanalytics, siWordpress, siShopify, siDiscord,
  siTelegram, siGoogleplay, siAppstore, siUnity, siHetzner, siVultr, siAnthropic,
} from 'simple-icons'

export type BrandIcon = { path: string; hex: string; title: string }

export type PlatformDef = {
  key: string
  name: string
  icon?: BrandIcon
  /** Color para brillos/anillos (se aclara si el color de marca es muy oscuro) */
  color: string
  category: 'Hosting' | 'Base de datos' | 'Código' | 'Nube' | 'Servicios' | 'Dominio' | 'Tiendas' | 'Otro'
}

/** Si el color de la marca es casi negro (Vercel, GitHub…) se usa azul hielo para que se vea en el fondo oscuro */
function visible(hex: string) {
  const n = parseInt(hex, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum < 0.3 ? '#d9e7f7' : `#${hex}`
}

const def = (key: string, name: string, category: PlatformDef['category'], icon?: BrandIcon, color?: string): PlatformDef => ({
  key, name, category, icon, color: color || (icon ? visible(icon.hex) : '#9aa5f0'),
})

export const PLATFORMS: PlatformDef[] = [
  def('vercel', 'Vercel', 'Hosting', siVercel),
  def('github', 'GitHub', 'Código', siGithub),
  // El logo oficial de GitHub Pages es casi ilegible en pequeño: se usa el de GitHub en lavanda
  def('github-pages', 'GitHub Pages', 'Hosting', siGithub, '#9aa5f0'),
  def('supabase', 'Supabase', 'Base de datos', siSupabase),
  def('netlify', 'Netlify', 'Hosting', siNetlify),
  def('cloudflare', 'Cloudflare', 'Hosting', siCloudflare),
  def('firebase', 'Firebase', 'Base de datos', siFirebase),
  def('render', 'Render', 'Hosting', siRender),
  def('railway', 'Railway', 'Hosting', siRailway),
  def('neon', 'Neon', 'Base de datos', siNeon),
  def('mongodb', 'MongoDB', 'Base de datos', siMongodb),
  def('postgresql', 'PostgreSQL', 'Base de datos', siPostgresql),
  def('turso', 'Turso', 'Base de datos', siTurso),
  def('upstash', 'Upstash', 'Base de datos', siUpstash),
  def('aws', 'AWS', 'Nube', undefined, '#f5c97a'),
  def('gcp', 'Google Cloud', 'Nube', siGooglecloud),
  def('digitalocean', 'DigitalOcean', 'Nube', siDigitalocean),
  def('hetzner', 'Hetzner', 'Nube', siHetzner),
  def('vultr', 'Vultr', 'Nube', siVultr),
  def('docker', 'Docker Hub', 'Código', siDocker),
  def('gitlab', 'GitLab', 'Código', siGitlab),
  def('npm', 'npm', 'Código', siNpm),
  def('huggingface', 'Hugging Face', 'Servicios', siHuggingface),
  def('anthropic', 'Anthropic', 'Servicios', siAnthropic),
  def('stripe', 'Stripe', 'Servicios', siStripe),
  def('clerk', 'Clerk', 'Servicios', siClerk),
  def('sentry', 'Sentry', 'Servicios', siSentry),
  def('appwrite', 'Appwrite', 'Servicios', siAppwrite),
  def('expo', 'Expo', 'Servicios', siExpo),
  def('analytics', 'Google Analytics', 'Servicios', siGoogleanalytics),
  def('figma', 'Figma', 'Servicios', siFigma),
  def('notion', 'Notion', 'Servicios', siNotion),
  def('discord', 'Discord', 'Servicios', siDiscord),
  def('telegram', 'Telegram', 'Servicios', siTelegram),
  def('wordpress', 'WordPress', 'Hosting', siWordpress),
  def('shopify', 'Shopify', 'Tiendas', siShopify),
  def('hostinger', 'Hostinger', 'Dominio', siHostinger),
  def('namecheap', 'Namecheap', 'Dominio', siNamecheap),
  def('godaddy', 'GoDaddy', 'Dominio', siGodaddy),
  def('googleplay', 'Google Play', 'Tiendas', siGoogleplay),
  def('appstore', 'App Store', 'Tiendas', siAppstore),
  def('unity', 'Unity', 'Servicios', siUnity),
  def('other', 'Otra', 'Otro', undefined, '#9aa5f0'),
]

const BY_KEY = new Map(PLATFORMS.map((p) => [p.key, p]))

/** Acepta claves nuevas ("github-pages") y nombres antiguos escritos a mano ("GitHub", "Vercel"…) */
export function platformOf(keyOrName: string): PlatformDef {
  const k = (keyOrName || '').toLowerCase().trim()
  const direct = BY_KEY.get(k) || BY_KEY.get(k.replace(/\s+/g, '-')) || BY_KEY.get(k.replace(/[\s-]+/g, ''))
  if (direct) return direct
  const byName = PLATFORMS.find((p) => p.name.toLowerCase() === k)
  if (byName) return byName
  if (k === 'dockerhub') return BY_KEY.get('docker')!
  return { ...BY_KEY.get('other')!, name: keyOrName || 'Otra' }
}

// ─── Tipos de datos de la red ─────────────────────────────────────
export type PlatformAccount = {
  id: string
  platform: string
  name: string
  username?: string | null
  url?: string | null
  notes?: string | null
  position_x?: number | null
  position_y?: number | null
}
export type ProjectLink = { project_id: string; account_id: string }
export type PlatformHub = { platform: string; position_x: number; position_y: number }
