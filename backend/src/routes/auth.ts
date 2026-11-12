import { FastifyInstance } from 'fastify'
import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
]

export async function authRoutes(app: FastifyInstance) {
  // Paso 1: Redirige al login de Google
  app.get('/google', async (req, reply) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    })
    reply.redirect(url)
  })

  // Paso 2: Google redirige aquí con el código
  app.get('/google/callback', async (req, reply) => {
    const { code } = req.query as { code: string }
    try {
      const { tokens } = await oauth2Client.getToken(code)
      oauth2Client.setCredentials(tokens)

      // Obtener info del usuario
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data: userInfo } = await oauth2.userinfo.get()

      // Crear JWT con tokens de Google incluidos
      const jwtToken = app.jwt.sign({
        sub: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
      }, { expiresIn: '7d' })

      // Redirigir al frontend con el token (a /login para que lo capture el useEffect)
      reply.redirect(`${process.env.FRONTEND_URL}/login?token=${jwtToken}`)
    } catch (error) {
      reply.status(500).send({ error: 'Auth failed' })
    }
  })

  // Verificar token actual
  app.get('/me', async (req, reply) => {
    try {
      await req.jwtVerify()
      return req.user
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })
}

