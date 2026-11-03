import { Router } from 'express'
import { z } from 'zod'
import { registerSchema } from '@fino/shared'
import { HttpError, validate } from '../lib/errors.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { publicUser, hashPassword } from '../auth/service.js'

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

  return r
}
