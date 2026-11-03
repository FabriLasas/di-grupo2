import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../lib/errors.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { getStoreStatus } from './service.js'

export function storeRoutes({ prisma, clock }) {
  const r = Router()
  r.get('/', async (_req, res) => res.json(await getStoreStatus(prisma, clock)))
  return r
}

/** PATCH /api/staff/store {pausado} */
export function staffStoreRoutes(deps) {
  const { prisma, clock, realtime } = deps
  const r = Router()
  r.patch('/', requireAuth(deps), requireRole('staff', 'admin'), validate(z.object({ pausado: z.boolean() })), async (req, res) => {
    await prisma.storeSettings.update({ where: { id: 1 }, data: { pausado: req.body.pausado } })
    const status = await getStoreStatus(prisma, clock)
    realtime.emitStore(status)
    res.json(status)
  })
  return r
}
