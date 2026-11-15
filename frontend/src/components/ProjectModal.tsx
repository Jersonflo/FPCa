import { useState } from 'react'
import { Trash2, Plus, ExternalLink, X, Wallet, Link2, Layers, Server, Check } from 'lucide-react'
import { apiFetch, formatCOP, formatDate, toDateKey } from '../lib/api'
import { moneyOf, type Project, type ProjectPayment, type ProjectStatus } from '../lib/projects'
import { Modal, Field, Input, Select, Textarea, Button, MoneyInput, ProgressBar } from './ui'
import { platformOf, type PlatformAccount, type ProjectLink } from '../lib/platforms'
import BrandLogo from './BrandLogo'

export type { Project } from '../lib/projects'

interface ProjectModalProps {
  project?: Project | null
  /** Cuentas de plataformas (si existen las tablas nuevas); si no, se usa la sección antigua */
  platformAccounts?: PlatformAccount[]
  links?: ProjectLink[]
  onClose: () => void
  onSuccess: () => void
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Activo / online' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'COMPLETED', label: 'Terminado' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'ARCHIVED', label: 'Archivado' },
]

const SWATCHES = ['#7fb2ff', '#9aa5f0', '#98ffe8', '#c4a8ff', '#ff7aa8', '#f5c97a', '#6fd3ff', '#bad7f5']
const POPULAR_STACKS = ['React', 'Next.js', 'Node.js', 'Python', 'FastAPI', 'Supabase', 'PostgreSQL', 'Tailwind', 'Unity', 'Docker']
const POPULAR_PLATFORMS = ['GitHub', 'Vercel', 'Supabase', 'Cloudflare', 'AWS', 'GCP', 'Firebase', 'HuggingFace', 'DockerHub']

function Section({ icon: Icon, title, children }: { icon: typeof Wallet; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-800 pt-5 mt-1">
      <h4 className="label-caps flex items-center gap-2 mb-3">
        <Icon size={13} className="text-indigo-400" /> {title}
      </h4>
      {children}
    </section>
  )
}

export default function ProjectModal({ project, platformAccounts, links = [], onClose, onSuccess }: ProjectModalProps) {
  const isEditing = Boolean(project?.id)
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [status, setStatus] = useState<ProjectStatus>(project?.status || 'ACTIVE')
  const [color, setColor] = useState(project?.color || '#7fb2ff')
  const [url, setUrl] = useState(project?.url || '')
  const [stack, setStack] = useState<string[]>(project?.stack || [])
  const [newTag, setNewTag] = useState('')

  // Dinero
  const [agreed, setAgreed] = useState(project?.agreed_amount ? String(Math.round(Number(project.agreed_amount))) : '')
  const [payments, setPayments] = useState<ProjectPayment[]>(project?.project_payments || [])
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(toDateKey(new Date()))
  const [payNote, setPayNote] = useState('')

  // Cuentas
  const [accounts, setAccounts] = useState(project?.accounts || [])
  const [newPlatform, setNewPlatform] = useState('GitHub')
  const [newUsername, setNewUsername] = useState('')
  const [loading, setLoading] = useState(false)

  // Plataformas que usa el proyecto
  const [linkedAccounts, setLinkedAccounts] = useState<Set<string>>(
    () => new Set(links.filter((l) => l.project_id === project?.id).map((l) => l.account_id))
  )
  const toggleAccount = async (accountId: string) => {
    const on = linkedAccounts.has(accountId)
    const next = new Set(linkedAccounts)
    if (on) next.delete(accountId)
    else next.add(accountId)
    setLinkedAccounts(next)
    if (project?.id) {
      try {
        if (on) await apiFetch(`/api/platforms/links?project_id=${project.id}&account_id=${accountId}`, { method: 'DELETE' })
        else await apiFetch('/api/platforms/links', { method: 'POST', body: JSON.stringify({ project_id: project.id, account_id: accountId }) })
        onSuccess()
      } catch (err) {
        alert(`No se pudo actualizar: ${(err as Error).message}`)
      }
    }
  }

  const money = moneyOf({ agreed_amount: Number(agreed) || null, project_payments: payments })

  const addTag = (tag?: string) => {
    const v = (tag || newTag).trim()
    if (v && !stack.includes(v)) setStack([...stack, v])
    setNewTag('')
  }

  // Pagos: si el proyecto ya existe se guardan de inmediato; si es nuevo, al crear el proyecto
  const addPayment = async () => {
    const amount = Number(payAmount)
    if (!(amount > 0)) return
    const draft = { amount, paid_at: payDate, note: payNote.trim() || null }
    try {
      const saved: ProjectPayment = project?.id
        ? await apiFetch(`/api/projects/${project.id}/payments`, { method: 'POST', body: JSON.stringify(draft) })
        : { id: `tmp-${Date.now()}`, ...draft }
      setPayments([...payments, saved].sort((a, b) => b.paid_at.localeCompare(a.paid_at)))
      setPayAmount('')
      setPayNote('')
      if (project?.id) onSuccess()
    } catch (err) {
      alert(`No se pudo registrar el pago: ${(err as Error).message}`)
    }
  }

  const removePayment = async (p: ProjectPayment) => {
    if (!confirm(`¿Eliminar el pago de ${formatCOP(p.amount)}?`)) return
    if (project?.id && !p.id.startsWith('tmp-')) {
      await apiFetch(`/api/projects/payments/${p.id}`, { method: 'DELETE' })
      onSuccess()
    }
    setPayments(payments.filter((x) => x.id !== p.id))
  }

  const addAccount = async () => {
    if (!newPlatform) return
    const draft = { platform: newPlatform, username: newUsername.trim() || undefined }
    try {
      const saved = project?.id
        ? await apiFetch(`/api/projects/${project.id}/accounts`, { method: 'POST', body: JSON.stringify(draft) })
        : { id: `tmp-${Date.now()}`, ...draft }
      setAccounts([...accounts, saved])
      setNewUsername('')
    } catch {
      alert('Error al agregar cuenta')
    }
  }

  const removeAccount = async (accId: string) => {
    if (project?.id && !accId.startsWith('tmp-')) await apiFetch(`/api/projects/accounts/${accId}`, { method: 'DELETE' })
    setAccounts(accounts.filter((a) => a.id !== accId))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const body = { name: name.trim(), description, status, color, url, stack, agreed_amount: Number(agreed) || null }
    try {
      if (isEditing && project?.id) {
        await apiFetch(`/api/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        const created = await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(body) })
        for (const acc of accounts) {
          await apiFetch(`/api/projects/${created.id}/accounts`, {
            method: 'POST',
            body: JSON.stringify({ platform: acc.platform, username: acc.username, url: acc.url }),
          })
        }
        for (const accountId of linkedAccounts) {
          await apiFetch('/api/platforms/links', { method: 'POST', body: JSON.stringify({ project_id: created.id, account_id: accountId }) })
        }
        for (const p of payments) {
          await apiFetch(`/api/projects/${created.id}/payments`, {
            method: 'POST',
            body: JSON.stringify({ amount: p.amount, paid_at: p.paid_at, note: p.note }),
          })
        }
      }
      onSuccess()
      onClose()
    } catch (err) {
      alert(`Error al guardar: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!project?.id || !confirm(`¿Eliminar el proyecto "${project.name}", sus pagos y conexiones?`)) return
    await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onSuccess()
    onClose()
  }

  return (
    <Modal
      wide
      title={isEditing ? project!.name : 'Nuevo proyecto'}
      onClose={onClose}
      footer={
        <>
          {isEditing && (
            <Button variant="danger" onClick={handleDelete} className="mr-auto">
              <Trash2 size={14} /> Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => handleSubmit()} disabled={loading || !name.trim()}>
            {loading ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-[1fr_180px] gap-3">
          <Field label="Nombre">
            <Input autoFocus={!isEditing} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mi app, cliente X…" />
          </Field>
          <Field label="Estado">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Descripción">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="De qué trata, para quién es…" />
        </Field>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="URL (producción o repositorio)">
            <div className="relative">
              <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="pr-9" />
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400">
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </Field>
          <div>
            <span className="block text-xs font-medium text-gray-400 mb-1">Color de la esfera</span>
            <div className="flex items-center gap-1.5 h-[38px]">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-110 ring-2 ring-white/70 ring-offset-2 ring-offset-[#121827]' : 'hover:scale-110'}`}
                  style={{ background: c, boxShadow: `0 0 10px -2px ${c}` }}
                />
              ))}
              <label className="relative w-6 h-6 rounded-full border border-dashed border-gray-600 cursor-pointer overflow-hidden" title="Otro color">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Plus size={12} className="absolute inset-0 m-auto text-gray-500" />
              </label>
            </div>
          </div>
        </div>

        {/* ─── Dinero del proyecto ─── */}
        <Section icon={Wallet} title="Dinero del proyecto">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-4">
            <div className="space-y-3">
              <Field label="Monto negociado (opcional)" hint="Déjalo vacío si no acordaste un precio fijo.">
                <MoneyInput value={agreed} onChange={setAgreed} />
              </Field>
              <div className="rounded-2xl bg-white/[0.03] border border-gray-800 p-3.5">
                <p className="label-caps !text-[9px]">Recibido</p>
                <p className="text-2xl font-light tracking-tight text-gray-100 mt-1">{formatCOP(money.received)}</p>
                {money.agreed !== null ? (
                  <>
                    <div className="mt-3"><ProgressBar value={money.pct || 0} color="#98ffe8" /></div>
                    <div className="flex justify-between text-[11px] mt-1.5">
                      <span className="text-gray-400">{money.pct}% de {formatCOP(money.agreed)}</span>
                      <span className={money.pending ? 'text-[#f5c97a]' : 'text-[#98ffe8]'}>
                        {money.pending ? `Faltan ${formatCOP(money.pending)}` : 'Pagado completo'}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-500 mt-1">{payments.length} pago{payments.length === 1 ? '' : 's'} · sin monto acordado</p>
                )}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-gray-400 mb-1">Registrar pago recibido</span>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <MoneyInput value={payAmount} onChange={setPayAmount} />
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-[150px]" />
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPayment())}
                  placeholder="Nota (anticipo, cuota 2…)"
                />
                <Button type="button" variant="ghost" onClick={addPayment} disabled={!(Number(payAmount) > 0)}>
                  <Plus size={14} /> Agregar
                </Button>
              </div>
              <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto pr-1">
                {payments.map((p) => (
                  <li key={p.id} className="group flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span className="text-gray-400 text-xs shrink-0">{formatDate(p.paid_at, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                      <span className="text-gray-300 truncate text-xs">{p.note}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[#98ffe8]">+{formatCOP(p.amount)}</span>
                      <button type="button" onClick={() => removePayment(p)} className="text-gray-600 hover:text-[#ff8fb1] opacity-0 group-hover:opacity-100" aria-label="Eliminar pago">
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </li>
                ))}
                {payments.length === 0 && <li className="text-xs text-gray-500 px-2">Aún no registras pagos.</li>}
              </ul>
            </div>
          </div>
        </Section>

        {/* ─── Stack ─── */}
        <Section icon={Layers} title="Tecnologías">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {stack.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs border border-gray-700 bg-white/[0.04] text-gray-200 pl-2.5 pr-1.5 py-1 rounded-full">
                {s}
                <button type="button" onClick={() => setStack(stack.filter((x) => x !== s))} className="text-gray-500 hover:text-[#ff8fb1]" aria-label={`Quitar ${s}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {POPULAR_STACKS.filter((s) => !stack.includes(s)).map((s) => (
              <button key={s} type="button" onClick={() => addTag(s)} className="text-xs text-gray-500 hover:text-gray-200 px-2 py-1 rounded-full border border-transparent hover:border-gray-800">
                + {s}
              </button>
            ))}
          </div>
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Otra tecnología y Enter"
          />
        </Section>

        {/* ─── Plataformas (nuevo modelo: cuentas como nodos) ─── */}
        {platformAccounts && (
          <Section icon={Server} title="Plataformas que usa">
            {platformAccounts.length === 0 ? (
              <p className="text-xs text-gray-500">
                Aún no tienes cuentas de plataformas. Créalas con el botón <span className="text-gray-300">Plataforma</span> en la red.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {platformAccounts.map((a) => {
                  const def = platformOf(a.platform)
                  const on = linkedAccounts.has(a.id)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAccount(a.id)}
                      className={`inline-flex items-center gap-2 text-xs pl-1.5 pr-3 py-1.5 rounded-full border transition-all ${
                        on ? 'bg-white/[0.08] text-gray-100' : 'border-gray-800 text-gray-400 hover:text-gray-100'
                      }`}
                      style={on ? { borderColor: `${def.color}77`, boxShadow: `0 0 16px -8px ${def.color}` } : undefined}
                    >
                      <span className="w-6 h-6 rounded-full flex items-center justify-center bg-white/[0.05]">
                        {on ? <Check size={12} style={{ color: def.color }} strokeWidth={3} /> : <BrandLogo platform={def} size={13} />}
                      </span>
                      <span>
                        <span className="text-gray-500">{def.name} · </span>
                        {a.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </Section>
        )}

        {/* ─── Cuentas (modelo antiguo, solo si faltan las tablas nuevas) ─── */}
        {!platformAccounts && (
        <Section icon={Link2} title="Cuentas y servicios">
          <div className="grid grid-cols-[140px_1fr_auto] gap-2">
            <Select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}>
              {POPULAR_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAccount())}
              placeholder="Usuario o repositorio"
            />
            <Button type="button" variant="ghost" onClick={addAccount}><Plus size={14} /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {accounts.map((acc) => (
              <span key={acc.id} className="group inline-flex items-center gap-1.5 text-xs border border-gray-800 bg-white/[0.03] pl-2.5 pr-1.5 py-1 rounded-full">
                <span className="text-indigo-400">{acc.platform}</span>
                {acc.username && <span className="text-gray-400">{acc.username}</span>}
                <button type="button" onClick={() => removeAccount(acc.id)} className="text-gray-600 hover:text-[#ff8fb1]" aria-label="Quitar cuenta">
                  <X size={12} />
                </button>
              </span>
            ))}
            {accounts.length === 0 && <span className="text-xs text-gray-500">Sin cuentas vinculadas.</span>}
          </div>
        </Section>
        )}
      </form>
    </Modal>
  )
}
