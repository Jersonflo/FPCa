// Punto de entrada para Vercel (función serverless).
// vercel.json redirige todas las rutas aquí y Fastify se encarga del resto.
import type { IncomingMessage, ServerResponse } from 'http'
import { buildApp } from '../src/app'

const app = buildApp()

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await app.ready()
  app.server.emit('request', req, res)
}
