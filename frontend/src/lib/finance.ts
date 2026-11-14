export type TxType = 'INCOME' | 'FIXED' | 'VARIABLE' | 'SAVINGS'

export type Transaction = {
  id: string
  amount: number
  description: string
  date: string
  type: TxType
  category: string
  card_id?: string | null
  cards?: { name: string; bank: string; last_four: string } | null
}

export type FinanceCard = {
  id: string
  name: string
  bank: string
  last_four: string
  type: 'DEBIT' | 'CREDIT'
  credit_limit?: number | null
  balance: number
  color: string
}

export type Goal = { id: string; name: string; target: number; current: number; deadline?: string | null; color: string }
export type Budget = { id: string; category: string; amount: number }

export type Stats = {
  income: number
  fixed: number
  variable: number
  savings: number
  byCategory: Record<string, number>
  total_expenses: number
  net_balance: number
  savings_rate: number
  rule_50_30_20: { needs: number; wants: number; savings: number }
}

export type TrendPoint = { key: string; year: number; month: number; income: number; expenses: number; savings: number }

export const TX_TYPES: Record<TxType, { label: string; short: string; color: string; sign: '+' | '-' }> = {
  INCOME: { label: 'Ingreso', short: 'Ingreso', color: '#10b981', sign: '+' },
  FIXED: { label: 'Gasto necesario (fijo)', short: 'Necesario', color: '#6366f1', sign: '-' },
  VARIABLE: { label: 'Gasto variable (gustos)', short: 'Gusto', color: '#f59e0b', sign: '-' },
  SAVINGS: { label: 'Ahorro / inversión', short: 'Ahorro', color: '#06b6d4', sign: '-' },
}

export const CATEGORY_SUGGESTIONS: Record<TxType, string[]> = {
  INCOME: ['Salario', 'Freelance', 'Ventas', 'Proyectos', 'Inversiones', 'Otros ingresos'],
  FIXED: ['Arriendo', 'Servicios', 'Internet y celular', 'Mercado', 'Transporte', 'Salud', 'Educación', 'Deudas', 'Suscripciones'],
  VARIABLE: ['Restaurantes', 'Domicilios', 'Entretenimiento', 'Ropa', 'Compras', 'Viajes', 'Regalos', 'Otros'],
  SAVINGS: ['Ahorro', 'Fondo de emergencia', 'Inversión', 'Pensión voluntaria'],
}

export const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316']

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Meses completos entre hoy y la fecha límite (mínimo 1) */
export function monthsUntil(deadline: string) {
  const [y, m] = deadline.split('-').map(Number)
  const now = new Date()
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()))
}
