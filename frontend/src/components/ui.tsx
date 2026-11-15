import { useEffect, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X } from 'lucide-react'

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-[#02040d]/70 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`glass w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col animate-modal-in`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-xl font-light tracking-tight text-gray-100 leading-none">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-800 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  )
}

const fieldCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-hidden focus:border-indigo-400 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.15)] transition-shadow'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-400 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    </label>
  )
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldCls} ${p.className || ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldCls} ${p.className || ''}`} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={`${fieldCls} resize-y ${p.className || ''}`} />
)

export function Button({
  variant = 'primary',
  className = '',
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    ghost: 'bg-white/[0.04] hover:bg-white/[0.08] border border-gray-800 text-gray-200',
    danger: 'bg-[#e0457b]/10 hover:bg-[#e0457b]/20 text-[#ff8fb1]',
  }[variant]
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    />
  )
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-gray-900 border border-gray-800 rounded-2xl p-4 glow-hover ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 gap-2">
          <h3 className="label-caps">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function ProgressBar({ value, color = '#6366f1', over }: { value: number; color?: string; over?: boolean }) {
  return (
    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: over ? 'linear-gradient(90deg, #e0457b, #ff7aa8)' : `linear-gradient(90deg, ${color}55, ${color})`,
          boxShadow: `0 0 10px -3px ${over ? '#ff5c8a' : color}`,
        }}
      />
    </div>
  )
}

/** Input de dinero: muestra separadores de miles mientras escribes */
export function MoneyInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const shown = value ? Number(value).toLocaleString('es-CO') : ''
  return (
    <Input
      autoFocus={autoFocus}
      inputMode="numeric"
      value={shown}
      placeholder="0"
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
    />
  )
}
