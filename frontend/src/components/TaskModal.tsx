import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, X, CalendarPlus } from 'lucide-react'
import { api } from '../lib/api'
import { COLUMNS, PRIORITIES, type ChecklistItem, type Task, type TaskPriority, type TaskStatus } from '../lib/tasks'
import { Modal, Field, Input, Select, Textarea, Button } from './ui'

type Props = {
  task?: Task | null
  defaults?: Partial<Pick<Task, 'status' | 'due_date'>>
  onClose: () => void
}

export default function TaskModal({ task, defaults, onClose }: Props) {
  const qc = useQueryClient()
  const isEditing = Boolean(task?.id)

  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [status, setStatus] = useState<TaskStatus>(task?.status || defaults?.status || 'TODO')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'MEDIUM')
  const [dueDate, setDueDate] = useState(task?.due_date?.slice(0, 10) || defaults?.due_date || '')
  const [projectId, setProjectId] = useState(task?.project_id || '')
  const [labels, setLabels] = useState<string[]>(task?.labels || [])
  const [newLabel, setNewLabel] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist || [])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: projectsData } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/api/projects') })
  const projects: { id: string; name: string; status: string }[] = projectsData?.projects || []

  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks'] })

  const addLabel = () => {
    const v = newLabel.trim()
    if (v && !labels.includes(v)) setLabels([...labels, v])
    setNewLabel('')
  }
  const addItem = () => {
    const v = newItem.trim()
    if (v) setChecklist([...checklist, { text: v, done: false }])
    setNewItem('')
  }

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const body = {
      title: title.trim(),
      description,
      status,
      priority,
      due_date: dueDate || null,
      project_id: projectId || null,
      labels,
      checklist,
    }
    try {
      if (isEditing) await api.put(`/api/tasks/${task!.id}`, body)
      else await api.post('/api/tasks', body)
      await refresh()
      onClose()
    } catch (err) {
      alert(`Error al guardar: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!task || !confirm(`¿Eliminar la tarea "${task.title}"?`)) return
    await api.del(`/api/tasks/${task.id}`)
    await refresh()
    onClose()
  }

  const done = checklist.filter((i) => i.done).length

  return (
    <Modal
      wide
      title={isEditing ? 'Editar tarea' : 'Nueva tarea'}
      onClose={onClose}
      footer={
        <>
          {isEditing && (
            <Button variant="danger" onClick={remove} className="mr-auto">
              <Trash2 size={15} /> Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save()} disabled={saving || !title.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <Field label="Título">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué hay que hacer?" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Columna">
            <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {(Object.keys(PRIORITIES) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITIES[p].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha límite" hint={<span className="inline-flex items-center gap-1"><CalendarPlus size={11} /> Aparece en el calendario</span>}>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Proyecto">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Ninguno —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Descripción">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles, links, notas…" />
        </Field>

        {/* Etiquetas */}
        <div>
          <span className="block text-xs font-medium text-gray-400 mb-1">Etiquetas</span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {labels.map((l) => (
              <span key={l} className="inline-flex items-center gap-1 text-xs bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded-full">
                {l}
                <button type="button" onClick={() => setLabels(labels.filter((x) => x !== l))}><X size={11} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
              placeholder="Ej: personal, trabajo, universidad"
            />
            <Button type="button" variant="ghost" onClick={addLabel}><Plus size={15} /></Button>
          </div>
        </div>

        {/* Checklist */}
        <div>
          <span className="block text-xs font-medium text-gray-400 mb-1">
            Checklist {checklist.length > 0 && `· ${done}/${checklist.length}`}
          </span>
          <div className="space-y-1 mb-2">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => setChecklist(checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                  className="accent-indigo-500 w-4 h-4"
                />
                <span className={`text-sm flex-1 ${item.done ? 'line-through text-gray-500' : 'text-gray-200'}`}>{item.text}</span>
                <button
                  type="button"
                  onClick={() => setChecklist(checklist.filter((_, j) => j !== i))}
                  className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
              placeholder="Agregar subtarea"
            />
            <Button type="button" variant="ghost" onClick={addItem}><Plus size={15} /></Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
