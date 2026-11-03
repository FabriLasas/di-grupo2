import { PrismaClient } from '@prisma/client'
import { loadConfig } from './config.js'
import { systemClock } from './lib/clock.js'
import { createServer } from './server.js'
import { createFakeGateway } from './payments/fake.js'

const config = loadConfig()
const prisma = new PrismaClient()
const payments = createFakeGateway() // Task 8 reemplaza por Mercado Pago cuando hay MP_ACCESS_TOKEN
const { httpServer } = createServer({ prisma, payments, clock: systemClock, config })

httpServer.listen(config.port, () => console.log(`FINO API en ${config.publicUrl}`))
