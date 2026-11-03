import { Router } from 'express'
import { z } from 'zod'
import { registerSchema } from '@fino/shared'
import { HttpError, validate } from '../lib/errors.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { publicUser, hashPassword } from '../auth/service.js'
import { getStoreStatus } from '../store/service.js'

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM')
const horarioSchema = z.partialRecord(z.enum(['0', '1', '2', '3', '4', '5', '6']), z.array(z.tuple([hhmm, hhmm])).max(4))
const productCreate = z.object({
  categoriaId: z.string().min(1), nombre: z.string().trim().min(1).max(60), descripcion: z.string().trim().max(200).optional(),
  precioBase: z.number().int().nonnegative(), sinTacc: z.boolean().optional(), orden: z.number().int().optional(),
})
const productPatch = z.object({
  nombre: z.string().trim().min(1).max(60).optional(), descripcion: z.string().trim().max(200).nullable().optional(),
  precioBase: z.number().int().nonnegative().optional(), agotado: z.boolean().optional(), activo: z.boolean().optional(), sinTacc: z.boolean().optional(),
})
const variantPatch = z.object({ precio: z.number().int().nonnegative() })
const extraPatch = z.object({ precio: z.number().int().nonnegative().optional(), activo: z.boolean().optional() })
const storePatch = z.object({ abierto: z.boolean().optional(), horario: horarioSchema.optional(), demoraBaseMin: z.number().int().min(0).max(60).optional() })

/** update de Prisma que convierte "registro inexistente" en 404. */
async function updateOr404(fn) {
  try { return await fn() } catch (e) {
    if (e?.code === 'P2025') throw new HttpError(404, 'no_encontrado', 'No existe ese registro.')
    throw e
  }
}

const staffUserSchema = registerSchema.extend({ rol: z.enum(['staff', 'admin']) })

export function adminRoutes(deps) {
  const { prisma } = deps
  const r = Router()
  r.use(requireAuth(deps), requireRole('admin'))

  r.post('/users', validate(staffUserSchema), async (req, res) => {
    const { nombre, email, telefono, password, rol } = req.body
    if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'email_en_uso', 'Ya hay una cuenta con ese email.')
    const user = await prisma.user.create({ data: { nombre, email, telefono, rol, passwordHash: await hashPassword(password) } })
    res.status(201).json({ user: publicUser(user) })
  })

  r.post('/products', validate(productCreate), async (req, res) => {
    if (!(await prisma.category.findUnique({ where: { id: req.body.categoriaId } }))) throw new HttpError(404, 'no_encontrado', 'No existe esa categoría.')
    const product = await prisma.product.create({ data: req.body })
    res.status(201).json({ product })
  })

  r.patch('/products/:id', validate(productPatch), async (req, res) => {
    const product = await updateOr404(() => prisma.product.update({ where: { id: req.params.id }, data: req.body }))
    res.json({ product })
  })

  r.patch('/variants/:id', validate(variantPatch), async (req, res) => {
    const variant = await updateOr404(() => prisma.variant.update({ where: { id: req.params.id }, data: req.body }))
    res.json({ variant })
  })

  r.patch('/extras/:id', validate(extraPatch), async (req, res) => {
    const extra = await updateOr404(() => prisma.extra.update({ where: { id: req.params.id }, data: req.body }))
    res.json({ extra })
  })

  r.patch('/store', validate(storePatch), async (req, res) => {
    await prisma.storeSettings.update({ where: { id: 1 }, data: req.body })
    const status = await getStoreStatus(prisma, deps.clock)
    deps.realtime.emitStore(status)
    res.json(status)
  })

  return r
}
