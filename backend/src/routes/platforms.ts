import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { pick } from '../lib/config'

const ACCOUNT_FIELDS = ['platform', 'name', 'username', 'url', 'notes', 'position_x', 'position_y'] as const

/** Clave de plataforma normalizada: "GitHub Pages" → "github-pages" */
const platformKey = (v: unknown) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40)

/** Datos de la capa de plataformas para la red (si faltan las tablas, devuelve vacío) */
export async function loadPlatformLayer() {
  const [accounts, links, hubs] = await Promise.all([
    supabase.from('platform_accounts').select('*').order('created_at'),
    supabase.from('project_platform_links').select('project_id, account_id'),
    supabase.from('platform_hubs').select('*'),
  ])
  return {
    accounts: accounts.error ? [] : accounts.data || [],
    links: links.error ? [] : links.data || [],
    hubs: hubs.error ? [] : hubs.data || [],
    platformsReady: !accounts.error,
  }
}

export async function platformRoutes(app: FastifyInstance) {
  app.get('/', async () => loadPlatformLayer())

  // ─── Cuentas ──────────────────────────────────────────────────
  app.post('/accounts', async (req, reply) => {
    const body = pick(req.body, ACCOUNT_FIELDS)
    body.platform = platformKey(body.platform)
    if (!body.platform || !String(body.name || '').trim()) {
      return reply.status(400).send({ error: 'platform y name son requeridos' })
    }
    const { data, error } = await supabase.from('platform_accounts').insert(body).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send(data)
  })

  app.put('/accounts/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = pick(req.body, ACCOUNT_FIELDS)
    if ('platform' in body) body.platform = platformKey(body.platform)
    const { data, error } = await supabase.from('platform_accounts').update(body).eq('id', id).select().single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  app.delete('/accounts/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('platform_accounts').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })

  // ─── Posición del nodo de cada plataforma ─────────────────────
  app.put('/hubs/:platform', async (req, reply) => {
    const { platform } = req.params as { platform: string }
    const { position_x, position_y } = req.body as { position_x?: number; position_y?: number }
    if (!Number.isFinite(Number(position_x)) || !Number.isFinite(Number(position_y))) {
      return reply.status(400).send({ error: 'position_x y position_y son requeridos' })
    }
    const { data, error } = await supabase
      .from('platform_hubs')
      .upsert({ platform: platformKey(platform), position_x: Number(position_x), position_y: Number(position_y) })
      .select()
      .single()
    if (error) return reply.status(500).send({ error: error.message })
    return data
  })

  // ─── Enlaces proyecto ↔ cuenta ────────────────────────────────
  app.post('/links', async (req, reply) => {
    const { project_id, account_id } = req.body as { project_id?: string; account_id?: string }
    if (!project_id || !account_id) return reply.status(400).send({ error: 'project_id y account_id son requeridos' })
    const { error } = await supabase
      .from('project_platform_links')
      .upsert({ project_id, account_id }, { onConflict: 'project_id,account_id', ignoreDuplicates: true })
    if (error) return reply.status(500).send({ error: error.message })
    return reply.status(201).send({ project_id, account_id })
  })

  app.delete('/links', async (req, reply) => {
    const { project_id, account_id } = req.query as { project_id?: string; account_id?: string }
    if (!project_id || !account_id) return reply.status(400).send({ error: 'project_id y account_id son requeridos' })
    const { error } = await supabase
      .from('project_platform_links')
      .delete()
      .eq('project_id', project_id)
      .eq('account_id', account_id)
    if (error) return reply.status(500).send({ error: error.message })
    return { success: true }
  })
}
