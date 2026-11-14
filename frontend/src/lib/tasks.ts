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
  { id: 'BACKLOG', title: 'Ideas / Algún día', hint: 'Sin prisa', accent: '#6b7a93' },
  { id: 'TODO', title: 'Por hacer', hint: 'Pendientes', accent: '#7fb2ff' },
  { id: 'DOING', title: 'En progreso', hint: 'Lo que estoy haciendo', accent: '#9aa5f0' },
  { id: 'DONE', title: 'Hecho', hint: 'Terminado', accent: '#98ffe8' },
]

export const PRIORITIES: Record<TaskPriority, { label: string; color: string }> = {
  HIGH: { label: 'Alta', color: '#ff5c8a' },
  MEDIUM: { label: 'Media', color: '#f5c97a' },
  LOW: { label: 'Baja', color: '#6b7a93' },
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
  overdue: 'bg-[#e0457b]/15 text-[#ff8fb1]',
  today: 'bg-[#f5c97a]/15 text-[#f5c97a]',
  soon: 'bg-[#9aa5f0]/15 text-[#c3caf8]',
  later: 'bg-gray-800 text-gray-400',
  none: 'bg-gray-800 text-gray-500',
}
