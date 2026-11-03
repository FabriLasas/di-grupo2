/**
 * Devuelve el pago aprobado (o con devolución pendiente) de un pedido. Nunca lanza:
 * si Mercado Pago falla, el pago queda "devolucion_pendiente" para reintentar desde el historial.
 * @returns {Promise<boolean>} true si se devolvió
 */
export async function refundOrder(deps, order) {
  const { prisma, payments, clock } = deps
  const pay = order.payments.find((p) => p.estado === 'aprobado' || p.estado === 'devolucion_pendiente')
  if (!pay?.mpPaymentId) return false
  try {
    await payments.refund(pay.mpPaymentId)
    await prisma.$transaction([
      prisma.payment.update({ where: { id: pay.id }, data: { estado: 'devuelto' } }),
      prisma.orderEvent.create({ data: { pedidoId: order.id, tipo: 'devolucion', detalle: { monto: pay.monto }, creadoEn: clock.now() } }),
    ])
    return true
  } catch (err) {
    console.error(`No se pudo devolver el pago ${pay.mpPaymentId}:`, err.message)
    await prisma.payment.update({ where: { id: pay.id }, data: { estado: 'devolucion_pendiente' } })
    return false
  }
}
