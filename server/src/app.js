import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { errorHandler, notFound } from './lib/errors.js'
import { authRoutes } from './auth/routes.js'
import { adminRoutes } from './admin/routes.js'

/**
 * @param {{prisma: import('@prisma/client').PrismaClient, payments: object, realtime: {emitOrder: Function, emitStore: Function}, clock: {now: () => Date}, config: ReturnType<import('./config.js').loadConfig>}} deps
 */
export function createApp(deps) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(cors({ origin: [deps.config.webUrl, deps.config.localUrl], credentials: true }))
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  const api = express.Router()
  api.get('/health', (_req, res) => res.json({ ok: true }))
  api.use('/auth', authRoutes(deps))
  api.use('/admin', adminRoutes(deps))
  app.use('/api', api)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
