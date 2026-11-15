import { FastifyInstance } from 'fastify'
import { google } from 'googleapis'
import { config, isAllowedEmail } from '../lib/config'
import { newOAuthClient, saveGoogleTokens } from '../lib/google'

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  // Para listar TODOS tus calendarios (no solo el principal)
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
]

const frontendUrl = () => config.frontendUrls[0]

export async function authRoutes(app: FastifyInstance) {
  // Paso 1: Redirige al login de Google
  app.get('/google', async (_req, reply) => {
    // state firmado y de corta duración para validar que el callback viene de este flujo
    const state = app.jwt.sign({ kind: 'oauth_state' }, { expiresIn: '10m' })
    const url = newOAuthClient().generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state,
    })
    return reply.redirect(url)
  })

  // Paso 2: Google redirige aquí con el código
  app.get('/google/callback', async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string }
    const fail = (reason: string) => reply.redirect(`${frontendUrl()}/login#error=${reason}`)

    try {
      const decoded = state ? app.jwt.verify<{ kind?: string }>(state) : null
      if (!code || decoded?.kind !== 'oauth_state') return fail('invalid_state')
    } catch {
      return fail('invalid_state')
    }

    try {
      const client = newOAuthClient()
      const { tokens } = await client.getToken(code)
      client.setCredentials(tokens)

      const { data: userInfo } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get()

      // Solo tu cuenta puede entrar
      if (!userInfo.email || !userInfo.verified_email || !isAllowedEmail(userInfo.email)) {
        req.log.warn({ email: userInfo.email }, 'Intento de login no autorizado')
        return fail('forbidden')
      }

      // Los tokens de Google se guardan en la BD, no dentro del JWT
      await saveGoogleTokens(userInfo.email, tokens)

      const jwtToken = app.jwt.sign(
        { sub: userInfo.id, email: userInfo.email, name: userInfo.name, picture: userInfo.picture },
        { expiresIn: '7d' }
      )

      // Se envía en el fragmento (#) para que no quede en logs del servidor ni en el Referer
      return reply.redirect(`${frontendUrl()}/login#token=${jwtToken}`)
    } catch (error) {
      req.log.error(error, 'Error en el callback de Google')
      return fail('auth_failed')
    }
  })

  // Verificar token actual
  app.get('/me', async (req, reply) => {
    try {
      await req.jwtVerify()
      const user = req.user as { email?: string }
      if (!isAllowedEmail(user.email)) return reply.status(403).send({ error: 'Forbidden' })
      return req.user
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })
}
