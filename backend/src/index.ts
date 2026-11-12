import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import dotenv from 'dotenv'

import { projectRoutes } from './routes/projects'
import { calendarRoutes } from './routes/calendar'
import { financeRoutes } from './routes/finance'
import { authRoutes } from './routes/auth'

dotenv.config()

const app = Fastify({ logger: true })

// Plugins
app.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
})

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'secret',
})

// Routes
app.register(authRoutes, { prefix: '/auth' })
app.register(projectRoutes, { prefix: '/api/projects' })
app.register(calendarRoutes, { prefix: '/api/calendar' })
app.register(financeRoutes, { prefix: '/api/finance' })

// Health check
app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }))

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
    console.log(`🚀 Server running on port ${process.env.PORT || 3001}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

