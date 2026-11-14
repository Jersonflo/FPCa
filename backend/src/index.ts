// Servidor local (npm run dev). En Vercel se usa api/index.ts
import { buildApp } from './app'
import { config } from './lib/config'

const app = buildApp()

app.listen({ port: config.port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
