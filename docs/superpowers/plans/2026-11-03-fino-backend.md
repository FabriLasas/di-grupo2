# FINO Backend Implementation Plan (Plan 1 de 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API Express + PostgreSQL + Socket.io que soporta la web del cliente y la app del local de FINO: cuentas, menú, pedidos con máquina de estados, pagos Mercado Pago (sandbox), tiempo real e historial.

**Architecture:** Monorepo npm workspaces. `packages/shared` tiene estados, transiciones, cálculos y esquemas zod usados por server y fronts. `server/` es una app Express creada por `createApp(deps)` con dependencias inyectadas (prisma, gateway de pagos, realtime, clock) para testear sin red. Toda transición de pedido pasa por `transition()`.

**Tech Stack:** Node 22, JavaScript ESM con JSDoc, Express 5, Prisma 6.19 + PostgreSQL 16, Socket.io 4.8, zod 4, bcryptjs, jsonwebtoken, cookie-parser, SDK `mercadopago` 2.x, Vitest 4 + Supertest + socket.io-client.

**Spec:** `docs/superpowers/specs/2026-11-03-fino-takeaway-design.md`

Planes siguientes (se escriben al terminar este): Plan 2 Web del cliente (`apps/web`), Plan 3 App del local (`apps/local`).

## Global Constraints

- Montos en **pesos enteros** (`14500`), nunca decimales. Formato visible `$14.500` (`es-AR`).
- Número de pedido secuencial, visible como `#0427` (4 dígitos con ceros).
- El total **lo calcula siempre el servidor**; el del cliente solo se compara.
- Solo `transition()` cambia `Order.estado`; cada cambio crea un `OrderEvent`.
- Estados: `pendiente_pago, por_aceptar, en_cocina, para_retirar, entregado, rechazado, cancelado, no_retirado`.
- `minutosRetiro`: entero 5 a 90, múltiplo de 5.
- Motivos de rechazo: `sin_stock, local_cerrando, demasiados_pedidos, otro`.
- Demora actual = `demoraBaseMin` + 2,5 × pedidos en cocina, redondeado a 5, mínimo 15, máximo 45. Sugerido = demora + 5 si el pedido tiene 6 o más unidades.
- Cookie de sesión `fino_session`, `httpOnly`, `SameSite=Lax`, `secure` en producción. Duración: staff/admin 12 h, cliente 30 días.
- Pedidos MP en `pendiente_pago` no se envían a la sala `local`.
- Webhook MP: verificar `x-signature` (HMAC SHA256 de `id:{dataId};request-id:{xRequestId};ts:{ts};` con `MP_WEBHOOK_SECRET`), idempotente por `mpPaymentId`.
- Reconciliación: cada 5 min, pedidos `pendiente_pago` con más de 2 min se consultan en MP; con más de 30 min sin pago aprobado pasan a `cancelado`.
- Errores JSON: `{ error: { code, message, details? } }`.
- Historial paginado de a 50.

## Review Focus

1. **Doble aceptación simultánea** del mismo pedido: el segundo debe recibir 409 `transicion_invalida`, no duplicar eventos. (Test en Task 6.)
2. **Webhook repetido o con firma inválida**: repetido no re-transiciona; firma inválida responde 401 y no toca la base. (Test en Task 8.)
3. **Producto agotado o precio cambiado entre carrito y confirmación**: 422 con lista de productos, o 409 con el total nuevo. (Test en Task 5.)
4. **Cliente leyendo o suscribiéndose al pedido de otro**: 404 por REST y suscripción rechazada por socket. (Tests en Task 5 y Task 7.)
5. **Horario que cruza la medianoche** (20:00 a 00:30): a las 00:15 el local está abierto, a las 00:45 cerrado. (Test en Task 4.)

---

## File Structure

```
package.json                      workspaces: packages/*, server, apps/*
docker-compose.yml                postgres:16 para el grupo (puerto 5432)
.env.example
packages/shared/
  package.json                    name "@fino/shared"
  src/index.js                    re-exporta todo
  src/states.js                   ORDER_STATES, EVENTS, TRANSITIONS, nextState, ACTIVE_STATES, TERMINAL_STATES
  src/format.js                   formatPrice, formatOrderNumber
  src/timing.js                   calcDelay, suggestMinutes
  src/schemas.js                  esquemas zod de requests
  test/*.test.js
server/
  package.json                    name "@fino/server"
  prisma/schema.prisma
  prisma/menu-data.js             menú real de FINO (Task 2)
  prisma/seed.js
  src/index.js                    arranque: http + socket + reconcile interval
  src/app.js                      createApp(deps)
  src/config.js                   lee env
  src/lib/errors.js               HttpError, errorHandler, validate(schema)
  src/lib/clock.js                systemClock
  src/auth/{service,middleware,routes}.js
  src/admin/routes.js             usuarios, menú y horario (admin)
  src/menu/{service,routes}.js
  src/store/{service,routes}.js
  src/orders/{pricing,dto,transition,service,routes,staffRoutes,history}.js
  src/payments/{mercadopago,fake,webhook,reconcile,routes}.js
  src/realtime/index.js
  test/helpers.js                 makeTestApp, resetDb, agentAs, createCashOrder
  test/*.test.js
```

---

### Task 1: Monorepo y paquete shared

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `docker-compose.yml`, `packages/shared/package.json`, `packages/shared/src/{index,states,format,timing,schemas}.js`
- Test: `packages/shared/test/{states,format,timing,schemas}.test.js`

**Interfaces:**
- Produces:
  - `ORDER_STATES: string[]`, `ACTIVE_STATES = ['por_aceptar','en_cocina','para_retirar']`, `TERMINAL_STATES = ['entregado','rechazado','cancelado','no_retirado']`
  - `TRANSITIONS: Record<evento, {from: string[], to: string}>` con eventos `pago_aprobado (pendiente_pago→por_aceptar)`, `pago_fallido (pendiente_pago→cancelado)`, `aceptar (por_aceptar→en_cocina)`, `rechazar (por_aceptar→rechazado)`, `listo (en_cocina→para_retirar)`, `entregar (para_retirar→entregado)`, `no_retirado (para_retirar→no_retirado)`, `cancelar (pendiente_pago|por_aceptar→cancelado)`
  - `nextState(estado: string, evento: string): string | null`
  - `formatPrice(n: number): string` y `formatOrderNumber(n: number): string`
  - `calcDelay({ cookCount: number, baseMin: number }): number` y `suggestMinutes({ delay: number, units: number }): number`
  - Esquemas zod: `registerSchema {nombre 2..60, email, telefono 8..20, password min 8}`, `loginSchema {email, password}`, `createOrderSchema {items: [{productId, variantId?, cantidad int 1..20, aclaracion? ≤140, sinTacc? bool, extras?: string[]}] (min 1), metodoPago: 'mp'|'local', detallePagoLocal?: 'efectivo'|'tarjeta', pagaCon?: int, nota? ≤280, totalEsperado: int}` con refine "local exige detallePagoLocal", `acceptSchema {minutos}` (5..90, múltiplo de 5), `rejectSchema {motivo}` (enum del spec), `deliverSchema {cobroConfirmado: boolean}`, `noteSchema {texto 1..500}`, `historyQuerySchema {q?, estado?, desde?, hasta?, page? int ≥1 default 1}`

- [ ] **Step 1: Scaffold.** Root `package.json` con `"type":"module"`, `"private":true`, workspaces `["packages/*","server","apps/*"]`, scripts `test` (corre `npm test -w @fino/shared -w @fino/server`), `db:up` (`docker compose up -d db`). `docker-compose.yml` con servicio `db` postgres:16, usuario/clave `fino`/`fino`, base `fino`. `.env.example` con `DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, PUBLIC_URL, WEB_URL, LOCAL_URL, SEED_PASSWORD`. `.gitignore`: `node_modules, .env, dist, coverage`. Instalar `zod` y `vitest` en shared.

- [ ] **Step 2: Tests que fallan.**

```js
// states.test.js
test('flujo feliz MP', () => {
  expect(nextState('pendiente_pago','pago_aprobado')).toBe('por_aceptar')
  expect(nextState('por_aceptar','aceptar')).toBe('en_cocina')
  expect(nextState('en_cocina','listo')).toBe('para_retirar')
  expect(nextState('para_retirar','entregar')).toBe('entregado')
})
test('cancelar solo antes de cocina', () => {
  expect(nextState('por_aceptar','cancelar')).toBe('cancelado')
  expect(nextState('en_cocina','cancelar')).toBeNull()
})
test('estados terminales no avanzan', () => {
  for (const s of TERMINAL_STATES) for (const e of Object.keys(TRANSITIONS)) expect(nextState(s,e)).toBeNull()
})
// format.test.js
expect(formatPrice(14500)).toBe('$14.500'); expect(formatPrice(0)).toBe('$0')
expect(formatOrderNumber(427)).toBe('#0427'); expect(formatOrderNumber(12345)).toBe('#12345')
// timing.test.js
expect(calcDelay({cookCount:0, baseMin:10})).toBe(15)   // piso
expect(calcDelay({cookCount:5, baseMin:10})).toBe(25)   // 22.5 → 25
expect(calcDelay({cookCount:30, baseMin:10})).toBe(45)  // techo
expect(suggestMinutes({delay:25, units:8})).toBe(30); expect(suggestMinutes({delay:25, units:3})).toBe(25)
// schemas.test.js
expect(acceptSchema.safeParse({minutos:22}).success).toBe(false)
expect(acceptSchema.safeParse({minutos:95}).success).toBe(false)
expect(acceptSchema.safeParse({minutos:25}).success).toBe(true)
expect(createOrderSchema.safeParse({items:[], metodoPago:'mp', totalEsperado:0}).success).toBe(false)
expect(createOrderSchema.safeParse({items:[{productId:'p',cantidad:1}], metodoPago:'local', totalEsperado:1}).success).toBe(false) // falta detallePagoLocal
```

- [ ] **Step 3: Correr y verificar que fallan.** `npm test -w @fino/shared` → FAIL (módulos no existen).
- [ ] **Step 4: Implementar** los módulos de `packages/shared/src`. `formatPrice` usa `Intl.NumberFormat('es-AR')` y antepone `$`. `calcDelay` redondea con `Math.round(x/5)*5` y después limita a 15..45.
- [ ] **Step 5: Correr.** `npm test -w @fino/shared` → PASS.
- [ ] **Step 6: Commit.** `git commit -m "Agregar monorepo y paquete shared con estados, formato y esquemas"`

---

### Task 2: Esquema Prisma, seed del menú real y base de test

**Files:**
- Create: `server/package.json`, `server/prisma/schema.prisma`, `server/prisma/menu-data.js`, `server/prisma/seed.js`, `server/src/config.js`, `server/test/helpers.js` (solo `resetDb` y `prisma` por ahora), `server/vitest.config.js`
- Test: `server/test/seed.test.js`

**Interfaces:**
- Produces: modelos Prisma exactamente como la sección 5 del spec, más:
  - `Order.id String @id @default(cuid())`, `Order.numero Int @unique @default(autoincrement())`
  - `Payment.estado` enum `pendiente | aprobado | rechazado | devuelto | devolucion_pendiente`
  - `Order.estado` enum con los 8 estados; `User.rol` enum `cliente | staff | admin`
  - `OrderEvent.tipo String` (el nombre del evento o `nota`, `devolucion`, `creado`)
  - `StoreSettings` fila única `id = 1` con `abierto Boolean @default(true)`, `pausado Boolean @default(false)`, `horario Json`, `demoraBaseMin Int @default(10)`
  - Índices: `Order(estado)`, `Order(creadoEn)`, `User(telefono)`
  - `seed(prisma)` exportado desde `prisma/seed.js` (también ejecutable con `npm run db:seed`)
  - `resetDb(prisma)`: `TRUNCATE ... RESTART IDENTITY CASCADE` de todas las tablas y luego `seed(prisma)`

- [ ] **Step 1: `menu-data.js` con el menú real** (precios en pesos; descripción exacta de las historias):

| Categoría | Producto | Precio / variantes | Descripción | sinTacc |
|---|---|---|---|---|
| Hamburguesas | Fino | 14500 | Doble carne, cheddar, pepinillos, cebolla brunoise marcada, salsa fino. | sí |
| Hamburguesas | Crispino | 16000 | Doble carne, cheddar, bacon, cebolla crispy, pepinillos, salsa lula. | sí |
| Hamburguesas | Veggie | 17500 | Medallón de portobellos rebozados relleno de variedad de quesos, tomate, lechuga y salsa mil islas. | sí |
| Hamburguesas | Josefina | 16000 | Pan de sésamo, medallón 220grs, cheddar, tomate, lechuga, cebolla morada, mayo heinz. | sí |
| Hamburguesas | Cheeseburger | Simple 9500, Doble 13500, Triple 16500 | (sin descripción) | sí |
| Hamburguesas | Cheesebacon | Simple 10500, Doble 14500, Triple 17500 | (sin descripción) | sí |
| Sides | Papas finas | 9000 | Popcorns de papa con queso y hierbas + mayo pesto | no |
| Sides | Papas fritas | 4000 | | no |
| Sides | Fried pickles | 5000 | + Salsa Fino | no |
| Sides | Nuggets (x6) | 6000 | + Salsa Ranch | no |
| Milkshakes | Cheesecake / Oreo / Chocotorta | 8000 c/u | | no |
| Bebidas | Gaseosa (línea coca) / Agua mineral | 4000 c/u | | no |
| Bebidas | Cerveza Peroni | 6000 | Con alcohol | no |

Extras: `Dip Fino`, `Dip Lula`, `Dip Ranch` a 2000 cada uno. Horario seed: todos los días `[["20:00","00:30"]]` (clave `"0"`..`"6"`, domingo = 0). Usuarios seed: `admin@fino.test` (admin) y `staff@fino.test` (staff) con `SEED_PASSWORD` (default `fino1234`).

- [ ] **Step 2: Test que falla.**

```js
test('seed carga el menú real', async () => {
  await resetDb(prisma)
  const fino = await prisma.product.findFirst({ where: { nombre: 'Fino' } })
  expect(fino.precioBase).toBe(14500)
  const cb = await prisma.product.findFirst({ where: { nombre: 'Cheesebacon' }, include: { variants: true } })
  expect(cb.variants.map(v => v.precio).sort()).toEqual([10500, 14500, 17500])
  expect(await prisma.extra.count()).toBe(3)
  expect((await prisma.storeSettings.findUnique({ where: { id: 1 } })).demoraBaseMin).toBe(10)
})
```

- [ ] **Step 3: Levantar Postgres de test.** Local: `service postgresql start`, crear rol `fino`/`fino` y base `fino_test` (en el equipo del grupo: `npm run db:up`). `TEST_DATABASE_URL=postgresql://fino:fino@localhost:5432/fino_test`. `vitest.config.js`: `fileParallelism: false`, `globalSetup` que corre `prisma migrate deploy` contra `TEST_DATABASE_URL`.
- [ ] **Step 4: Correr** `npm test -w @fino/server` → FAIL (sin esquema).
- [ ] **Step 5: Escribir `schema.prisma`, crear migración** `npx prisma migrate dev --name init`, implementar `seed.js` y `resetDb`.
- [ ] **Step 6: Correr** → PASS.
- [ ] **Step 7: Commit.** `git commit -m "Agregar esquema Prisma, seed del menú de FINO y base de test"`

---

### Task 3: App Express, errores y autenticación

**Files:**
- Create: `server/src/app.js`, `server/src/lib/errors.js`, `server/src/lib/clock.js`, `server/src/auth/{service,middleware,routes}.js`, `server/src/admin/routes.js` (solo usuarios por ahora)
- Modify: `server/test/helpers.js` (agrega `makeTestApp`, `agentAs`)
- Test: `server/test/auth.test.js`

**Interfaces:**
- Consumes: `registerSchema`, `loginSchema` de `@fino/shared`; `prisma` de Task 2.
- Produces:
  - `createApp({ prisma, payments, realtime, clock, config }): express.Application`, montado bajo `/api`
  - `class HttpError extends Error { constructor(status, code, message, details) }`, `errorHandler`, `validate(schema, 'body'|'query') → middleware` que responde 400 `validacion` con `details` de zod
  - `requireAuth` (pone `req.user = { id, rol, nombre }` o 401 `no_autenticado`) y `requireRole(...roles)` (403 `sin_permiso`)
  - `signSession(user) → { token, maxAgeMs }`, `setSessionCookie(res, user)`, `verifySession(token) → { sub, rol } | null`
  - `makeTestApp(overrides?) → { app, deps }`, con `payments = createFakeGateway()` (Task 8; antes un stub vacío), `realtime = { emitOrder(){}, emitStore(){} }` espiable y `clock` fijo
  - `agentAs(app, rol) → supertest.agent` ya logueado (usa los usuarios seed; para `cliente` registra uno nuevo)
  - Rutas: `POST /api/auth/register` (201 `{user}` + cookie; 409 `email_en_uso`), `POST /api/auth/login` (200 o 401 `credenciales_invalidas`), `POST /api/auth/logout` (204, borra la cookie), `GET /api/auth/me` (200 `{user}` o 401), `POST /api/admin/users` (admin; crea staff/admin)

- [ ] **Step 1: Tests que fallan.**

```js
test('registro crea cliente y deja sesión', async () => {
  const a = request.agent(app)
  const r = await a.post('/api/auth/register').send({ nombre:'Tomás Rodríguez', email:'tomas@x.com', telefono:'1154328817', password:'secreta123' })
  expect(r.status).toBe(201); expect(r.body.user.rol).toBe('cliente'); expect(r.body.user.passwordHash).toBeUndefined()
  expect(r.headers['set-cookie'][0]).toMatch(/fino_session=.*HttpOnly/i)
  expect((await a.get('/api/auth/me')).body.user.email).toBe('tomas@x.com')
})
test('email repetido → 409 email_en_uso', ...)
test('login con clave mala → 401 credenciales_invalidas', ...)
test('cookie de staff dura 12 h y la de cliente 30 días', ...)  // Max-Age=43200 y 2592000
test('cliente no puede crear usuarios → 403 sin_permiso', ...)
test('body inválido → 400 validacion con details', ...)
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** bcryptjs con costo 10. JWT HS256 con `JWT_SECRET`. Express 5 con `express.json()`, `cookie-parser`, `cors({ origin: [WEB_URL, LOCAL_URL], credentials: true })`.
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "Agregar app Express, manejo de errores y autenticación con roles"`

---

### Task 4: Menú, estado del local y admin del menú

**Files:**
- Create: `server/src/menu/{service,routes}.js`, `server/src/store/{service,routes}.js`
- Modify: `server/src/admin/routes.js`, `server/src/app.js`
- Test: `server/test/menu.test.js`, `server/test/store.test.js`

**Interfaces:**
- Consumes: `calcDelay` de shared; `requireRole`.
- Produces:
  - `getMenu(prisma) → { categorias: [{ id, nombre, productos: [{ id, nombre, descripcion, precioBase, sinTacc, agotado, variantes: [{id,nombre,precio}] }] }], extras: [{id,nombre,precio}] }`, solo activos y ordenados por `orden`
  - `isOpenAt(settings, date: Date) → boolean`: considera `abierto` y franjas que cruzan la medianoche (una franja `["20:00","00:30"]` del día D cubre de D 20:00 a D+1 00:30)
  - `getStoreStatus(prisma, clock) → { abierto: boolean, pausado: boolean, aceptaPedidos: boolean, demoraMin: number, horario }`, donde `aceptaPedidos = abierto && !pausado` y `demoraMin = calcDelay({cookCount: pedidos en_cocina, baseMin})`
  - `GET /api/menu`, `GET /api/store` (públicos)
  - `PATCH /api/staff/store {pausado: boolean}` (staff/admin) → emite `realtime.emitStore(status)`
  - Admin: `POST /api/admin/products`, `PATCH /api/admin/products/:id {nombre?, descripcion?, precioBase?, agotado?, activo?, sinTacc?}`, `PATCH /api/admin/variants/:id {precio}`, `PATCH /api/admin/extras/:id {precio?, activo?}`, `PATCH /api/admin/store {abierto?, horario?, demoraBaseMin?}`

- [ ] **Step 1: Tests que fallan.**

```js
test('GET /menu agrupa por categoría y oculta inactivos', ...) // 4 categorías; un producto con activo=false no aparece
test('agotado se muestra con agotado:true', ...)
test('horario que cruza medianoche', () => {
  const s = { abierto:true, horario:{ '1':[['20:00','00:30']] } }   // lunes
  expect(isOpenAt(s, new Date('2026-11-02T20:05:00-03:00'))).toBe(true)   // lunes 20:05
  expect(isOpenAt(s, new Date('2026-11-03T00:15:00-03:00'))).toBe(true)   // martes 00:15, franja del lunes
  expect(isOpenAt(s, new Date('2026-11-03T00:45:00-03:00'))).toBe(false)
  expect(isOpenAt(s, new Date('2026-11-02T19:59:00-03:00'))).toBe(false)
})
test('pausar desde staff emite store:updated y aceptaPedidos=false', ...)
test('admin cambia precio de variante; cliente recibe 403', ...)
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** Las horas se evalúan en `America/Argentina/Buenos_Aires` con `Intl.DateTimeFormat` (sin librerías de fechas).
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "Agregar menú público, estado del local y administración del menú"`

---

### Task 5: Crear pedidos y consultas del cliente

**Files:**
- Create: `server/src/orders/{pricing,dto,service,routes}.js`
- Modify: `server/src/app.js`, `server/test/helpers.js` (agrega `createCashOrder(agent, overrides?)`)
- Test: `server/test/orders.create.test.js`

**Interfaces:**
- Consumes: `createOrderSchema`, `formatOrderNumber`; `getStoreStatus`; `payments.createPreference` (Task 8; hasta entonces el fake devuelve `{id:'pref_test', initPoint:'https://mp.test/checkout'}`); `realtime.emitOrder`.
- Produces:
  - `priceItems(prisma, items) → { lines: [{ productId, variantId, cantidad, precioUnitario, aclaracion, sinTacc, extras: [{extraId, precio}] }], total, unavailable: string[] }`. `precioUnitario` = precio de la variante (o `precioBase`) + suma de extras. Si el producto tiene variantes y no llega `variantId` → 400 `variante_requerida`. `sinTacc:true` en un producto sin `sinTacc` → 400 `sin_tacc_no_disponible`.
  - `toOrderDTO(order) → { id, numero, numeroLabel, estado, cliente:{nombre,telefono}, metodoPago, detallePagoLocal, pagaCon, vuelto, total, nota, minutosRetiro, retiroEstimado, creadoEn, aceptadoEn, listoEn, entregadoEn, items:[{cantidad, producto, variante, aclaracion, sinTacc, extras:[nombre], precioUnitario, subtotal}], pago:{estado, mpPaymentId}|null }`, con `vuelto = pagaCon - total` si `pagaCon` existe
  - `ORDER_INCLUDE`: objeto `include` de Prisma reutilizable (cliente, items→producto/variante/extras→extra, payments)
  - `createOrder(deps, user, body) → { order: OrderDTO, initPoint?: string }`
  - Rutas (cliente): `POST /api/orders` (201), `GET /api/orders/mine` (los últimos 20, más reciente primero), `GET /api/orders/:id` (404 `no_encontrado` si no es del usuario, salvo staff), `POST /api/orders/:id/cancel`
- Reglas: local no acepta pedidos → 409 `local_no_disponible`; productos agotados o inactivos → 422 `productos_no_disponibles` con `details.productos: [productId]`; `totalEsperado !== total` → 409 `total_cambio` con `details.total`. `metodoPago:'local'` → estado `por_aceptar`, evento `creado`, `realtime.emitOrder(dto, 'order:new')`. `metodoPago:'mp'` → estado `pendiente_pago`, `Payment {estado:'pendiente', mpPreferenceId}`, sin emitir a `local`; responde con `initPoint`.

- [ ] **Step 1: Tests que fallan.**

```js
test('pedido en el local: total del servidor, por_aceptar, emite order:new', async () => {
  // 2× Fino + 1 Dip Lula en una de ellas: líneas [Fino×1 + DipLula, Fino×1]
  const r = await cliente.post('/api/orders').send({ items:[
    { productId: fino.id, cantidad:1, extras:[dipLula.id] }, { productId: fino.id, cantidad:1 } ],
    metodoPago:'local', detallePagoLocal:'efectivo', pagaCon:40000, totalEsperado:31000 })
  expect(r.status).toBe(201)
  expect(r.body.order.total).toBe(31000); expect(r.body.order.vuelto).toBe(9000)
  expect(r.body.order.estado).toBe('por_aceptar'); expect(r.body.order.numeroLabel).toMatch(/^#\d{4}$/)
  expect(deps.realtime.emitOrder).toHaveBeenCalledWith(expect.objectContaining({ id: r.body.order.id }), 'order:new')
})
test('pedido MP queda pendiente_pago, devuelve initPoint y no avisa al local', ...)
test('variante requerida para Cheeseburger → 400 variante_requerida', ...)
test('producto agotado → 422 productos_no_disponibles con su id', ...)
test('totalEsperado distinto → 409 total_cambio con details.total', ...)
test('local pausado → 409 local_no_disponible', ...)
test('otro cliente pide GET /orders/:id ajeno → 404', ...)
test('cancelar en por_aceptar ok; en en_cocina → 409 transicion_invalida', ...)  // el segundo caso usa transition directo (Task 6) o se marca .todo hasta Task 6
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar** `pricing.js`, `dto.js`, `service.js` y `routes.js`. La creación de `Order` + `OrderItem` + `OrderItemExtra` + `OrderEvent('creado')` se hace en una `prisma.$transaction`. `cancel` usa `transition` (Task 6): implementar esta ruta en Task 6 si se ejecuta en orden.
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "Agregar creación de pedidos con precios del servidor y consultas del cliente"`

---

### Task 6: Máquina de estados y acciones del local

**Files:**
- Create: `server/src/orders/{transition,staffRoutes}.js`
- Modify: `server/src/orders/{service,routes}.js` (cancelar), `server/src/app.js`
- Test: `server/test/orders.transition.test.js`, `server/test/orders.staff.test.js`

**Interfaces:**
- Consumes: `TRANSITIONS`, `nextState`, `acceptSchema`, `rejectSchema`, `deliverSchema`, `noteSchema`, `suggestMinutes`, `calcDelay`; `ORDER_INCLUDE`, `toOrderDTO`.
- Produces:
  - `transition(prisma, { orderId, evento, actorId, data = {}, now: Date }) → Order` (con `ORDER_INCLUDE`). Hace `updateMany({ where: { id, estado: { in: from } }, data })`; si `count === 0` → `HttpError(409, 'transicion_invalida', ..., { estadoActual })`. Luego crea `OrderEvent { tipo: evento, actorId, detalle: data }`. Todo en una `$transaction`. Campos por evento: `aceptar → aceptadoEn=now, aceptadoPorId, minutosRetiro, retiroEstimado=now+min`; `rechazar → motivoRechazo`; `listo → listoEn`; `entregar → entregadoEn`.
  - `applyEvent(deps, { orderId, evento, actor, data }) → OrderDTO`: llama a `transition`, después emite `realtime.emitOrder(dto, 'order:updated')`. Si `evento === 'rechazar'` y hay un `Payment` aprobado, llama a `refundOrder(deps, order)` (Task 8; hasta entonces no hace nada).
  - `GET /api/staff/orders` → `{ porAceptar, enCocina, paraRetirar, demoraMin }`, cada pedido como `OrderDTO` más `sugeridoMin` (solo en `porAceptar`). Orden: `creadoEn asc`, `retiroEstimado asc` y `listoEn asc`.
  - `POST /api/staff/orders/:id/accept {minutos}`, `/reject {motivo}`, `/ready`, `/deliver {cobroConfirmado}`, `/not-picked-up`, `/notes {texto}` (201; crea `OrderNote` + `OrderEvent('nota')`)
  - `deliver` con `metodoPago:'local'` y `cobroConfirmado !== true` → 400 `cobro_no_confirmado`.

- [ ] **Step 1: Tests que fallan.**

```js
test('aceptar fija retiroEstimado = now + minutos y aceptadoPorId', async () => {
  const o = await createCashOrder(cliente)
  const r = await staff.post(`/api/staff/orders/${o.id}/accept`).send({ minutos: 20 })
  expect(r.body.order.estado).toBe('en_cocina')
  expect(new Date(r.body.order.retiroEstimado) - new Date(r.body.order.aceptadoEn)).toBe(20*60000)
})
test('doble aceptación concurrente: una 200 y otra 409, un solo evento aceptar', async () => {
  const o = await createCashOrder(cliente)
  const [a,b] = await Promise.all([staff.post(`/api/staff/orders/${o.id}/accept`).send({minutos:20}), staff2.post(`/api/staff/orders/${o.id}/accept`).send({minutos:25})])
  expect([a.status,b.status].sort()).toEqual([200,409])
  expect(await prisma.orderEvent.count({ where:{ pedidoId:o.id, tipo:'aceptar' } })).toBe(1)
})
test('listo y entregar en efectivo exige cobroConfirmado', ...)   // 400 cobro_no_confirmado y después 200 entregado
test('rechazar exige motivo válido y guarda motivoRechazo', ...)
test('tablero agrupa y ordena por urgencia', ...)               // 3 pedidos creados en orden; porAceptar[0] es el más viejo
test('cliente no accede a /staff/* → 403', ...)
test('cada acción emite order:updated', ...)
test('tabla de transiciones inválidas → 409', ...)               // p. ej. listo sobre por_aceptar
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** `now` sale de `deps.clock.now()`.
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "Agregar máquina de estados de pedidos y acciones del local"`

---

### Task 7: Tiempo real con Socket.io

**Files:**
- Create: `server/src/realtime/index.js`, `server/src/index.js`
- Test: `server/test/realtime.test.js`

**Interfaces:**
- Consumes: `verifySession`; `prisma`.
- Produces:
  - `attachRealtime(httpServer, { prisma, config }) → { io, emitOrder(dto, event), emitStore(status) }`
  - Handshake: lee `fino_session` del header `cookie`; sin sesión válida → `next(new Error('no_autenticado'))`. Staff y admin entran solos a la sala `local`.
  - El cliente emite `order:subscribe {orderId}` con ack. Si el pedido es suyo, entra a `order:<id>` y recibe `ack({ok:true})`; si no, `ack({ok:false, error:'no_encontrado'})`.
  - `emitOrder(dto, event)`: a `order:<id>` siempre `order:updated`. A `local`, `event` solo si `dto.estado !== 'pendiente_pago'`; cuando pasa de `pendiente_pago` a `por_aceptar`, `local` recibe `order:new`.
  - `emitStore(status)` → `local` y broadcast general `store:updated`.
  - `src/index.js`: crea el server http, `createApp` con el realtime real y el gateway MP real, y `setInterval(reconcilePending, 5*60000)` (Task 8).

- [ ] **Step 1: Tests que fallan** (server real en puerto efímero, `socket.io-client` con `extraHeaders: { cookie }`):

```js
test('staff recibe order:new al crear un pedido en el local', ...)
test('cliente suscripto recibe order:updated al aceptar', ...)
test('cliente no puede suscribirse a pedido ajeno', ...)   // ack.ok === false
test('sin cookie la conexión se rechaza', ...)             // evento connect_error con message 'no_autenticado'
test('pedido MP pendiente no llega a local', ...)
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "Agregar tiempo real con salas para el local y por pedido"`

---

### Task 8: Mercado Pago: preferencia, webhook, devoluciones y reconciliación

**Files:**
- Create: `server/src/payments/{mercadopago,fake,webhook,reconcile,routes}.js`
- Modify: `server/src/orders/service.js` (usa `createPreference` y `refundOrder`), `server/src/app.js`
- Test: `server/test/payments.test.js`

**Interfaces:**
- Produces:
  - Gateway (misma forma para el real y el fake):
    - `createPreference({ order, notificationUrl, backUrl }) → { id, initPoint }`
    - `getPayment(id) → { id, status: 'approved'|'rejected'|'pending'|..., externalReference, amount }`
    - `searchByReference(orderId) → payment | null`
    - `refund(paymentId) → { status }`
    - `verifySignature({ xSignature, xRequestId, dataId }) → boolean`
  - `createMercadoPagoGateway({ accessToken, webhookSecret })` usa `MercadoPagoConfig`, `Preference`, `Payment` y `PaymentRefund` del SDK. `external_reference = order.id`, `back_urls.success|failure|pending = ${WEB_URL}/pedido/${order.id}`, `auto_return: 'approved'`.
  - `createFakeGateway()` guarda los pagos en memoria y expone `fake.setPayment({ id, status, externalReference, amount })` y `fake.failRefunds = true`. `verifySignature` acepta solo `xSignature === 'ok'`.
  - `handleWebhook(deps, { query, headers }) → { handled: boolean }`. Firma inválida → 401 `firma_invalida`. Hace upsert de `Payment` por `mpPaymentId`. Si `approved` y el pedido está en `pendiente_pago`, `applyEvent('pago_aprobado')`; si `rejected`, `applyEvent('pago_fallido')`. Si el pedido ya avanzó, solo actualiza `raw`.
  - `refundOrder(deps, order)`: `gateway.refund`. Si sale bien, `Payment.estado = 'devuelto'` y `OrderEvent('devolucion')`; si falla, `'devolucion_pendiente'`. Nunca lanza error.
  - `reconcilePending(deps)`: para cada pedido `pendiente_pago` con `creadoEn < now-2min` llama a `searchByReference`; si hay un pago aprobado, lo procesa igual que el webhook. Si `creadoEn < now-30min` y no hay pago aprobado, `applyEvent('pago_fallido')`.
  - `POST /api/payments/webhook` (público) y `POST /api/staff/orders/:id/refund` (staff; 409 `sin_pago_aprobado` si no corresponde).

- [ ] **Step 1: Tests que fallan.**

```js
test('webhook aprobado pasa a por_aceptar y emite order:new a local', ...)
test('webhook repetido no duplica eventos', ...)                  // 2 llamadas → 1 OrderEvent pago_aprobado, 1 Payment
test('firma inválida → 401 y la base no cambia', ...)
test('rechazar un pedido pagado → Payment devuelto + evento devolucion', ...)
test('falla la devolución → devolucion_pendiente, el rechazo igual ocurre', ...)
test('reconcile: aprobado encontrado por referencia → por_aceptar', ...)
test('reconcile: 31 min sin pago → cancelado', ...)               // clock avanzado
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.** Antes, revisar la firma vigente del SDK (`npm view mercadopago version` y su README) y fijar la versión exacta en `package.json`.
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit.** `git commit -m "Agregar pagos con Mercado Pago: preferencia, webhook, devoluciones y reconciliación"`

---

### Task 9: Historial y búsqueda

**Files:**
- Create: `server/src/orders/history.js`
- Modify: `server/src/orders/staffRoutes.js`, `server/src/orders/dto.js` (agrega `eventos` y `notas` opcionales)
- Test: `server/test/history.test.js`

**Interfaces:**
- Consumes: `historyQuerySchema`, `TERMINAL_STATES`.
- Produces:
  - `searchHistory(prisma, { q, estado, desde, hasta, page }) → { items: OrderDTO[], total, page, pageSize: 50, resumen: { cantidad, totalEntregado } }`. Por defecto filtra estados terminales del día actual (Buenos Aires). `q`: sin `#` inicial; si son dígitos, busca `numero` exacto o teléfono que los contenga; también nombre del cliente `ILIKE` y nombre de producto. Orden: `creadoEn desc`.
  - `GET /api/staff/orders/history` y `GET /api/staff/orders/:id` (staff: incluye `eventos: [{tipo, actor, detalle, creadoEn}]` y `notas`).

- [ ] **Step 1: Tests que fallan.**

```js
test('busca por número con y sin #', ...)          // q='0427' y q='#0427' → el mismo pedido
test('busca por teléfono parcial', ...)            // q='5587' → Santiago
test('busca por producto', ...)                   // q='veggie' → pedidos con Veggie
test('filtra por estado y pagina de a 50', ...)    // 55 pedidos entregados → page 2 tiene 5
test('resumen suma solo entregados', ...)
test('detalle staff trae la línea de tiempo en orden', ...)  // creado, aceptar, listo, entregar
```

- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** → PASS, y la suite completa `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "Agregar historial de pedidos con búsqueda y filtros"`

---

## Cierre del Plan 1

- `npm test` en verde desde la raíz.
- `server/README.md` con cómo levantar la base (`npm run db:up`), migrar (`npx prisma migrate deploy`), sembrar (`npm run db:seed`) y correr (`npm run dev -w @fino/server`), y cómo probar MP sandbox con un túnel para el webhook.
- Siguiente: escribir el Plan 2 (web del cliente).
