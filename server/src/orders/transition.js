import { TRANSITIONS } from '@fino/shared'
import { HttpError } from '../lib/errors.js'
import { ORDER_INCLUDE } from './dto.js'

/** Campos que se guardan con cada evento. */
function fieldsFor(evento, { now, actorId, data }) {
  switch (evento) {
    case 'aceptar': return { aceptadoEn: now, aceptadoPorId: actorId, minutosRetiro: data.minutos, retiroEstimado: new Date(now.getTime() + data.minutos * 60000) }
    case 'rechazar': return { motivoRechazo: data.motivo }
    case 'listo': return { listoEn: now }
    case 'entregar': return { entregadoEn: now }
    default: return {}
  }
}

/**
 * Única forma de cambiar Order.estado. El UPDATE condicional por estado evita carreras:
 * si otro proceso ya movió el pedido, count = 0 y se responde 409.
 */
export async function transition(prisma, { orderId, evento, actorId = null, data = {}, now }) {
  const t = TRANSITIONS[evento]
  if (!t) throw new Error(`evento desconocido: ${evento}`)
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, estado: { in: t.from } },
      data: { estado: t.to, ...fieldsFor(evento, { now, actorId, data }) },
    })
    if (count === 0) {
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { estado: true } })
      if (!current) throw new HttpError(404, 'no_encontrado', 'No encontramos ese pedido.')
      throw new HttpError(409, 'transicion_invalida', 'El pedido ya cambió de estado.', { estadoActual: current.estado })
    }
    await tx.orderEvent.create({ data: { pedidoId: orderId, tipo: evento, actorId, detalle: Object.keys(data).length ? data : undefined, creadoEn: now } })
    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE })
  })
}
