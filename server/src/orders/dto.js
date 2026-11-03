import { formatOrderNumber } from '@fino/shared'

export const ORDER_INCLUDE = {
  cliente: true,
  items: { include: { producto: true, variante: true, extras: { include: { extra: true } } } },
  payments: { orderBy: { creadoEn: 'desc' } },
}

/** Forma pública de un pedido (cliente y local). */
export function toOrderDTO(o) {
  const pay = o.payments?.[0]
  return {
    id: o.id,
    numero: o.numero,
    numeroLabel: formatOrderNumber(o.numero),
    estado: o.estado,
    cliente: { nombre: o.cliente.nombre, telefono: o.cliente.telefono },
    metodoPago: o.metodoPago,
    detallePagoLocal: o.detallePagoLocal,
    pagaCon: o.pagaCon,
    vuelto: o.pagaCon != null ? o.pagaCon - o.total : null,
    total: o.total,
    nota: o.nota,
    minutosRetiro: o.minutosRetiro,
    retiroEstimado: o.retiroEstimado,
    motivoRechazo: o.motivoRechazo,
    creadoEn: o.creadoEn,
    aceptadoEn: o.aceptadoEn,
    listoEn: o.listoEn,
    entregadoEn: o.entregadoEn,
    items: o.items.map((i) => ({
      cantidad: i.cantidad,
      producto: i.producto.nombre,
      variante: i.variante?.nombre ?? null,
      aclaracion: i.aclaracion,
      sinTacc: i.sinTacc,
      extras: i.extras.map((e) => e.extra.nombre),
      precioUnitario: i.precioUnitario,
      subtotal: i.precioUnitario * i.cantidad,
    })),
    pago: pay ? { estado: pay.estado, mpPaymentId: pay.mpPaymentId } : null,
  }
}
