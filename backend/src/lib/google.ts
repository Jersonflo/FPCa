import { google } from 'googleapis'
import { config } from './config'
import { supabase } from './supabase'

export function newOAuthClient() {
  return new google.auth.OAuth2(config.googleClientId, config.googleClientSecret, config.googleRedirectUri)
}

export class GoogleReauthError extends Error {
  constructor() {
    super('Vuelve a iniciar sesión con Google')
  }
}

/** Guarda los tokens de Google en la base de datos (nunca en el JWT ni en el navegador). */
export async function saveGoogleTokens(
  email: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }
) {
  const row: Record<string, unknown> = { email, updated_at: new Date().toISOString() }
  if (tokens.access_token) row.access_token = tokens.access_token
  if (tokens.expiry_date) row.expiry_date = tokens.expiry_date
  if (tokens.refresh_token) row.refresh_token = tokens.refresh_token
  const { error } = await supabase.from('google_tokens').upsert(row, { onConflict: 'email' })
  if (error) throw new Error(`No se pudieron guardar los tokens de Google: ${error.message}`)
}

/** Cliente OAuth autenticado para el usuario; refresca y persiste los tokens automáticamente. */
export async function getUserOAuthClient(email: string) {
  const { data, error } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expiry_date')
    .eq('email', email)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.refresh_token) throw new GoogleReauthError()

  const client = newOAuthClient()
  client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expiry_date ? Number(data.expiry_date) : undefined,
  })
  client.on('tokens', (tokens) => {
    saveGoogleTokens(email, tokens).catch(() => {})
  })
  return client
}
