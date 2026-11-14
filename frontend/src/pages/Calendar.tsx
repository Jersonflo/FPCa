import { useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import type { DatesSetArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, CalendarClock, ListTodo, AlertTriangle } from 'lucide-react'
import { api, toDateKey, formatDate } from '../lib/api'
import { PRIORITIES, dueState, DUE_STYLES, type Task } from '../lib/tasks'
import EventModal, { type GoogleEvent } from '../components/EventModal'
import TaskModal from '../components/TaskModal'
import { Modal, Button } from '../components/ui'

type Range = { start: Date; end: Date }

export default function CalendarPage() {
  const qc = useQueryClient()
  const [range, setRange] = useState<Range | null>(null)
  const [showEvents, setShowEvents] = useState(true)
  const [showTasks, setShowTasks] = useState(true)

  const [eventModal, setEventModal] = useState<{ event?: GoogleEvent; date?: Date } | null>(null)
  const [taskModal, setTaskModal] = useState<{ task?: Task; date?: string } | null>(null)
  const [chooser, setChooser] = useState<Date | null>(null)

  const eventsQuery = useQuery<GoogleEvent[]>({
    queryKey: ['calendar-events', range?.start.toISOString(), range?.end.toISOString()],
    queryFn: () =>
      api.get(`/api/calendar/events?start=${encodeURIComponent(range!.start.toISOString())}&end=${encodeURIComponent(range!.end.toISOString())}`),
    enabled: !!range,
  })
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ['tasks'], queryFn: () => api.get('/api/tasks') })

  const refreshEvents = () => qc.invalidateQueries({ queryKey: ['calendar-events'] })

  const calendarEvents = useMemo<EventInput[]>(() => {
    const out: EventInput[] = []
    if (showEvents) {
      for (const e of eventsQuery.data || []) {
        out.push({
          id: `g:${e.id}`,
          title: e.summary || 'Sin título',
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          allDay: !e.start?.dateTime,
          extendedProps: { kind: 'event', raw: e },
        })
      }
    }
    if (showTasks) {
      for (const t of tasks) {
        if (!t.due_date) continue
        const done = t.status === 'DONE'
        out.push({
          id: `t:${t.id}`,
          title: `${done ? '✓' : '☐'} ${t.title}`,
          start: t.due_date.slice(0, 10),
          allDay: true,
          backgroundColor: done ? '#1f2937' : PRIORITIES[t.priority].color + '30',
          borderColor: done ? '#374151' : PRIORITIES[t.priority].color,
          textColor: done ? '#6b7280' : '#f3f4f6',
          classNames: done ? ['line-through'] : [],
          extendedProps: { kind: 'task', raw: t },
        })
      }
    }
    return out
  }, [eventsQuery.data, tasks, showEvents, showTasks])

  const upcoming = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'DONE' && t.due_date)
        .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
        .slice(0, 8),
    [tasks]
  )
  const noDate = tasks.filter((t) => t.status !== 'DONE' && !t.due_date && t.status !== 'BACKLOG').length

  const onEventClick = (arg: EventClickArg) => {
    const { kind, raw } = arg.event.extendedProps as { kind: string; raw: GoogleEvent | Task }
    if (kind === 'task') setTaskModal({ task: raw as Task })
    else setEventModal({ event: raw as GoogleEvent })
  }

  // Arrastrar en el calendario: mueve la fecha de la tarea o el horario del evento
  const onEventDrop = async (arg: EventDropArg) => {
    const { kind, raw } = arg.event.extendedProps as { kind: string; raw: GoogleEvent | Task }
    try {
      if (kind === 'task') {
        await api.put(`/api/tasks/${(raw as Task).id}`, { due_date: toDateKey(arg.event.start!) })
        qc.invalidateQueries({ queryKey: ['tasks'] })
      } else {
        const ev = raw as GoogleEvent
        const start = arg.event.start!
        const end = arg.event.end || new Date(start.getTime() + 60 * 60 * 1000)
        await api.put(`/api/calendar/events/${ev.id}`, arg.event.allDay
          ? { allDay: true, start: toDateKey(start), end: toDateKey(end) }
          : { allDay: false, start: start.toISOString(), end: end.toISOString() })
        refreshEvents()
      }
    } catch (err) {
      arg.revert()
      alert(`No se pudo mover: ${(err as Error).message}`)
    }
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4 lg:flex-row">
      <div className="flex-1 flex flex-col min-h-[540px]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Calendario</h2>
            <p className="text-xs text-gray-500">Reuniones de Google Calendar + fechas límite de tus tareas</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-gray-300 bg-gray-800 px-2.5 py-2 rounded-lg cursor-pointer">
              <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} className="accent-indigo-500" />
              Eventos
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-300 bg-gray-800 px-2.5 py-2 rounded-lg cursor-pointer">
              <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} className="accent-indigo-500" />
              Tareas
            </label>
            <button
              onClick={() => setTaskModal({ date: toDateKey(new Date()) })}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-lg"
            >
              <ListTodo size={15} /> Tarea
            </button>
            <button
              onClick={() => setEventModal({})}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg"
            >
              <Plus size={15} /> Evento
            </button>
          </div>
        </div>

        {eventsQuery.isError && (
          <p className="text-xs text-red-400 mb-2">No se pudieron cargar los eventos de Google: {(eventsQuery.error as Error).message}</p>
        )}

        <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-2 overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={esLocale}
            events={calendarEvents}
            height="100%"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            editable
            dayMaxEvents={3}
            nowIndicator
            datesSet={(arg: DatesSetArg) => setRange({ start: arg.start, end: arg.end })}
            dateClick={(arg: DateClickArg) => setChooser(arg.date)}
            eventClick={onEventClick}
            eventDrop={onEventDrop}
          />
        </div>
      </div>

      {/* Panel lateral: próximas fechas límite */}
      <aside className="lg:w-72 shrink-0 bg-gray-900 border border-gray-800 rounded-xl p-4 h-fit">
        <h3 className="text-sm font-medium text-white flex items-center gap-2 mb-3">
          <CalendarClock size={16} className="text-indigo-400" /> Próximos pendientes
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-xs text-gray-500">No tienes tareas con fecha. Haz clic en un día para agregar una.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((t) => {
              const s = dueState(t)
              return (
                <li key={t.id}>
                  <button onClick={() => setTaskModal({ task: t })} className="w-full text-left flex items-start gap-2 hover:bg-gray-800 rounded-lg p-1.5 -m-1.5">
                    <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITIES[t.priority].color }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-200 truncate">{t.title}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 rounded mt-0.5 ${DUE_STYLES[s]}`}>
                        {s === 'overdue' && <AlertTriangle size={10} />}
                        {s === 'today' ? 'Hoy' : formatDate(t.due_date!, { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {noDate > 0 && <p className="text-[11px] text-gray-500 mt-3">+ {noDate} tareas por hacer sin fecha (ver en Tareas)</p>}
      </aside>

      {/* Al hacer clic en un día: ¿evento o tarea? */}
      {chooser && (
        <Modal title={chooser.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setChooser(null)}>
          <p className="text-sm text-gray-400">¿Qué quieres agregar?</p>
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => { setEventModal({ date: chooser }); setChooser(null) }} className="py-4 flex-col">
              <Plus size={18} /> Reunión / evento
              <span className="text-[11px] font-normal opacity-75">Se guarda en Google</span>
            </Button>
            <Button variant="ghost" onClick={() => { setTaskModal({ date: toDateKey(chooser) }); setChooser(null) }} className="py-4 flex-col">
              <ListTodo size={18} /> Tarea pendiente
              <span className="text-[11px] font-normal opacity-75">Va a tu tablero</span>
            </Button>
          </div>
        </Modal>
      )}

      {eventModal && (
        <EventModal event={eventModal.event} defaultDate={eventModal.date} onClose={() => setEventModal(null)} onSaved={refreshEvents} />
      )}
      {taskModal && (
        <TaskModal task={taskModal.task} defaults={{ due_date: taskModal.date }} onClose={() => setTaskModal(null)} />
      )}
    </div>
  )
}
