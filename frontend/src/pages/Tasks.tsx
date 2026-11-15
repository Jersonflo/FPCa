import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, CalendarDays, CheckSquare, AlertTriangle, Search, Trash2 } from 'lucide-react'
import { api, formatDate } from '../lib/api'
import { COLUMNS, PRIORITIES, DUE_STYLES, dueState, type Task, type TaskStatus } from '../lib/tasks'
import TaskModal from '../components/TaskModal'

function TaskCard({ task, onOpen, onDragStart, onDragEnd }: { task: Task; onOpen: () => void; onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void }) {
  const due = dueState(task)
  const done = task.checklist?.filter((i) => i.done).length || 0
  const total = task.checklist?.length || 0

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`group bg-gray-800 hover:bg-gray-700 border border-gray-800 hover:border-gray-700 rounded-2xl p-3.5 cursor-pointer select-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-18px_rgba(127,178,255,0.5)] ${
        task.status === 'DONE' ? 'opacity-60' : ''
      }`}
      style={{ borderLeft: `3px solid ${PRIORITIES[task.priority]?.color || '#6b7280'}` }}
    >
      {task.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {task.labels.map((l) => (
            <span key={l} className="text-[10px] bg-indigo-500/15 text-indigo-300 px-1.5 py-0.5 rounded">{l}</span>
          ))}
        </div>
      )}
      <p className={`text-sm text-gray-100 leading-snug ${task.status === 'DONE' ? 'line-through text-gray-500' : ''}`}>{task.title}</p>
      {total > 0 && task.status !== 'DONE' && (
        <div className="h-[3px] rounded-full bg-white/[0.06] mt-2.5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#7fb2ff] to-[#98ffe8] transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${DUE_STYLES[due]}`}>
            <CalendarDays size={11} />
            {due === 'today' ? 'Hoy' : formatDate(task.due_date)}
          </span>
        )}
        {total > 0 && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${done === total ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-700/60 text-gray-400'}`}>
            <CheckSquare size={11} /> {done}/{total}
          </span>
        )}
        {task.projects && (
          <span className="inline-flex items-center gap-1 text-gray-400 truncate max-w-[120px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: task.projects.color }} />
            {task.projects.name}
          </span>
        )}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const qc = useQueryClient()
  const { data: tasks = [], isLoading } = useQuery<Task[]>({ queryKey: ['tasks'], queryFn: () => api.get('/api/tasks') })

  const [modal, setModal] = useState<{ task?: Task | null; status?: TaskStatus } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter(
      (t) =>
        (!q || t.title.toLowerCase().includes(q) || t.labels?.some((l) => l.toLowerCase().includes(q))) &&
        (!projectFilter || t.project_id === projectFilter)
    )
  }, [tasks, search, projectFilter])

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { BACKLOG: [], TODO: [], DOING: [], DONE: [] }
    for (const t of filtered) map[t.status]?.push(t)
    for (const k of Object.keys(map) as TaskStatus[]) map[k].sort((a, b) => a.position - b.position)
    return map
  }, [filtered])

  const projects = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>()
    tasks.forEach((t) => t.projects && m.set(t.projects.id, t.projects))
    return [...m.values()]
  }, [tasks])

  const overdue = tasks.filter((t) => dueState(t) === 'overdue').length
  const today = tasks.filter((t) => dueState(t) === 'today').length
  const pending = tasks.filter((t) => t.status !== 'DONE').length

  // Soltar una tarjeta: calcula la nueva posición según dónde cae dentro de la columna
  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    setOverCol(null)
    const id = dragId || e.dataTransfer.getData('text/plain')
    setDragId(null)
    const task = tasks.find((t) => t.id === id)
    if (!task) return

    const colEl = e.currentTarget as HTMLElement
    const cards = [...colEl.querySelectorAll<HTMLElement>('[data-task-id]')].filter((el) => el.dataset.taskId !== id)
    const siblings = byColumn[status].filter((t) => t.id !== id)
    let index = cards.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return e.clientY < r.top + r.height / 2
    })
    if (index === -1) index = siblings.length

    const before = siblings[index - 1]?.position
    const after = siblings[index]?.position
    const position =
      before === undefined && after === undefined ? 1000
        : before === undefined ? after! - 1000
        : after === undefined ? before + 1000
        : (before + after) / 2

    if (task.status === status && task.position === position) return

    // Actualización optimista
    qc.setQueryData<Task[]>(['tasks'], (old = []) => old.map((t) => (t.id === id ? { ...t, status, position } : t)))
    try {
      await api.put(`/api/tasks/${id}`, { status, position })
    } finally {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    }
  }

  const clearDone = async () => {
    if (!confirm('¿Borrar todas las tareas de "Hecho"?')) return
    await api.del('/api/tasks/done')
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 md:p-8 pb-4 md:pb-6 flex flex-wrap items-end gap-3 justify-between">
        <div>
          <p className="label-caps mb-2">Organización</p>
          <h2 className="text-gradient">Tareas</h2>
          <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            <span>{pending} pendientes</span>
            {today > 0 && <span className="text-[#f5c97a]">· {today} para hoy</span>}
            {overdue > 0 && (
              <span className="text-[#ff8fb1] inline-flex items-center gap-1">
                · <AlertTriangle size={11} /> {overdue} vencidas
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="bg-gray-800 border border-gray-700 text-xs text-white rounded-lg pl-8 pr-2.5 py-2 w-36 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          {projects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-xs text-white rounded-lg px-2.5 py-2 focus:outline-hidden"
            >
              <option value="">Todos los proyectos</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setModal({ status: 'TODO' })}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium px-4 py-2.5 rounded-full"
          >
            <Plus size={16} /> Nueva tarea
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-sm px-6">Cargando tareas…</p>
      ) : (
        <div className="flex-1 flex gap-3 overflow-x-auto px-4 md:px-6 pb-4 snap-x stagger">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.id) }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOverCol(null)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`snap-start shrink-0 w-[80vw] sm:w-72 flex flex-col rounded-2xl border transition-all duration-300 ${
                overCol === col.id ? 'border-[#98ffe8]/40 bg-[#98ffe8]/[0.04] shadow-[0_0_50px_-15px_rgba(152,255,232,0.5)]' : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.accent, boxShadow: `0 0 8px ${col.accent}` }} />
                  <span className="label-caps !text-gray-200">{col.title}</span>
                  <span className="text-[10px] text-gray-400 bg-white/[0.05] rounded-full px-1.5 py-0.5 tabular-nums">{byColumn[col.id].length}</span>
                </div>
                <div className="flex items-center gap-1">
                  {col.id === 'DONE' && byColumn.DONE.length > 0 && (
                    <button onClick={clearDone} title="Borrar terminadas" className="text-gray-500 hover:text-red-400 p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button onClick={() => setModal({ status: col.id })} title="Agregar tarea" className="text-gray-500 hover:text-white p-1">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                {byColumn[col.id].map((t) => (
                  <div key={t.id} data-task-id={t.id} className={dragId === t.id ? 'opacity-40' : ''}>
                    <TaskCard
                      task={t}
                      onOpen={() => setModal({ task: t })}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', t.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragId(t.id)
                      }}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                    />
                  </div>
                ))}
                {byColumn[col.id].length === 0 && (
                  <button
                    onClick={() => setModal({ status: col.id })}
                    className="w-full text-xs text-gray-600 hover:text-gray-400 border border-dashed border-gray-800 rounded-lg py-6"
                  >
                    {col.hint} · + Agregar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <TaskModal task={modal.task} defaults={{ status: modal.status }} onClose={() => setModal(null)} />}
    </div>
  )
}
