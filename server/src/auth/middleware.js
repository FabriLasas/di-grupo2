import { HttpError } from '../lib/errors.js'
import { COOKIE, verifySession } from './service.js'

/** Carga req.user desde la cookie. 401 si no hay sesión o el usuario ya no existe. */
export function requireAuth({ prisma, config }) {
  return async (req, _res, next) => {
    const claims = verifySession(req.cookies?.[COOKIE], config.jwtSecret)
    if (!claims) return next(new HttpError(401, 'no_autenticado', 'Iniciá sesión para continuar.'))
    const user = await prisma.user.findUnique({ where: { id: claims.sub } })
    if (!user) return next(new HttpError(401, 'no_autenticado', 'Iniciá sesión para continuar.'))
    req.user = { id: user.id, rol: user.rol, nombre: user.nombre, email: user.email, telefono: user.telefono }
    next()
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) return next(new HttpError(403, 'sin_permiso', 'No tenés permiso para esto.'))
    next()
  }
}
