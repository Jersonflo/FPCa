import { useMemo, useState } from 'react'
import { Trash2, Search, ExternalLink, Check } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { PLATFORMS, platformOf, type PlatformAccount, type ProjectLink } from '../lib/platforms'
import type { Project } from '../lib/projects'
import { Modal, Field, Input, Textarea, Button } from './ui'
import BrandLogo from './BrandLogo'

type Props = {
  account?: PlatformAccount | null
  defaultPlatform?: string
  projects: Project[]
  links: ProjectLink[]
  onClose: () => void
  onSaved: () => void
}

/** Crear / editar una cuenta de plataforma y elegir qué proyectos la usan */
export default function AccountModal({ account, defaultPlatform, projects, links, onClose, onSaved }: Props) {
  const isEditing = Boolean(account?.id)
  const [platform, setPlatform] = useState(account?.platform || defaultPlatform || '')
  const [name, setName] = useState(account?.name || '')
  const [username, setUsername] = useState(account?.username || '')
  const [url, setUrl] = useState(account?.url || '')
  const [notes, setNotes] = useState(account?.notes || '')
  const [query, setQuery] = useState('')
  const [linked, setLinked] = useState<Set<string>>(
    () => new Set(links.filter((l) => l.account_id === account?.id).map((l) => l.project_id))
  )
  const [saving, setSaving] = useState(false)

  const def = platform ? platformOf(platform) : null
  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PLATFORMS.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  }, [query])

  const toggle = (id: string) =>
    setLinked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    if (!platform || !name.trim()) return
    setSaving(true)
    try {
      const body = { platform, name: name.trim(), username: username.trim() || null, url: url.trim() || null, notes: notes.trim() || null }
      const saved: PlatformAccount = isEditing
        ? await apiFetch(`/api/platforms/accounts/${account!.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await apiFetch('/api/platforms/accounts', { method: 'POST', body: JSON.stringify(body) })

      // Sincronizar enlaces con proyectos
      const before = new Set(links.filter((l) => l.account_id === saved.id).map((l) => l.project_id))
      const ops: Promise<unknown>[] = []
      linked.forEach((pid) => {
        if (!before.has(pid)) ops.push(apiFetch('/api/platforms/links', { method: 'POST', body: JSON.stringify({ project_id: pid, account_id: saved.id }) }))
      })
      before.forEach((pid) => {
        if (!linked.has(pid)) ops.push(apiFetch(`/api/platforms/links?project_id=${pid}&account_id=${saved.id}`, { method: 'DELETE' }))
      })
      await Promise.all(ops)
      onSaved()
      onClose()
    } catch (err) {
      alert(`Error al guardar: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!account || !confirm(`¿Eliminar la cuenta "${account.name}"? Se quitan sus conexiones con proyectos.`)) return
    await apiFetch(`/api/platforms/accounts/${account.id}`, { method: 'DELETE' })
    onSaved()
    onClose()
  }

  return (
    <Modal
      wide
      title={
        def ? (
          <span className="flex items-center gap-3">
            <BrandLogo platform={def} size={22} />
            {isEditing ? account!.name : `Nueva cuenta de ${def.name}`}
          </span>
        ) : (
          'Nueva cuenta de plataforma'
        )
      }
      onClose={onClose}
      footer={
        <>
          {isEditing && (
            <Button variant="danger" onClick={remove} className="mr-auto">
              <Trash2 size={14} /> Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !platform || !name.trim()}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </>
      }
    >
      {/* Paso 1: elegir plataforma */}
      {(!isEditing || !platform) && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-medium text-gray-400">Plataforma</span>
            <div className="relative w-48">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" className="!py-1.5 pl-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-56 overflow-y-auto pr-1">
            {options.map((p) => {
              const active = platform === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPlatform(p.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 border transition-all ${
                    active ? 'bg-white/[0.07]' : 'border-transparent hover:bg-white/[0.04]'
                  }`}
                  style={active ? { borderColor: `${p.color}88`, boxShadow: `0 0 20px -8px ${p.color}` } : undefined}
                >
                  <BrandLogo platform={p} size={22} />
                  <span className="text-[10px] text-gray-300 text-center leading-tight">{p.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Nombre de la cuenta" hint="Cómo la reconoces: Personal, Trabajo, Cliente X…">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Personal" />
        </Field>
        <Field label="Usuario, correo u organización">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yo@correo.com" />
        </Field>
      </div>
      <Field label="Link al panel (opcional)">
        <div className="relative">
          <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://supabase.com/dashboard/…" className="pr-9" />
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400">
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </Field>
      <Field label="Notas">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Plan gratis, límite de 2 proyectos, vence en…" />
      </Field>

      {/* Paso 2: qué proyectos usan esta cuenta */}
      <div>
        <span className="block text-xs font-medium text-gray-400 mb-2">Proyectos que usan esta cuenta</span>
        <div className="flex flex-wrap gap-1.5">
          {projects.map((p) => {
            const on = linked.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`inline-flex items-center gap-1.5 text-xs pl-2 pr-3 py-1.5 rounded-full border transition-all ${
                  on ? 'border-gray-600 bg-white/[0.08] text-gray-100' : 'border-gray-800 text-gray-400 hover:text-gray-100'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: on ? def?.color || '#98ffe8' : 'transparent', border: on ? 'none' : '1px solid rgba(186,215,245,0.25)' }}
                >
                  {on && <Check size={10} className="text-[#0b1424]" strokeWidth={3} />}
                </span>
                {p.name}
              </button>
            )
          })}
          {projects.length === 0 && <span className="text-xs text-gray-500">Aún no tienes proyectos.</span>}
        </div>
      </div>
    </Modal>
  )
}
