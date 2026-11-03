import { HttpError } from '../lib/errors.js'
import { getStoreStatus } from '../store/service.js'
import { priceItems } from './pricing.js'
import { ORDER_INCLUDE, toOrderDTO } from './dto.js'

/**
 * Crea un pedido. Pago en el local → por_aceptar y aviso al local.
 * Mercado Pago → pendiente_pago con preferencia; el local se entera cuando se aprueba el pago.
 * @returns {Promise<{order: object, initPoint?: string}>}
 */
export async function createOrder(deps, user, body) {
  const { prisma, clock, payments, realtime, config } = deps
  const store = await getStoreStatus(prisma, clock)
  if (!store.aceptaPedidos) throw new HttpError(409, 'local_no_disponible', 'Fino no está tomando pedidos en este momento.')

  const { lines, total, unavailable } = await priceItems(prisma, body.items)
  if (unavailable.length) throw new HttpError(422, 'productos_no_disponibles', 'Algunos productos ya no están disponibles.', { productos: unavailable })
  if (body.totalEsperado !== total) throw new HttpError(409, 'total_cambio', 'Los precios cambiaron. Revisá el total antes de confirmar.', { total })
  if (body.metodoPago === 'local' && body.pagaCon != null && body.pagaCon < total) {
    throw new HttpError(400, 'paga_con_insuficiente', 'El monto con el que pagás es menor al total.', { total })
  }

  const now = clock.now()
  const isLocal = body.metodoPago === 'local'
  const created = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        clienteId: user.id,
        estado: isLocal ? 'por_aceptar' : 'pendiente_pago',
        metodoPago: body.metodoPago,
        detallePagoLocal: isLocal ? body.detallePagoLocal : null,
        pagaCon: isLocal && body.detallePagoLocal === 'efectivo' ? body.pagaCon ?? null : null,
        total,
        nota: body.nota || null,
        creadoEn: now,
        items: {
          create: lines.map((l) => ({
            productoId: l.productId, varianteId: l.variantId, cantidad: l.cantidad, precioUnitario: l.precioUnitario,
            aclaracion: l.aclaracion, sinTacc: l.sinTacc, extras: { create: l.extras.map((e) => ({ extraId: e.extraId, precio: e.precio })) },
          })),
        },
        eventos: { create: { tipo: 'creado', actorId: user.id, creadoEn: now } },
      },
    })
    return o
  })

  let initPoint
  if (!isLocal) {
    const full = await prisma.order.findUniqueOrThrow({ where: { id: created.id }, include: ORDER_INCLUDE })
    const pref = await payments.createPreference({
      order: toOrderDTO(full),
      notificationUrl: `${config.publicUrl}/api/payments/webhook`,
      backUrl: `${config.webUrl}/pedido/${created.id}`,
    })
    await prisma.payment.create({ data: { pedidoId: created.id, mpPreferenceId: pref.id, monto: total, estado: 'pendiente' } })
    initPoint = pref.initPoint
  }

  const dto = toOrderDTO(await prisma.order.findUniqueOrThrow({ where: { id: created.id }, include: ORDER_INCLUDE }))
  if (isLocal) realtime.emitOrder(dto, 'order:new')
  return initPoint ? { order: dto, initPoint } : { order: dto }
}

/** Pedido visible para el usuario: el dueño o el personal. 404 si no. */
export async function getOrderFor(prisma, user, id) {
  const o = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  if (!o || (user.rol === 'cliente' && o.clienteId !== user.id)) throw new HttpError(404, 'no_encontrado', 'No encontramos ese pedido.')
  return o
}
