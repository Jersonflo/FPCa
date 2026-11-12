import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'

export async function projectRoutes(app: FastifyInstance) {
  // GET /api/projects — listar todos los proyectos
  app.get('/', async (req, reply) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*, accounts(*)')
      .order('created_at', { ascending: false })

    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  // GET /api/projects/:id — detalle de un proyecto
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase
      .from('projects')
      .select('*, accounts(*)')
      .eq('id', id)
      .single()

    if (error) return reply.status(404).send({ error: 'Project not found' })
    return data
  })

  // POST /api/projects — crear proyecto
  app.post('/', async (req, reply) => {
    const body = req.body as {
      name: string
      description?: string
      status?: string
      color?: string
      url?: string
      stack?: string[]
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: body.name,
        description: body.description,
        status: body.status || 'ACTIVE',
        color: body.color || '#6366f1',
        url: body.url,
        stack: body.stack || [],
      })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // PUT /api/projects/:id — actualizar proyecto
  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>

    const { data, error } = await supabase
      .from('projects')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  // DELETE /api/projects/:id — eliminar proyecto
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // POST /api/projects/:id/accounts — agregar cuenta a proyecto
  app.post('/:id/accounts', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as { platform: string; username?: string; url?: string }

    const { data, error } = await supabase
      .from('accounts')
      .insert({ ...body, project_id: id })
      .select()
      .single()

    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  // DELETE /api/projects/accounts/:accountId — eliminar cuenta
  app.delete('/accounts/:accountId', async (req, reply) => {
    const { accountId } = req.params as { accountId: string }
    const { error } = await supabase.from('accounts').delete().eq('id', accountId)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })
}

