import { Router } from 'express'
import { HttpError } from '../lib/errors.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { ORDER_INCLUDE, toOrderDTO } from '../orders/dto.js'
import { handleWebhook } from './webhook.js'
import { refundOrder } from './refund.js'

export function paymentRoutes(deps) {
  const r = Router()
  r.post('/webhook', async (req, res) => {
    await handleWebhook(deps, { query: req.query, body: req.body, headers: req.headers })
    res.status(200).json({ ok: true })
  })
  return r
}

/** POST /api/staff/orders/:id/refund */
export function staffRefundRoutes(deps) {
  const { prisma } = deps
  const r = Router()
  r.post('/:id/refund', requireAuth(deps), requireRole('staff', 'admin'), async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: ORDER_INCLUDE })
    if (!order) throw new HttpError(404, 'no_encontrado', 'No encontramos ese pedido.')
    if (!order.payments.some((p) => p.estado === 'aprobado' || p.estado === 'devolucion_pendiente')) {
      throw new HttpError(409, 'sin_pago_aprobado', 'Este pedido no tiene un pago para devolver.')
    }
    const ok = await refundOrder(deps, order)
    const dto = toOrderDTO(await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE }))
    deps.realtime.emitOrder(dto, 'order:updated')
    if (!ok) throw new HttpError(502, 'devolucion_fallida', 'Mercado Pago no respondió. Probá de nuevo en unos minutos.')
    res.json({ order: dto })
  })
  return r
}
