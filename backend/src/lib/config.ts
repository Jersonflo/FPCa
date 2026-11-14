import dotenv from 'dotenv'

dotenv.config()

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

const jwtSecret = required('JWT_SECRET')
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres')
}

const list = (v?: string) =>
  (v || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: required('GOOGLE_REDIRECT_URI'),
  jwtSecret,
  // Solo estos correos pueden iniciar sesión (separados por coma)
  allowedEmails: list(process.env.ALLOWED_EMAILS).map((e) => e.toLowerCase()),
  // Puede ser una lista separada por coma (ej: local + Vercel)
  frontendUrls: list(process.env.FRONTEND_URL || 'http://localhost:5173'),
  timeZone: process.env.TIME_ZONE || 'America/Bogota',
  port: Number(process.env.PORT) || 3001,
}

if (config.allowedEmails.length === 0) {
  throw new Error('Define ALLOWED_EMAILS con tu correo de Google para restringir el acceso')
}

export const isAllowedEmail = (email?: string | null) =>
  !!email && config.allowedEmails.includes(email.toLowerCase())

/** Copia solo los campos permitidos del body (evita actualizar id, created_at, etc.) */
export function pick<T extends string>(body: unknown, keys: readonly T[]): Partial<Record<T, unknown>> {
  const src = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const out: Partial<Record<T, unknown>> = {}
  for (const k of keys) if (k in src && src[k] !== undefined) out[k] = src[k]
  return out
}
