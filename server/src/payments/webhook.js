import { HttpError } from '../lib/errors.js'
import { applyEvent } from '../orders/service.js'

const MAP = { approved: 'aprobado', rejected: 'rechazado', cancelled: 'rechazado' }
const FINAL = ['devuelto', 'devolucion_pendiente']

/** Registra un pago de MP (idempotente por mpPaymentId) y mueve el pedido si corresponde. */
export async function processPayment(deps, p) {
  const { prisma } = deps
  const order = await prisma.order.findUnique({ where: { id: p.externalReference ?? '' }, include: { payments: true } })
  if (!order) return { handled: false }

  const estado = MAP[p.status] ?? 'pendiente'
  const existing = order.payments.find((x) => x.mpPaymentId === p.id) ?? order.payments.find((x) => !x.mpPaymentId)
  const raw = p.raw ?? { id: p.id, status: p.status, amount: p.amount }
  if (existing) {
    await prisma.payment.update({ where: { id: existing.id }, data: { mpPaymentId: p.id, raw, ...(FINAL.includes(existing.estado) ? {} : { estado }) } })
  } else {
    await prisma.payment.create({ data: { pedidoId: order.id, mpPaymentId: p.id, estado, monto: p.amount, raw } })
  }

  if (order.estado !== 'pendiente_pago') return { handled: true }
  try {
    if (estado === 'aprobado' && p.amount >= order.total) await applyEvent(deps, { orderId: order.id, evento: 'pago_aprobado' })
    else if (estado === 'rechazado') await applyEvent(deps, { orderId: order.id, evento: 'pago_fallido' })
  } catch (err) {
    if (!(err instanceof HttpError && err.status === 409)) throw err // otro proceso ya lo movió
  }
  return { handled: true }
}

/** POST /api/payments/webhook */
export async function handleWebhook(deps, { query, body, headers }) {
  const type = query.type ?? query.topic ?? body?.type
  const dataId = query['data.id'] ?? body?.data?.id ?? query.id
  if (!deps.payments.verifySignature({ xSignature: headers['x-signature'], xRequestId: headers['x-request-id'], dataId })) {
    throw new HttpError(401, 'firma_invalida', 'Firma de Mercado Pago inválida.')
  }
  if (type !== 'payment' || !dataId) return { handled: false }
  return processPayment(deps, await deps.payments.getPayment(String(dataId)))
}
