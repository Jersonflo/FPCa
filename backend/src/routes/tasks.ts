import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { pick } from '../lib/config'

const TASK_FIELDS = [
  'title', 'description', 'status', 'priority', 'due_date',
  'project_id', 'labels', 'checklist', 'position',
] as const

const STATUSES = ['BACKLOG', 'TODO', 'DOING', 'DONE']

/** completed_at se llena/limpia automáticamente según el estado */
function withCompletion(body: Record<string, unknown>) {
  if (typeof body.status === 'string') {
    body.completed_at = body.status === 'DONE' ? new Date().toISOString() : null
  }
  if (body.due_date === '') body.due_date = null
  if (body.project_id === '') body.project_id = null
  return body
}

export async function taskRoutes(app: FastifyInstance) {
  // GET /api/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD  (filtra por fecha límite si se envía)
  app.get('/', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string }
    let query = supabase
      .from('tasks')
      .select('*, projects(id, name, color)')
      .order('position', { ascending: true })
    if (from) query = query.gte('due_date', from)
    if (to) query = query.lte('due_date', to)
    const { data, error } = await query
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.post('/', async (req, reply) => {
    const body = withCompletion(pick(req.body, TASK_FIELDS))
    if (!body.title) return reply.status(400).send({ error: 'title es requerido' })
    if (body.status && !STATUSES.includes(body.status as string)) {
      return reply.status(400).send({ error: 'status inválido' })
    }
    if (body.position === undefined) {
      // Al final de su columna
      const { data: last } = await supabase
        .from('tasks')
        .select('position')
        .eq('status', body.status || 'TODO')
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      body.position = (last?.position ?? 0) + 1000
    }
    const { data, error } = await supabase.from('tasks').insert(body).select('*, projects(id, name, color)').single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = pick(req.body, TASK_FIELDS)
    // Solo tocar completed_at si el estado realmente cambia
    if (typeof body.status === 'string') {
      const { data: current } = await supabase.from('tasks').select('status').eq('id', id).maybeSingle()
      if (current?.status !== body.status) withCompletion(body)
    }
    if (body.due_date === '') body.due_date = null
    if (body.project_id === '') body.project_id = null
    const { data, error } = await supabase
      .from('tasks')
      .update(body)
      .eq('id', id)
      .select('*, projects(id, name, color)')
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // Borrar todas las tareas terminadas
  app.delete('/done', async (_req, reply) => {
    const { error } = await supabase.from('tasks').delete().eq('status', 'DONE')
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })
}
