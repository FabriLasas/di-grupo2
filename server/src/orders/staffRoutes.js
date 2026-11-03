import { Router } from 'express'
import { acceptSchema, rejectSchema, deliverSchema, noteSchema, suggestMinutes } from '@fino/shared'
import { HttpError, validate } from '../lib/errors.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { getStoreStatus } from '../store/service.js'
import { ORDER_INCLUDE, toOrderDTO } from './dto.js'
import { applyEvent } from './service.js'

const units = (dto) => dto.items.reduce((a, i) => a + i.cantidad, 0)

export function staffOrderRoutes(deps) {
  const { prisma, clock } = deps
  const r = Router()
  r.use(requireAuth(deps), requireRole('staff', 'admin'))

  r.get('/', async (_req, res) => {
    const find = (estado, orderBy) => prisma.order.findMany({ where: { estado }, include: ORDER_INCLUDE, orderBy })
    const [nuevos, cocina, listos, store] = await Promise.all([
      find('por_aceptar', { creadoEn: 'asc' }),
      find('en_cocina', { retiroEstimado: 'asc' }),
      find('para_retirar', { listoEn: 'asc' }),
      getStoreStatus(prisma, clock),
    ])
    res.json({
      porAceptar: nuevos.map(toOrderDTO).map((o) => ({ ...o, sugeridoMin: suggestMinutes({ delay: store.demoraMin, units: units(o) }) })),
      enCocina: cocina.map(toOrderDTO),
      paraRetirar: listos.map(toOrderDTO),
      demoraMin: store.demoraMin,
    })
  })

  const act = (evento, pick = () => ({})) => async (req, res) => {
    const order = await applyEvent(deps, { orderId: req.params.id, evento, actor: req.user, data: pick(req.body) })
    res.json({ order })
  }

  r.post('/:id/accept', validate(acceptSchema), act('aceptar', (b) => ({ minutos: b.minutos })))
  r.post('/:id/reject', validate(rejectSchema), act('rechazar', (b) => ({ motivo: b.motivo })))
  r.post('/:id/ready', act('listo'))
  r.post('/:id/not-picked-up', act('no_retirado'))
  r.post('/:id/deliver', validate(deliverSchema), async (req, res, next) => {
    const o = await prisma.order.findUnique({ where: { id: req.params.id }, select: { metodoPago: true } })
    if (!o) throw new HttpError(404, 'no_encontrado', 'No encontramos ese pedido.')
    if (o.metodoPago === 'local' && req.body.cobroConfirmado !== true) {
      throw new HttpError(400, 'cobro_no_confirmado', 'Confirmá que cobraste el pedido antes de entregarlo.')
    }
    return act('entregar', (b) => ({ cobroConfirmado: b.cobroConfirmado }))(req, res, next)
  })

  r.post('/:id/notes', validate(noteSchema), async (req, res) => {
    if (!(await prisma.order.findUnique({ where: { id: req.params.id }, select: { id: true } }))) throw new HttpError(404, 'no_encontrado', 'No encontramos ese pedido.')
    const now = clock.now()
    const [note] = await prisma.$transaction([
      prisma.orderNote.create({ data: { pedidoId: req.params.id, autorId: req.user.id, texto: req.body.texto, creadoEn: now } }),
      prisma.orderEvent.create({ data: { pedidoId: req.params.id, tipo: 'nota', actorId: req.user.id, detalle: { texto: req.body.texto }, creadoEn: now } }),
    ])
    res.status(201).json({ note })
  })

  return r
}
