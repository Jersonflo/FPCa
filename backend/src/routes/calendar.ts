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
  // Junta los eventos de TODOS los calendarios visibles de la cuenta (principal, compartidos, festivos…)
  app.get('/events', async (req) => {
    const { start, end } = req.query as { start?: string; end?: string }
    const calendar = await calendarFor(req)

    type Cal = { id: string; name: string; color?: string | null; writable: boolean; primary: boolean }
    let cals: Cal[] = [{ id: 'primary', name: 'Principal', color: null, writable: true, primary: true }]
    try {
      const { data } = await calendar.calendarList.list({ minAccessRole: 'reader', maxResults: 50 })
      const visible = (data.items || []).filter((c) => c.id && c.selected !== false && !c.hidden)
      if (visible.length) {
        cals = visible.map((c) => ({
          id: c.id!,
          name: c.summaryOverride || c.summary || c.id!,
          color: c.backgroundColor,
          writable: c.accessRole === 'owner' || c.accessRole === 'writer',
          primary: Boolean(c.primary),
        }))
      }
    } catch (err) {
      // Sesión de Google vencida → que el usuario vuelva a entrar
      if ((err as { response?: { data?: { error?: string } } }).response?.data?.error === 'invalid_grant') throw err
      // Sin el permiso nuevo (sesión antigua) → solo el calendario principal
      req.log.warn('No se pudo listar calendarios; usando solo el principal')
    }

    const lists = await Promise.all(
      cals.map(async (c) => {
        try {
          const { data } = await calendar.events.list({
            calendarId: c.id,
            timeMin: start || new Date().toISOString(),
            timeMax: end,
            maxResults: 250,
            singleEvents: true,
            orderBy: 'startTime',
          })
          return (data.items || []).map((e) => ({
            ...e,
            calendarId: c.primary ? 'primary' : c.id,
            calendarName: c.name,
            calendarColor: c.color,
            readOnly: !c.writable,
          }))
        } catch (err) {
          if (c.primary) throw err
          return []
        }
      })
    )
    return lists.flat()
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
    const { calendarId = 'primary' } = req.query as { calendarId?: string }
    const calendar = await calendarFor(req)
    const { data } = await calendar.events.patch({
      calendarId,
      eventId: id,
      requestBody: toGoogleEvent(req.body as EventBody),
    })
    return data
  })

  app.delete('/events/:id', async (req) => {
    const { id } = req.params as { id: string }
    const { calendarId = 'primary' } = req.query as { calendarId?: string }
    const calendar = await calendarFor(req)
    await calendar.events.delete({ calendarId, eventId: id })
    return { success: true }
  })
}
