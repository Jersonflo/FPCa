import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { pick } from '../lib/config'

const PROJECT_FIELDS = ['name', 'description', 'status', 'color', 'url', 'stack', 'position_x', 'position_y'] as const
const ACCOUNT_FIELDS = ['platform', 'username', 'url'] as const

export async function projectRoutes(app: FastifyInstance) {
  // GET /api/projects — proyectos + conexiones del grafo
  app.get('/', async (_req, reply) => {
    const [projects, connections] = await Promise.all([
      supabase.from('projects').select('*, accounts(*)').order('created_at', { ascending: false }),
      supabase.from('project_connections').select('*'),
    ])
    if (projects.error) return reply.status(500).send({ error: projects.error.message })
    return { projects: projects.data || [], connections: connections.data || [] }
  })

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase.from('projects').select('*, accounts(*)').eq('id', id).single()
    if (error) return reply.status(404).send({ error: 'Project not found' })
    return data
  })

  app.post('/', async (req, reply) => {
    const body = pick(req.body, PROJECT_FIELDS)
    if (!body.name) return reply.status(400).send({ error: 'name es requerido' })
    const { data, error } = await supabase
      .from('projects')
      .insert({ status: 'ACTIVE', color: '#6366f1', stack: [], ...body })
      .select()
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase
      .from('projects')
      .update(pick(req.body, PROJECT_FIELDS))
      .eq('id', id)
      .select()
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ─── Cuentas vinculadas ───────────────────────────────────────
  app.post('/:id/accounts', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = pick(req.body, ACCOUNT_FIELDS)
    if (!body.platform) return reply.status(400).send({ error: 'platform es requerido' })
    const { data, error } = await supabase.from('accounts').insert({ ...body, project_id: id }).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.delete('/accounts/:accountId', async (req, reply) => {
    const { accountId } = req.params as { accountId: string }
    const { error } = await supabase.from('accounts').delete().eq('id', accountId)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ─── Conexiones entre nodos ───────────────────────────────────
  app.post('/connections', async (req, reply) => {
    const body = pick(req.body, ['source_id', 'target_id', 'label'] as const)
    if (!body.source_id || !body.target_id) return reply.status(400).send({ error: 'source_id y target_id son requeridos' })
    const { data, error } = await supabase
      .from('project_connections')
      .upsert(body, { onConflict: 'source_id,target_id' })
      .select()
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.delete('/connections', async (req, reply) => {
    const { source_id, target_id } = req.query as { source_id?: string; target_id?: string }
    if (!source_id || !target_id) return reply.status(400).send({ error: 'source_id y target_id son requeridos' })
    const { error } = await supabase
      .from('project_connections')
      .delete()
      .eq('source_id', source_id)
      .eq('target_id', target_id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })
}
