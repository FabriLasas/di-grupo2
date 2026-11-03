import { Router } from 'express'
import { createOrderSchema } from '@fino/shared'
import { validate } from '../lib/errors.js'
import { requireAuth } from '../auth/middleware.js'
import { createOrder, getOrderFor } from './service.js'
import { ORDER_INCLUDE, toOrderDTO } from './dto.js'

export function orderRoutes(deps) {
  const { prisma } = deps
  const r = Router()
  r.use(requireAuth(deps))

  r.post('/', validate(createOrderSchema), async (req, res) => {
    res.status(201).json(await createOrder(deps, req.user, req.body))
  })

  r.get('/mine', async (req, res) => {
    const list = await prisma.order.findMany({ where: { clienteId: req.user.id }, include: ORDER_INCLUDE, orderBy: { creadoEn: 'desc' }, take: 20 })
    res.json({ orders: list.map(toOrderDTO) })
  })

  r.get('/:id', async (req, res) => {
    res.json({ order: toOrderDTO(await getOrderFor(prisma, req.user, req.params.id)) })
  })

  return r
}
