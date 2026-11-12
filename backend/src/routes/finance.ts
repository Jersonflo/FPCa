import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function financeRoutes(app: FastifyInstance) {
  // ─── TARJETAS / CUENTAS ───────────────────────────────────────

  app.get('/cards', async (req, reply) => {
    const { data, error } = await supabase.from('cards').select('*').order('created_at')
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.post('/cards', async (req, reply) => {
    const body = req.body as {
      name: string; bank: string; last_four: string
      type: 'DEBIT' | 'CREDIT'; limit?: number; balance?: number; color?: string
    }
    const { data, error } = await supabase.from('cards').insert(body).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.put('/cards/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase.from('cards').update(req.body as object).eq('id', id).select().single()
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

    let query = supabase.from('transactions').select('*, cards(name, bank, last_four)').order('date', { ascending: false })

    if (month && year) {
      const start = `${year}-${month.padStart(2, '0')}-01`
      const end = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]
      query = query.gte('date', start).lte('date', end)
    }
    if (card_id) query = query.eq('card_id', card_id)

    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.post('/transactions', async (req, reply) => {
    const body = req.body as {
      amount: number; description: string; date: string
      type: 'INCOME' | 'FIXED' | 'VARIABLE' | 'SAVINGS'
      category: string; card_id?: string
    }
    const { data, error } = await supabase.from('transactions').insert(body).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.put('/transactions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase.from('transactions').update(req.body as object).eq('id', id).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.delete('/transactions/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ─── METAS DE AHORRO ─────────────────────────────────────────

  app.get('/goals', async (req, reply) => {
    const { data, error } = await supabase.from('savings_goals').select('*').order('created_at')
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.post('/goals', async (req, reply) => {
    const { data, error } = await supabase.from('savings_goals').insert(req.body as object).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.put('/goals/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase.from('savings_goals').update(req.body as object).eq('id', id).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.delete('/goals/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('savings_goals').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ─── ESTADÍSTICAS MENSUALES ───────────────────────────────────

  app.get('/stats/:year/:month', async (req, reply) => {
    const { year, month } = req.params as { year: string; month: string }
    const start = `${year}-${month.padStart(2, '0')}-01`
    const end = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('transactions')
      .select('amount, type, category')
      .gte('date', start)
      .lte('date', end)

    if (error) return reply.status(500).send({ error: error.message })

    const stats = {
      income: 0, fixed: 0, variable: 0, savings: 0,
      byCategory: {} as Record<string, number>,
    }

    for (const t of data || []) {
      const amount = Number(t.amount)
      if (t.type === 'INCOME') stats.income += amount
      else if (t.type === 'FIXED') stats.fixed += amount
      else if (t.type === 'VARIABLE') stats.variable += amount
      else if (t.type === 'SAVINGS') stats.savings += amount
      stats.byCategory[t.category] = (stats.byCategory[t.category] || 0) + amount
    }

    return {
      ...stats,
      total_expenses: stats.fixed + stats.variable,
      net_balance: stats.income - stats.fixed - stats.variable - stats.savings,
    }
  })
}

