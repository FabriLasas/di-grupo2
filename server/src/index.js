import { PrismaClient } from '@prisma/client'
import { loadConfig } from './config.js'
import { systemClock } from './lib/clock.js'
import { createServer } from './server.js'
import { createFakeGateway } from './payments/fake.js'
import { createMercadoPagoGateway } from './payments/mercadopago.js'
import { reconcilePending } from './payments/reconcile.js'

const config = loadConfig()
const prisma = new PrismaClient()
const payments = config.mpAccessToken
  ? createMercadoPagoGateway({ accessToken: config.mpAccessToken, webhookSecret: config.mpWebhookSecret })
  : createFakeGateway()
if (!config.mpAccessToken) console.warn('Sin MP_ACCESS_TOKEN: se usa un gateway de pagos simulado.')

const deps = { prisma, payments, clock: systemClock, config }
const { httpServer, realtime } = createServer(deps)
setInterval(() => reconcilePending({ ...deps, realtime }).catch((e) => console.error('reconcile:', e)), 5 * 60000)

httpServer.listen(config.port, () => console.log(`FINO API en ${config.publicUrl}`))
