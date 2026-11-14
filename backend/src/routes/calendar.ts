import { FastifyInstance, FastifyRequest } from 'fastify'
import { google, calendar_v3 } from 'googleapis'
import { config } from '../lib/config'
import { getUserOAuthClient } from '../lib/google'

type EventBody = {
  title?: string
  description?: string
  location?: string
  allDay?: boolean
  start?: string // ISO datetime, o YYYY-MM-DD si allDay
  end?: string
  recurrence?: string[] // ej: ['RRULE:FREQ=WEEKLY']
}

async function calendarFor(req: FastifyRequest) {
  const { email } = req.user as { email: string }
  const auth = await getUserOAuthClient(email)
  return google.calendar({ version: 'v3', auth })
}

function toGoogleEvent(body: EventBody): calendar_v3.Schema$Event {
  const ev: calendar_v3.Schema$Event = {}
  if (body.title !== undefined) ev.summary = body.title
  if (body.description !== undefined) ev.description = body.description
  if (body.location !== undefined) ev.location = body.location
  if (body.recurrence !== undefined) ev.recurrence = body.recurrence
  if (body.start && body.end) {
    if (body.allDay) {
      ev.start = { date: body.start.slice(0, 10) }
      ev.end = { date: body.end.slice(0, 10) }
    } else {
      ev.start = { dateTime: body.start, timeZone: config.timeZone }
      ev.end = { dateTime: body.end, timeZone: config.timeZone }
    }
  }
  return ev
}

export async function calendarRoutes(app: FastifyInstance) {
  // GET /api/calendar/events?start=&end=
  app.get('/events', async (req) => {
    const { start, end } = req.query as { start?: string; end?: string }
    const calendar = await calendarFor(req)
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start || new Date().toISOString(),
      timeMax: end,
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
    })
    return data.items || []
  })

  app.post('/events', async (req, reply) => {
    const body = req.body as EventBody
    if (!body?.title || !body.start || !body.end) {
      return reply.status(400).send({ error: 'title, start y end son requeridos' })
    }
    const calendar = await calendarFor(req)
    const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody: toGoogleEvent(body) })
    return reply.status(201).send(data)
  })

  app.put('/events/:id', async (req) => {
    const { id } = req.params as { id: string }
    const calendar = await calendarFor(req)
    const { data } = await calendar.events.patch({
      calendarId: 'primary',
      eventId: id,
      requestBody: toGoogleEvent(req.body as EventBody),
    })
    return data
  })

  app.delete('/events/:id', async (req) => {
    const { id } = req.params as { id: string }
    const calendar = await calendarFor(req)
    await calendar.events.delete({ calendarId: 'primary', eventId: id })
    return { success: true }
  })
}
