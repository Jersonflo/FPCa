import { FastifyInstance } from 'fastify'
import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

function getOAuthClient(accessToken: string, refreshToken?: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  return auth
}

export async function calendarRoutes(app: FastifyInstance) {
  // Middleware: extraer tokens del JWT
  app.addHook('onRequest', async (req, reply) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // GET /api/calendar/events?start=&end=
  app.get('/events', async (req, reply) => {
    const user = req.user as { google_access_token: string; google_refresh_token: string }
    const { start, end } = req.query as { start?: string; end?: string }

    const auth = getOAuthClient(user.google_access_token, user.google_refresh_token)
    const calendar = google.calendar({ version: 'v3', auth })

    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start || new Date().toISOString(),
      timeMax: end,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    })

    return data.items || []
  })

  // POST /api/calendar/events — crear evento
  app.post('/events', async (req, reply) => {
    const user = req.user as { google_access_token: string; google_refresh_token: string }
    const body = req.body as {
      title: string
      description?: string
      start: string
      end: string
      type?: string // 'task' | 'meeting' | 'recurring' | 'milestone'
      recurrence?: string[] // e.g. ['RRULE:FREQ=WEEKLY']
      conferenceUrl?: string
    }

    const auth = getOAuthClient(user.google_access_token, user.google_refresh_token)
    const calendar = google.calendar({ version: 'v3', auth })

    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: body.title,
        description: body.description,
        start: { dateTime: body.start, timeZone: 'America/Bogota' },
        end: { dateTime: body.end, timeZone: 'America/Bogota' },
        recurrence: body.recurrence,
        extendedProperties: {
          private: { eventType: body.type || 'task' },
        },
      },
    })

    return reply.status(201).send(data)
  })

  // PUT /api/calendar/events/:id
  app.put('/events/:id', async (req, reply) => {
    const user = req.user as { google_access_token: string; google_refresh_token: string }
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>

    const auth = getOAuthClient(user.google_access_token, user.google_refresh_token)
    const calendar = google.calendar({ version: 'v3', auth })

    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId: id,
      requestBody: body as object,
    })

    return data
  })

  // DELETE /api/calendar/events/:id
  app.delete('/events/:id', async (req, reply) => {
    const user = req.user as { google_access_token: string; google_refresh_token: string }
    const { id } = req.params as { id: string }

    const auth = getOAuthClient(user.google_access_token, user.google_refresh_token)
    const calendar = google.calendar({ version: 'v3', auth })

    await calendar.events.delete({ calendarId: 'primary', eventId: id })
    return { success: true }
  })
}

