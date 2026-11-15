import Fastify, { FastifyError } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'

import { config, isAllowedEmail } from './lib/config'
import { GoogleReauthError } from './lib/google'
import { authRoutes } from './routes/auth'
import { projectRoutes } from './routes/projects'
import { calendarRoutes } from './routes/calendar'
import { financeRoutes } from './routes/finance'
import { taskRoutes } from './routes/tasks'
import { platformRoutes } from './routes/platforms'

export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(cors, {
    origin: config.frontendUrls,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  app.register(jwt, { secret: config.jwtSecret })

  // Todas las rutas /api/* requieren un JWT válido de un correo autorizado
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.method === 'OPTIONS') return
    try {
      await req.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const user = req.user as { email?: string; kind?: string }
    if (user.kind || !isAllowedEmail(user.email)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  })

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const anyErr = err as FastifyError & { response?: { data?: { error?: string } } }
    const googleError = anyErr.response?.data?.error
    if (err instanceof GoogleReauthError || googleError === 'invalid_grant') {
      return reply.status(401).send({ error: 'Google session expired', code: 'GOOGLE_REAUTH' })
    }
    req.log.error(err)
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500
    return reply.status(status).send({ error: status === 500 ? 'Error interno' : err.message })
  })

  app.register(authRoutes, { prefix: '/auth' })
  app.register(projectRoutes, { prefix: '/api/projects' })
  app.register(calendarRoutes, { prefix: '/api/calendar' })
  app.register(financeRoutes, { prefix: '/api/finance' })
  app.register(taskRoutes, { prefix: '/api/tasks' })
  app.register(platformRoutes, { prefix: '/api/platforms' })

  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }))

  return app
}
