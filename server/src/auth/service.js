import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const COOKIE = 'fino_session'
const STAFF_MS = 12 * 60 * 60 * 1000
const CLIENT_MS = 30 * 24 * 60 * 60 * 1000

export const publicUser = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, telefono: u.telefono, rol: u.rol })
export const hashPassword = (p) => bcrypt.hash(p, 10)
export const checkPassword = (p, hash) => bcrypt.compare(p, hash)

/** @returns {{token: string, maxAgeMs: number}} */
export function signSession(user, secret) {
  const maxAgeMs = user.rol === 'cliente' ? CLIENT_MS : STAFF_MS
  const token = jwt.sign({ sub: user.id, rol: user.rol }, secret, { algorithm: 'HS256', expiresIn: Math.floor(maxAgeMs / 1000) })
  return { token, maxAgeMs }
}

/** @returns {{sub: string, rol: string} | null} */
export function verifySession(token, secret) {
  if (!token) return null
  try { return jwt.verify(token, secret, { algorithms: ['HS256'] }) } catch { return null }
}

export function setSessionCookie(res, user, config) {
  const { token, maxAgeMs } = signSession(user, config.jwtSecret)
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: maxAgeMs, path: '/' })
}

export function clearSessionCookie(res, config) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' })
}
