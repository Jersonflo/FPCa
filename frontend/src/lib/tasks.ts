import { toDateKey } from './api'

export type TaskStatus = 'BACKLOG' | 'TODO' | 'DOING' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'
export type ChecklistItem = { text: string; done: boolean }

export type Task = {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date?: string | null
  project_id?: string | null
  projects?: { id: string; name: string; color: string } | null
  labels: string[]
  checklist: ChecklistItem[]
  position: number
  completed_at?: string | null
}

export const COLUMNS: { id: TaskStatus; title: string; hint: string; accent: string }[] = [
  { id: 'BACKLOG', title: 'Ideas / Algún día', hint: 'Sin prisa', accent: '#6b7280' },
  { id: 'TODO', title: 'Por hacer', hint: 'Pendientes', accent: '#6366f1' },
  { id: 'DOING', title: 'En progreso', hint: 'Lo que estoy haciendo', accent: '#f59e0b' },
  { id: 'DONE', title: 'Hecho', hint: 'Terminado', accent: '#10b981' },
]

export const PRIORITIES: Record<TaskPriority, { label: string; color: string }> = {
  HIGH: { label: 'Alta', color: '#ef4444' },
  MEDIUM: { label: 'Media', color: '#f59e0b' },
  LOW: { label: 'Baja', color: '#6b7280' },
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none'

export function dueState(task: Pick<Task, 'due_date' | 'status'>): DueState {
  if (!task.due_date || task.status === 'DONE') return 'none'
  const today = toDateKey(new Date())
  const due = task.due_date.slice(0, 10)
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  const in3 = new Date()
  in3.setDate(in3.getDate() + 3)
  return due <= toDateKey(in3) ? 'soon' : 'later'
}

export const DUE_STYLES: Record<DueState, string> = {
  overdue: 'bg-red-500/15 text-red-400',
  today: 'bg-amber-500/15 text-amber-400',
  soon: 'bg-indigo-500/15 text-indigo-300',
  later: 'bg-gray-800 text-gray-400',
  none: 'bg-gray-800 text-gray-500',
}
