export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'

export type ProjectPayment = { id: string; amount: number; paid_at: string; note?: string | null }

export type Project = {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  color: string
  url?: string
  stack: string[]
  position_x: number
  position_y: number
  accounts: { id: string; platform: string; username?: string; url?: string }[]
  /** En cuánto se negoció/vendió (null = sin monto acordado) */
  agreed_amount?: number | null
  project_payments?: ProjectPayment[]
}

/** Resumen de dinero de un proyecto (independiente de Finanzas) */
export function moneyOf(p: Pick<Project, 'agreed_amount' | 'project_payments'>) {
  const received = (p.project_payments || []).reduce((s, x) => s + Number(x.amount || 0), 0)
  const agreed = p.agreed_amount ? Number(p.agreed_amount) : null
  const pending = agreed !== null ? Math.max(0, agreed - received) : null
  const pct = agreed ? Math.min(100, Math.round((received / agreed) * 100)) : null
  return { received, agreed, pending, pct }
}

/** Formato compacto: $ 1,2 M · $ 850 mil */
export function compactCOP(n: number) {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (n >= 1_000) return `$ ${Math.round(n / 1_000).toLocaleString('es-CO')} mil`
  return `$ ${Math.round(n).toLocaleString('es-CO')}`
}
