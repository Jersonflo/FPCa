import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { Plus } from 'lucide-react'

export default function CalendarPage() {
  const now = new Date()
  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events', now.getMonth(), now.getFullYear()],
    queryFn: () => {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()
      return apiFetch(`/api/calendar/events?start=${start}&end=${end}`)
    },
  })

  const calendarEvents = events.map((e: {
    id: string; summary?: string; start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string }; description?: string
  }) => ({
    id: e.id,
    title: e.summary || 'Sin título',
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    extendedProps: { description: e.description },
  }))

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Calendario</h2>
          <p className="text-xs text-gray-500">Sincronizado con Google Calendar</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-2 rounded-lg transition-colors">
          <Plus size={16} /> Nuevo evento
        </button>
      </div>
      <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-2 overflow-hidden">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          events={calendarEvents}
          height="100%"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          editable
          selectable
          dayMaxEvents={3}
        />
      </div>
    </div>
  )
}

