import { test, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import { prisma, resetDb, makeTestApp, agentAs } from './helpers.js'

let app
beforeEach(async () => { await resetDb(); ({ app } = makeTestApp()) })
afterAll(() => prisma.$disconnect())

const tomas = { nombre: 'Tomás Rodríguez', email: 'tomas@x.com', telefono: '1154328817', password: 'secreta123' }

test('registro crea cliente y deja sesión', async () => {
  const a = request.agent(app)
  const r = await a.post('/api/auth/register').send(tomas)
  expect(r.status).toBe(201)
  expect(r.body.user.rol).toBe('cliente')
  expect(r.body.user.passwordHash).toBeUndefined()
  expect(r.headers['set-cookie'][0]).toMatch(/fino_session=.*HttpOnly/i)
  const me = await a.get('/api/auth/me')
  expect(me.status).toBe(200)
  expect(me.body.user.email).toBe('tomas@x.com')
})

test('email repetido → 409 email_en_uso', async () => {
  await request(app).post('/api/auth/register').send(tomas)
  const r = await request(app).post('/api/auth/register').send({ ...tomas, email: 'TOMAS@x.com' })
  expect(r.status).toBe(409)
  expect(r.body.error.code).toBe('email_en_uso')
})

test('login con clave mala → 401 credenciales_invalidas', async () => {
  const r = await request(app).post('/api/auth/login').send({ email: 'staff@fino.test', password: 'mala-clave' })
  expect(r.status).toBe(401)
  expect(r.body.error.code).toBe('credenciales_invalidas')
})

test('cookie de staff dura 12 h y la de cliente 30 días', async () => {
  const s = await request(app).post('/api/auth/login').send({ email: 'staff@fino.test', password: 'fino1234' })
  expect(s.headers['set-cookie'][0]).toMatch(/Max-Age=43200/)
  const c = await request(app).post('/api/auth/register').send(tomas)
  expect(c.headers['set-cookie'][0]).toMatch(/Max-Age=2592000/)
})

test('logout borra la sesión', async () => {
  const a = await agentAs(app, 'cliente')
  expect((await a.post('/api/auth/logout')).status).toBe(204)
  expect((await a.get('/api/auth/me')).status).toBe(401)
})

test('sin sesión → 401 no_autenticado', async () => {
  const r = await request(app).get('/api/auth/me')
  expect(r.status).toBe(401)
  expect(r.body.error.code).toBe('no_autenticado')
})

test('cliente no puede crear usuarios → 403 sin_permiso', async () => {
  const a = await agentAs(app, 'cliente')
  const r = await a.post('/api/admin/users').send({ nombre: 'Agus', email: 'agus@fino.test', telefono: '1100000002', password: 'agus12345', rol: 'staff' })
  expect(r.status).toBe(403)
  expect(r.body.error.code).toBe('sin_permiso')
})

test('admin crea usuario de staff', async () => {
  const a = await agentAs(app, 'admin')
  const r = await a.post('/api/admin/users').send({ nombre: 'Agus', email: 'agus@fino.test', telefono: '1100000002', password: 'agus12345', rol: 'staff' })
  expect(r.status).toBe(201)
  expect(r.body.user.rol).toBe('staff')
})

test('body inválido → 400 validacion con details', async () => {
  const r = await request(app).post('/api/auth/register').send({ email: 'no-email' })
  expect(r.status).toBe(400)
  expect(r.body.error.code).toBe('validacion')
  expect(Array.isArray(r.body.error.details)).toBe(true)
})
