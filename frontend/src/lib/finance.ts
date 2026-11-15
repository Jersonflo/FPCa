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
  /** Gastos/ahorro pagados con tarjeta de crédito (no salen del disponible) */
  credit_spent?: number
  /** Ingresos registrados en una tarjeta de crédito = pagos a la tarjeta */
  card_payments?: number
  net_balance: number
  savings_rate: number
  rule_50_30_20: { needs: number; wants: number; savings: number }
}

export type TrendPoint = { key: string; year: number; month: number; income: number; expenses: number; savings: number }

export const TX_TYPES: Record<TxType, { label: string; short: string; color: string; sign: '+' | '-' }> = {
  INCOME: { label: 'Ingreso', short: 'Ingreso', color: '#98ffe8', sign: '+' },
  FIXED: { label: 'Gasto necesario (fijo)', short: 'Necesario', color: '#7fb2ff', sign: '-' },
  VARIABLE: { label: 'Gasto variable (gustos)', short: 'Gusto', color: '#f5c97a', sign: '-' },
  SAVINGS: { label: 'Ahorro / inversión', short: 'Ahorro', color: '#9aa5f0', sign: '-' },
}

export const CATEGORY_SUGGESTIONS: Record<TxType, string[]> = {
  INCOME: ['Salario', 'Freelance', 'Ventas', 'Proyectos', 'Inversiones', 'Otros ingresos'],
  FIXED: ['Arriendo', 'Servicios', 'Internet y celular', 'Mercado', 'Transporte', 'Salud', 'Educación', 'Deudas', 'Suscripciones'],
  VARIABLE: ['Restaurantes', 'Domicilios', 'Entretenimiento', 'Ropa', 'Compras', 'Viajes', 'Regalos', 'Otros'],
  SAVINGS: ['Ahorro', 'Fondo de emergencia', 'Inversión', 'Pensión voluntaria'],
}

export const CHART_COLORS = ['#7fb2ff', '#9aa5f0', '#98ffe8', '#ff7aa8', '#f5c97a', '#bad7f5', '#c4a8ff', '#6fd3ff', '#ffb38a']

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Meses completos entre hoy y la fecha límite (mínimo 1) */
export function monthsUntil(deadline: string) {
  const [y, m] = deadline.split('-').map(Number)
  const now = new Date()
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()))
}
