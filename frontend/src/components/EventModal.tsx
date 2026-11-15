import { useState } from 'react'
import { Trash2, ExternalLink } from 'lucide-react'
import { api, toDateKey } from '../lib/api'
import { Modal, Field, Input, Textarea, Button, Select } from './ui'

export type GoogleEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  hangoutLink?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  recurringEventId?: string
  calendarId?: string
  calendarName?: string
  calendarColor?: string | null
  readOnly?: boolean
}

export const calQuery = (e?: GoogleEvent | null) => `?calendarId=${encodeURIComponent(e?.calendarId || 'primary')}`

const pad = (n: number) => String(n).padStart(2, '0')
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Fecha+hora local → ISO con el offset local (Google respeta la zona) */
function localISO(date: string, time: string) {
  const d = new Date(`${date}T${time}:00`)
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  return `${date}T${time}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
}

const REPEAT = [
  { value: '', label: 'No se repite' },
  { value: 'RRULE:FREQ=DAILY', label: 'Cada día' },
  { value: 'RRULE:FREQ=WEEKLY', label: 'Cada semana' },
  { value: 'RRULE:FREQ=MONTHLY', label: 'Cada mes' },
]

export default function EventModal({
  event,
  defaultDate,
  onClose,
  onSaved,
}: {
  event?: GoogleEvent | null
  defaultDate?: Date
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = Boolean(event?.id)
  const startDt = event?.start?.dateTime ? new Date(event.start.dateTime) : null
  const endDt = event?.end?.dateTime ? new Date(event.end.dateTime) : null
  const base = defaultDate || new Date()
  const defaultStart = new Date(base)
  if (!defaultDate || (base.getHours() === 0 && base.getMinutes() === 0)) defaultStart.setHours(9, 0, 0, 0)

  const [title, setTitle] = useState(event?.summary || '')
  const [description, setDescription] = useState(event?.description || '')
  const [location, setLocation] = useState(event?.location || '')
  const [allDay, setAllDay] = useState(Boolean(event?.start?.date && !event.start.dateTime))
  const [date, setDate] = useState(event?.start?.date || (startDt ? toDateKey(startDt) : toDateKey(defaultStart)))
  const [start, setStart] = useState(startDt ? timeOf(startDt) : timeOf(defaultStart))
  const [end, setEnd] = useState(
    endDt ? timeOf(endDt) : timeOf(new Date(defaultStart.getTime() + 60 * 60 * 1000))
  )
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    if (!allDay && end <= start) return alert('La hora de fin debe ser después del inicio')
    setSaving(true)
    let body: Record<string, unknown>
    if (allDay) {
      const next = new Date(`${date}T00:00:00`)
      next.setDate(next.getDate() + 1)
      body = { title, description, location, allDay: true, start: date, end: toDateKey(next) }
    } else {
      body = { title, description, location, allDay: false, start: localISO(date, start), end: localISO(date, end) }
    }
    if (!isEditing && repeat) body.recurrence = [repeat]
    try {
      if (isEditing) await api.put(`/api/calendar/events/${event!.id}${calQuery(event)}`, body)
      else await api.post('/api/calendar/events', body)
      onSaved()
      onClose()
    } catch (err) {
      alert(`Error: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!event || !confirm(`¿Eliminar "${event.summary}" de Google Calendar?`)) return
    await api.del(`/api/calendar/events/${event.id}${calQuery(event)}`)
    onSaved()
    onClose()
  }

  return (
    <Modal
      title={isEditing ? 'Editar evento' : 'Nuevo evento / reunión'}
      onClose={onClose}
      footer={
        <>
          {isEditing && (
            <Button variant="danger" onClick={remove} className="mr-auto"><Trash2 size={15} /> Eliminar</Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </>
      }
    >
      {event?.calendarName && (
        <p className="flex items-center gap-2 text-xs text-gray-400 -mt-1">
          <span className="w-2 h-2 rounded-full" style={{ background: event.calendarColor || '#9aa5f0' }} />
          {event.calendarName}
          {event.readOnly && <span className="text-gray-500">· solo lectura</span>}
        </p>
      )}
      <Field label="Título">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunión con…" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-indigo-500" />
        Todo el día
      </label>
      <div className="grid grid-cols-3 gap-3">
        <div className={allDay ? 'col-span-3' : ''}>
          <Field label="Fecha"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {!allDay && (
          <>
            <Field label="Inicio"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Fin"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </>
        )}
      </div>
      {!isEditing && (
        <Field label="Repetir">
          <Select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            {REPEAT.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Lugar o link">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Oficina, Zoom, Meet…" />
      </Field>
      <Field label="Descripción">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      {event?.htmlLink && (
        <a href={event.htmlLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
          Abrir en Google Calendar <ExternalLink size={12} />
        </a>
      )}
      {event?.recurringEventId && (
        <p className="text-[11px] text-gray-500">Este evento se repite: los cambios aplican solo a esta ocurrencia.</p>
      )}
    </Modal>
  )
}
