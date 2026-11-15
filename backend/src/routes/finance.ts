import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { pick } from '../lib/config'

const CARD_FIELDS = ['name', 'bank', 'last_four', 'type', 'credit_limit', 'balance', 'color'] as const
const TX_FIELDS = ['amount', 'description', 'date', 'type', 'category', 'card_id'] as const
const GOAL_FIELDS = ['name', 'target', 'current', 'deadline', 'color'] as const
const TX_TYPES = ['INCOME', 'FIXED', 'VARIABLE', 'SAVINGS']

const pad = (n: number) => String(n).padStart(2, '0')

/** Primer y último día del mes como YYYY-MM-DD (sin problemas de zona horaria) */
function monthRange(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` }
}

function validMonth(year: number, month: number) {
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12 && year > 1900
}

function cleanTx(body: Record<string, unknown>) {
  if (body.card_id === '') body.card_id = null
  if (body.amount !== undefined) body.amount = Math.abs(Number(body.amount))
  return body
}

type TxLike = { amount?: unknown; type?: unknown; card_id?: unknown } | null | undefined

/**
 * Efecto de un movimiento sobre el saldo de su cuenta.
 * - Débito/ahorro: ingreso suma, gasto o ahorro resta.
 * - Crédito (el saldo es deuda): gasto suma deuda, ingreso (pago) la reduce.
 */
function txEffect(tx: TxLike, cardType: string) {
  const amount = Math.abs(Number(tx?.amount) || 0)
  const signed = tx?.type === 'INCOME' ? amount : -amount
  return cardType === 'CREDIT' ? -signed : signed
}

/** Revierte el efecto de `before` y aplica el de `after` en las cuentas afectadas. */
async function syncCardBalances(before: TxLike, after: TxLike) {
  const ids = new Set([before?.card_id, after?.card_id].filter(Boolean) as string[])
  if (!ids.size) return
  const { data: cards } = await supabase.from('cards').select('id, type, balance').in('id', [...ids])
  for (const card of cards || []) {
    let delta = 0
    if (before?.card_id === card.id) delta -= txEffect(before, card.type)
    if (after?.card_id === card.id) delta += txEffect(after, card.type)
    if (!delta) continue
    const balance = Math.round((Number(card.balance || 0) + delta) * 100) / 100
    await supabase.from('cards').update({ balance }).eq('id', card.id)
  }
}

export async function financeRoutes(app: FastifyInstance) {
  // ─── TARJETAS / CUENTAS ───────────────────────────────────────
  app.get('/cards', async (_req, reply) => {
    const { data, error } = await supabase.from('cards').select('*').order('created_at')
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.post('/cards', async (req, reply) => {
    const body = pick(req.body, CARD_FIELDS)
    if (!body.name || !body.bank) return reply.status(400).send({ error: 'name y bank son requeridos' })
    const { data, error } = await supabase.from('cards').insert({ last_four: '', ...body }).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.put('/cards/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase.from('cards').update(pick(req.body, CARD_FIELDS)).eq('id', id).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.delete('/cards/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ─── TRANSACCIONES ────────────────────────────────────────────
  app.get('/transactions', async (req, reply) => {
    const { month, year, card_id } = req.query as { month?: string; year?: string; card_id?: string }
    let query = supabase
      .from('transactions')
      .select('*, cards(name, bank, last_four)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (month && year) {
      const { start, end } = monthRange(Number(year), Number(month))
      query = query.gte('date', start).lte('date', end)
    }
    if (card_id) query = query.eq('card_id', card_id)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.post('/transactions', async (req, reply) => {
    const body = cleanTx(pick(req.body, TX_FIELDS))
    if (!body.amount || !body.description || !body.category || !TX_TYPES.includes(body.type as string)) {
      return reply.status(400).send({ error: 'amount, description, category y type válidos son requeridos' })
    }
    const { data, error } = await supabase.from('transactions').insert(body).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    await syncCardBalances(null, data)
    return reply.status(201).send(data)
  })

  app.put('/transactions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data: before } = await supabase.from('transactions').select('amount, type, card_id').eq('id', id).single()
    const { data, error } = await supabase
      .from('transactions')
      .update(cleanTx(pick(req.body, TX_FIELDS)))
      .eq('id', id)
      .select()
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    await syncCardBalances(before, data)
    return data
  })

  app.delete('/transactions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data: before } = await supabase.from('transactions').select('amount, type, card_id').eq('id', id).single()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    await syncCardBalances(before, null)
    return { success: true }
  })

  // ─── METAS DE AHORRO ─────────────────────────────────────────
  app.get('/goals', async (_req, reply) => {
    const { data, error } = await supabase.from('savings_goals').select('*').order('created_at')
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.post('/goals', async (req, reply) => {
    const body = pick(req.body, GOAL_FIELDS)
    if (!body.name || !body.target) return reply.status(400).send({ error: 'name y target son requeridos' })
    if (body.deadline === '') body.deadline = null
    const { data, error } = await supabase.from('savings_goals').insert(body).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.put('/goals/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = pick(req.body, GOAL_FIELDS)
    if (body.deadline === '') body.deadline = null
    const { data, error } = await supabase.from('savings_goals').update(body).eq('id', id).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.delete('/goals/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('savings_goals').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // Aportar (o retirar, con monto negativo) a una meta.
  // Si record=true, también registra la transacción de ahorro del mes.
  app.post('/goals/:id/contribute', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { amount, record = true, card_id } = req.body as { amount: number; record?: boolean; card_id?: string }
    const value = Number(amount)
    if (!value) return reply.status(400).send({ error: 'amount es requerido' })

    const { data: goal, error: gErr } = await supabase.from('savings_goals').select('*').eq('id', id).single()
    if (gErr || !goal) return reply.status(404).send({ error: 'Meta no encontrada' })

    const current = Math.max(0, Number(goal.current) + value)
    const { data, error } = await supabase.from('savings_goals').update({ current }).eq('id', id).select().single()
    if (error) return reply.status(500).send({ error: error.message })

    if (record && value > 0) {
      const { data: tx } = await supabase
        .from('transactions')
        .insert({
          amount: value,
          description: `Aporte a meta: ${goal.name}`,
          type: 'SAVINGS',
          category: 'Ahorro',
          card_id: card_id || null,
        })
        .select()
        .single()
      await syncCardBalances(null, tx)
    }
    return data
  })

  // ─── PRESUPUESTOS POR CATEGORÍA ───────────────────────────────
  app.get('/budgets', async (_req, reply) => {
    const { data, error } = await supabase.from('budgets').select('*').order('category')
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  // Crea o actualiza el presupuesto mensual de una categoría
  app.put('/budgets', async (req, reply) => {
    const { category, amount } = req.body as { category?: string; amount?: number }
    if (!category?.trim() || !(Number(amount) > 0)) {
      return reply.status(400).send({ error: 'category y amount (> 0) son requeridos' })
    }
    const { data, error } = await supabase
      .from('budgets')
      .upsert({ category: category.trim(), amount: Number(amount) }, { onConflict: 'category' })
      .select()
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.delete('/budgets/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ─── ESTADÍSTICAS MENSUALES ───────────────────────────────────
  app.get('/stats/:year/:month', async (req, reply) => {
    const { year, month } = req.params as { year: string; month: string }
    if (!validMonth(Number(year), Number(month))) return reply.status(400).send({ error: 'Fecha inválida' })
    const { start, end } = monthRange(Number(year), Number(month))

    const { data, error } = await supabase
      .from('transactions')
      .select('amount, type, category')
      .gte('date', start)
      .lte('date', end)
    if (error) return reply.status(500).send({ error: error.message })

    let income = 0, fixed = 0, variable = 0, savings = 0
    const byCategory: Record<string, number> = {} // solo gastos (fijos + variables)

    for (const t of data || []) {
      const amount = Number(t.amount)
      if (t.type === 'INCOME') income += amount
      else if (t.type === 'SAVINGS') savings += amount
      else {
        if (t.type === 'FIXED') fixed += amount
        else variable += amount
        byCategory[t.category] = (byCategory[t.category] || 0) + amount
      }
    }

    const totalExpenses = fixed + variable
    const pct = (v: number) => (income > 0 ? Math.round((v / income) * 1000) / 10 : 0)

    return {
      income,
      fixed,
      variable,
      savings,
      byCategory,
      total_expenses: totalExpenses,
      // Lo que queda libre después de gastos y ahorro
      net_balance: income - totalExpenses - savings,
      savings_rate: pct(savings),
      // Regla 50/30/20: necesidades (fijos) / deseos (variables) / ahorro
      rule_50_30_20: { needs: pct(fixed), wants: pct(variable), savings: pct(savings) },
    }
  })

  // Tendencia de los últimos N meses (ingresos vs gastos vs ahorro)
  app.get('/trend', async (req, reply) => {
    const q = req.query as { months?: string; year?: string; month?: string }
    const months = Math.min(24, Math.max(1, Number(q.months) || 6))
    const now = new Date()
    const endYear = Number(q.year) || now.getFullYear()
    const endMonth = Number(q.month) || now.getMonth() + 1
    if (!validMonth(endYear, endMonth)) return reply.status(400).send({ error: 'Fecha inválida' })

    const buckets: { key: string; year: number; month: number; income: number; expenses: number; savings: number }[] = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(endYear, endMonth - 1 - i, 1))
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1
      buckets.push({ key: `${y}-${pad(m)}`, year: y, month: m, income: 0, expenses: 0, savings: 0 })
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('amount, type, date')
      .gte('date', `${buckets[0].key}-01`)
      .lte('date', monthRange(endYear, endMonth).end)
    if (error) return reply.status(500).send({ error: error.message })

    const byKey = new Map(buckets.map((b) => [b.key, b]))
    for (const t of data || []) {
      const b = byKey.get(String(t.date).slice(0, 7))
      if (!b) continue
      const amount = Number(t.amount)
      if (t.type === 'INCOME') b.income += amount
      else if (t.type === 'SAVINGS') b.savings += amount
      else b.expenses += amount
    }
    return buckets
  })
}
