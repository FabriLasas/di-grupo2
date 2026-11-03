import { processPayment } from './webhook.js'
import { applyEvent } from '../orders/service.js'

const MIN = 60000

/** Busca en MP los pedidos pendientes de pago con más de 2 min; cancela los que pasan 30 min sin pago. */
export async function reconcilePending(deps) {
  const now = deps.clock.now().getTime()
  const pending = await deps.prisma.order.findMany({ where: { estado: 'pendiente_pago', creadoEn: { lt: new Date(now - 2 * MIN) } }, select: { id: true, creadoEn: true } })
  for (const o of pending) {
    try {
      const p = await deps.payments.searchByReference(o.id)
      if (p) { await processPayment(deps, p); continue }
      if (o.creadoEn.getTime() < now - 30 * MIN) await applyEvent(deps, { orderId: o.id, evento: 'pago_fallido' })
    } catch (err) {
      console.error(`reconcile ${o.id}:`, err.message)
    }
  }
}
