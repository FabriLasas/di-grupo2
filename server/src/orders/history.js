import { TERMINAL_STATES } from '@fino/shared'
import { ORDER_INCLUDE, toOrderDTO } from './dto.js'

export const PAGE_SIZE = 50
const DAY = 24 * 60 * 60 * 1000
const baDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Inicio del día de trabajo (06:00 en Buenos Aires) de una fecha YYYY-MM-DD. */
const dayStart = (ymd) => new Date(`${ymd}T06:00:00-03:00`)
/** Día de trabajo actual: lo que pasa antes de las 06:00 cuenta para la noche anterior. */
export const businessDay = (now) => baDate.format(new Date(now.getTime() - 6 * 3600000))

function whereFor({ q, estado, desde, hasta }, now) {
  const from = desde ?? hasta ?? businessDay(now)
  const to = hasta ?? desde ?? businessDay(now)
  const where = {
    estado: estado ? estado : { in: TERMINAL_STATES },
    creadoEn: { gte: dayStart(from), lt: new Date(dayStart(to).getTime() + DAY) },
  }
  if (q) {
    const onlyNumber = q.startsWith('#')
    const t = q.replace(/^#/, '').trim()
    const or = []
    if (/^\d+$/.test(t)) or.push({ numero: Number(t) })
    if (!onlyNumber) {
      if (/^\d+$/.test(t)) or.push({ cliente: { telefono: { contains: t } } })
      or.push({ cliente: { nombre: { contains: t, mode: 'insensitive' } } })
      or.push({ items: { some: { producto: { nombre: { contains: t, mode: 'insensitive' } } } } })
    }
    where.OR = or.length ? or : [{ id: '__nada__' }]
  }
  return where
}

/** Historial del local con búsqueda, filtros y resumen. */
export async function searchHistory(prisma, query, now) {
  const where = whereFor(query, now)
  const page = query.page ?? 1
  const [rows, total, sum] = await Promise.all([
    prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { creadoEn: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.order.count({ where }),
    !query.estado || query.estado === 'entregado'
      ? prisma.order.aggregate({ where: { ...where, estado: 'entregado' }, _sum: { total: true } })
      : { _sum: { total: 0 } },
  ])
  return { items: rows.map(toOrderDTO), total, page, pageSize: PAGE_SIZE, resumen: { cantidad: total, totalEntregado: sum._sum.total ?? 0 } }
}

/** Detalle para el local: el pedido con su línea de tiempo y notas. */
export async function getStaffOrderDetail(prisma, id) {
  const o = await prisma.order.findUnique({
    where: { id },
    include: { ...ORDER_INCLUDE, eventos: { orderBy: { creadoEn: 'asc' }, include: { actor: true } }, notas: { orderBy: { creadoEn: 'asc' }, include: { autor: true } } },
  })
  if (!o) return null
  return {
    ...toOrderDTO(o),
    eventos: o.eventos.map((e) => ({ tipo: e.tipo, actor: e.actor?.nombre ?? null, detalle: e.detalle, creadoEn: e.creadoEn })),
    notas: o.notas.map((n) => ({ texto: n.texto, autor: n.autor.nombre, creadoEn: n.creadoEn })),
  }
}
