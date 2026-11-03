import { Router } from 'express'
import { registerSchema, loginSchema } from '@fino/shared'
import { HttpError, validate } from '../lib/errors.js'
import { requireAuth } from './middleware.js'
import { publicUser, hashPassword, checkPassword, setSessionCookie, clearSessionCookie } from './service.js'

export function authRoutes(deps) {
  const { prisma, config } = deps
  const r = Router()

  r.post('/register', validate(registerSchema), async (req, res) => {
    const { nombre, email, telefono, password } = req.body
    if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'email_en_uso', 'Ya hay una cuenta con ese email.')
    const user = await prisma.user.create({ data: { nombre, email, telefono, passwordHash: await hashPassword(password), rol: 'cliente' } })
    setSessionCookie(res, user, config)
    res.status(201).json({ user: publicUser(user) })
  })

  r.post('/login', validate(loginSchema), async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } })
    if (!user || !(await checkPassword(req.body.password, user.passwordHash))) {
      throw new HttpError(401, 'credenciales_invalidas', 'Email o contraseña incorrectos.')
    }
    setSessionCookie(res, user, config)
    res.json({ user: publicUser(user) })
  })

  r.post('/logout', (_req, res) => { clearSessionCookie(res, config); res.status(204).end() })

  r.get('/me', requireAuth(deps), (req, res) => res.json({ user: req.user }))

  return r
}
