import React, { useState } from 'react'
import { X, Trash2, Plus, ExternalLink } from 'lucide-react'
import { apiFetch } from '../lib/api'

export type Project = {
  id: string
  name: string
  description?: string
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'ARCHIVED'
  color: string
  url?: string
  stack: string[]
  position_x: number
  position_y: number
  accounts: { id: string; platform: string; username?: string; url?: string }[]
}

interface ProjectModalProps {
  project?: Project | null
  onClose: () => void
  onSuccess: () => void
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: '🟢 Activo / Online' },
  { value: 'PAUSED', label: '🟡 Pausado' },
  { value: 'INACTIVE', label: '⚪ Inactivo' },
  { value: 'ARCHIVED', label: '🔴 Archivado' },
]

const POPULAR_STACKS = ['React', 'Next.js', 'Node.js', 'Python', 'FastAPI', 'Supabase', 'PostgreSQL', 'Tailwind', 'Unity', 'Docker']
const POPULAR_PLATFORMS = ['GitHub', 'Vercel', 'Supabase', 'Cloudflare', 'AWS', 'GCP', 'Firebase', 'HuggingFace', 'DockerHub']

export default function ProjectModal({ project, onClose, onSuccess }: ProjectModalProps) {
  const isEditing = Boolean(project?.id)
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [status, setStatus] = useState<Project['status']>(project?.status || 'ACTIVE')
  const [color, setColor] = useState(project?.color || '#6366f1')
  const [url, setUrl] = useState(project?.url || '')
  const [stack, setStack] = useState<string[]>(project?.stack || [])
  const [newTag, setNewTag] = useState('')

  // Cuentas vinculadas
  const [accounts, setAccounts] = useState(project?.accounts || [])
  const [newPlatform, setNewPlatform] = useState('GitHub')
  const [newUsername, setNewUsername] = useState('')
  const [newAccountUrl, setNewAccountUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAddTag = (tagToAdd?: string) => {
    const val = (tagToAdd || newTag).trim()
    if (val && !stack.includes(val)) {
      setStack([...stack, val])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setStack(stack.filter((s) => s !== tag))
  }

  const handleAddAccount = async () => {
    if (!newPlatform) return
    if (project?.id) {
      // Guardar directamente en backend
      try {
        const added = await apiFetch(`/api/projects/${project.id}/accounts`, {
          method: 'POST',
          body: JSON.stringify({
            platform: newPlatform,
            username: newUsername,
            url: newAccountUrl,
          }),
        })
        setAccounts([...accounts, added])
        setNewUsername('')
        setNewAccountUrl('')
      } catch (err) {
        alert('Error al agregar cuenta')
      }
    } else {
      // En memoria mientras se crea el proyecto
      setAccounts([
        ...accounts,
        {
          id: Math.random().toString(),
          platform: newPlatform,
          username: newUsername,
          url: newAccountUrl,
        },
      ])
      setNewUsername('')
      setNewAccountUrl('')
    }
  }

  const handleRemoveAccount = async (accId: string) => {
    if (project?.id) {
      try {
        await apiFetch(`/api/projects/accounts/${accId}`, { method: 'DELETE' })
        setAccounts(accounts.filter((a) => a.id !== accId))
      } catch {
        alert('Error al eliminar cuenta')
      }
    } else {
      setAccounts(accounts.filter((a) => a.id !== accId))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      if (isEditing && project?.id) {
        await apiFetch(`/api/projects/${project.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name,
            description,
            status,
            color,
            url,
            stack,
          }),
        })
      } else {
        const created = await apiFetch('/api/projects', {
          method: 'POST',
          body: JSON.stringify({
            name,
            description,
            status,
            color,
            url,
            stack,
          }),
        })
        // Si había cuentas agregadas antes de crear
        for (const acc of accounts) {
          await apiFetch(`/api/projects/${created.id}/accounts`, {
            method: 'POST',
            body: JSON.stringify({
              platform: acc.platform,
              username: acc.username,
              url: acc.url,
            }),
          })
        }
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!project?.id) return
    if (!confirm(`¿Eliminar el proyecto "${project.name}" y sus conexiones?`)) return
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      onSuccess()
      onClose()
    } catch {
      alert('Error al eliminar proyecto')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? 'Editar Proyecto' : 'Nuevo Proyecto'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nombre del Proyecto *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. SeCBOT / API Microservicio"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descripción</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objetivo o descripción corta del proyecto..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Estado de actividad</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-hidden focus:border-indigo-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Color del Nodo</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">URL de Producción / Repositorio</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mi-proyecto.vercel.app"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Stack Tecnológico */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Stack Tecnológico</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder="Escribe y presiona Enter..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => handleAddTag()}
                className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-white text-sm"
              >
                <Plus size={16} />
              </button>
            </div>
            {/* Quick tags */}
            <div className="flex flex-wrap gap-1 mb-2">
              {POPULAR_STACKS.map((ps) => (
                <button
                  key={ps}
                  type="button"
                  onClick={() => handleAddTag(ps)}
                  className="text-xs bg-gray-800 hover:bg-indigo-950 hover:text-indigo-300 text-gray-400 px-2 py-0.5 rounded transition-colors"
                >
                  +{ps}
                </button>
              ))}
            </div>
            {/* Tags seleccionados */}
            <div className="flex flex-wrap gap-1.5">
              {stack.map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1 text-xs bg-indigo-950/80 border border-indigo-700 text-indigo-300 px-2 py-1 rounded-full"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(s)}
                    className="hover:text-red-400 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Cuentas Vinculadas */}
          <div className="border-t border-gray-800 pt-4">
            <h4 className="text-sm font-medium text-white mb-2">🔗 Cuentas y Servicios vinculados</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <select
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs"
              >
                {POPULAR_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Usuario o Repo"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs"
              />
              <button
                type="button"
                onClick={handleAddAccount}
                className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs py-1.5 font-medium transition-colors"
              >
                <Plus size={14} /> Vincular
              </button>
            </div>

            {/* Lista de cuentas */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-2 bg-gray-800/60 rounded-lg border border-gray-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-indigo-400">{acc.platform}</span>
                    {acc.username && <span className="text-gray-300">@{acc.username}</span>}
                    {acc.url && (
                      <a
                        href={acc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gray-500 hover:text-white"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAccount(acc.id)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="text-gray-500 text-xs italic">No hay cuentas asignadas aún</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between border-t border-gray-800 pt-4 mt-6">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDeleteProject}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-2 rounded-lg transition-colors"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar Proyecto'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
