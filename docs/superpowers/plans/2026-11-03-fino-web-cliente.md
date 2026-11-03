# FINO Web del Cliente Implementation Plan (Plan 2 de 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web de pedidos para retirar con el diseño "Tablero": menú, carrito, cuenta, checkout con Mercado Pago o pago en el local, seguimiento en vivo y "Mis pedidos", consumiendo la API del Plan 1.

**Architecture:** SPA React con Vite en `apps/web`. Capa `api/` (fetch con cookies y errores tipados), `state/` (carrito y sesión con Context + reducer), `screens/` (una por ruta), `ui/` (piezas visuales del Tablero). El socket se aísla en `api/socket.js` para mockearlo en tests. Los cálculos de precio y formato vienen de `@fino/shared`.

**Tech Stack:** React 19.3.1, React Router 8.5.0, Vite 8.3.4 + @vitejs/plugin-react 6.1.2, socket.io-client 4.8.1, Vitest 5 + Testing Library (react 16.3.3, user-event 14.6.8, jest-dom 7.0.1) + jsdom 30.1.3. CSS propio con tokens, sin framework.

**Spec:** `docs/superpowers/specs/2026-11-03-fino-takeaway-design.md` (secciones 2, 8 y 10). Diseño: `docs/design/propuestas-fino.html` propuesta A y el teléfono de `docs/design/detalle-pedido.html`.

## Global Constraints

- Tokens: bordó `#6E1C25`, crema `#F2EEEA`, cuadros `#7B1F2A`/`#661822`, mostaza `#F4B740`. Fuentes Anton (títulos), Poppins (texto), IBM Plex Mono (precios). Siempre claro sobre los cuadros.
- Precios con `formatPrice` de `@fino/shared` (`$14.500`). Número de pedido con `numeroLabel` de la API.
- Todas las llamadas a la API con `credentials: 'include'` y base `import.meta.env.VITE_API_URL ?? ''` (en dev, proxy de Vite a `http://localhost:4000`).
- El total que se muestra es una estimación del cliente; se manda como `totalEsperado` y manda el del server.
- Animaciones: cuadros en desplazamiento, bolita que vuela al carrito, rebote del contador y mascota que saluda. Todas se apagan con `prefers-reduced-motion: reduce`.
- Ancho mínimo 360 px, gutter de 16 px, botones de 44 px mínimo, foco visible.
- Copia en español rioplatense ("Pedí", "Retirás", "Pagá").
- Pedir login solo al confirmar, no para ver el menú.

## Review Focus

1. **Carrito con productos que se agotaron**: al confirmar llega 422; esas líneas se marcan "Ya no está disponible" y el botón queda deshabilitado hasta quitarlas. (Test en Task 5.)
2. **Precio cambiado**: llega 409 `total_cambio`; se muestra el total nuevo y se exige volver a confirmar. (Test en Task 5.)
3. **Local cerrado o pausado durante la compra**: banner arriba y botón "Confirmar" deshabilitado; si llega 409 `local_no_disponible`, se muestra el mensaje. (Tests en Task 2 y Task 5.)
4. **Recargar la página de seguimiento o volver de Mercado Pago**: el estado se recupera por REST aunque el socket todavía no conecte. (Test en Task 6.)
5. **Carrito persistido con datos viejos o corruptos en localStorage**: se ignora sin romper la app. (Test en Task 3.)

---

## File Structure

```
apps/web/
  package.json  vite.config.js  index.html
  src/main.jsx                 monta <App/> con BrowserRouter
  src/App.jsx                  rutas y providers
  src/styles/tokens.css        tokens y base
  src/styles/app.css           componentes
  src/assets/logo.png  src/assets/mascota.png
  src/api/client.js            apiFetch, ApiError
  src/api/endpoints.js         getMenu, getStore, me, login, register, logout, createOrder, getOrder, myOrders, cancelOrder
  src/api/socket.js            connectSocket(), subscribeOrder(socket, id, onUpdate)
  src/state/cart.jsx           CartProvider, useCart, cartReducer, lineKey, unitPrice
  src/state/auth.jsx           AuthProvider, useAuth
  src/state/store.jsx          StoreProvider, useStore (menú + estado del local)
  src/ui/Tablero.jsx           fondo a cuadros + cabecera con logo
  src/ui/CartBar.jsx           barra inferior con contador y total
  src/ui/ProductSheet.jsx      hoja de opciones (variante, dips, sin TACC, aclaración)
  src/ui/Mascot.jsx            mascota con máscara recoloreable
  src/ui/fly.js                flyToCart(fromEl, toEl)
  src/screens/MenuScreen.jsx  CartScreen.jsx  AuthScreen.jsx  CheckoutScreen.jsx  OrderScreen.jsx  MyOrdersScreen.jsx
  test/setup.js  test/utils.jsx (renderApp con providers y fetch simulado)  test/*.test.jsx
```

---

### Task 1: Scaffold, tokens y cliente de API

**Files:** Create `apps/web/{package.json,vite.config.js,index.html}`, `src/{main.jsx,App.jsx}`, `src/styles/{tokens.css,app.css}`, `src/assets/*` (copiados de `docs/design/assets`), `src/api/client.js`, `src/ui/Tablero.jsx`, `src/ui/Mascot.jsx`, `test/setup.js`, `test/utils.jsx`. Test: `test/client.test.js`, `test/app.test.jsx`.

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; code: string; details?: any }`
  - `apiFetch(path: string, { method='GET', body } = {}): Promise<any>`. Manda JSON y `credentials:'include'`. Si `!res.ok`, lanza `ApiError` con `error.code` (sin JSON: `code: 'red'`). Si es 204, devuelve `null`. Si `fetch` falla, lanza `ApiError(0, 'sin_conexion', 'No hay conexión. Revisá internet y probá de nuevo.')`.
  - `test/utils.jsx`: `mockApi(routes: Record<'GET /api/menu'|..., (body)=>[status, json]>)` reemplaza `global.fetch`; `renderApp(path='/')` monta `App` con `MemoryRouter`.
  - `vite.config.js`: proxy `/api` y `/socket.io` (con `ws:true`) a `http://localhost:4000`, y `test: { environment:'jsdom', setupFiles:['./test/setup.js'] }`.

- [ ] **Step 1: Tests que fallan.**
```js
test('apiFetch devuelve JSON y manda cookies', async () => { /* fetch mock 200 {a:1} → {a:1}; init.credentials === 'include' */ })
test('apiFetch lanza ApiError con code y details', async () => { /* 409 {error:{code:'total_cambio',details:{total:14500}}} → err.code==='total_cambio', err.details.total===14500 */ })
test('apiFetch sin red → ApiError sin_conexion', async () => { /* fetch rechaza */ })
test('la app muestra el logo de FINO', async () => { mockApi({ 'GET /api/menu': () => [200, {categorias:[],extras:[]}], 'GET /api/store': () => [200, {abierto:true,pausado:false,aceptaPedidos:true,demoraMin:20}], 'GET /api/auth/me': () => [401, {error:{code:'no_autenticado'}}] }); renderApp('/'); expect(await screen.findByAltText('FINO')).toBeInTheDocument() })
```
- [ ] **Step 2: Correr** `npm test -w @fino/web` → FAIL.
- [ ] **Step 3: Implementar** el scaffold, `client.js`, `Tablero.jsx` (fondo con `repeating-conic-gradient`, animación `checker` de 18 s y logo arriba) y `App.jsx` con una ruta `/` provisoria.
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `"Agregar web del cliente: scaffold, tokens y cliente de API"`

---

### Task 2: Menú y estado del local

**Files:** Create `src/api/endpoints.js`, `src/state/store.jsx`, `src/screens/MenuScreen.jsx`. Modify `App.jsx`. Test: `test/menu.test.jsx`.

**Interfaces:**
- Consumes: `apiFetch`.
- Produces:
  - Endpoints: `getMenu()`, `getStore()`, `me()`, `login({email,password})`, `register({...})`, `logout()`, `createOrder(body)`, `getOrder(id)`, `myOrders()`, `cancelOrder(id)`
  - `useStore() → { menu, store, loading, error, reload, productById(id) }`
  - `MenuScreen`: tarjeta "Menú Fino" con chips por categoría (al tocar, hace scroll a la sección `#cat-<id>`) y filas con nombre, línea punteada y precio. La descripción va debajo. Si `variantes.length`, el precio dice "desde $9.500". Botón "+" con `aria-label="Agregar <nombre>"`. Si está agotado, la fila va en gris, dice "Agotado" y no tiene "+". Si `store.aceptaPedidos` es false, muestra el banner `role="status"`: "Fino no está tomando pedidos ahora." (más "Volvé a partir de las HH:MM" si está cerrado por horario y se puede calcular la próxima franja; si no, solo la primera frase). Debajo del logo muestra "Retirás en ~{demoraMin} min".
  - Carga: esqueleto con 3 filas grises. Error: "No pudimos cargar el menú." con un botón "Reintentar".

- [ ] **Step 1: Tests que fallan.**
```js
test('muestra categorías, productos y precios con formato', ...)       // 'Fino', '$14.500', chips 'Hamburguesas' 'Sides'
test('producto con variantes muestra "desde"', ...)                     // 'desde $9.500'
test('agotado sin botón agregar', ...)                                  // queryByLabelText('Agregar Veggie') === null, 'Agotado' visible
test('local pausado muestra banner', ...)                               // role status contiene 'no está tomando pedidos'
test('error de red muestra reintentar y vuelve a pedir', ...)
```
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `"Agregar menú y estado del local en la web"`

---

### Task 3: Carrito, hoja de producto y animación al carrito

**Files:** Create `src/state/cart.jsx`, `src/ui/{CartBar.jsx,ProductSheet.jsx,fly.js}`, `src/screens/CartScreen.jsx`. Modify `MenuScreen.jsx`, `App.jsx`. Test: `test/cart.test.jsx`.

**Interfaces:**
- Produces:
  - Línea: `{ key, productId, variantId?, extras: string[], sinTacc: boolean, aclaracion: string, cantidad, nombre, varianteNombre?, extrasNombres: string[], precioUnitario }`
  - `lineKey(line) = productId|variantId|extras ordenados|sinTacc|aclaracion`. Dos agregados iguales suman cantidad.
  - `cartReducer(state, action)` con acciones `add {line}`, `inc {key}`, `dec {key}` (llega a 0 y se quita), `remove {key}`, `clear`, `flag {productIds}` (marca `unavailable:true`).
  - `useCart() → { lines, count, total, add, inc, dec, remove, clear, flagUnavailable }`, persistido en `localStorage['fino.cart.v1']`. Si al leerlo el JSON está corrupto o le falta un campo, arranca vacío.
  - `unitPrice(product, variantId, extraIds, extras) → number`
  - `ProductSheet`: diálogo `role="dialog"` con nombre `<producto>`. Tiene radios de tamaño (obligatorio si hay variantes), checkboxes de dips (solo en Hamburguesas y Sides), "Pan sin TACC" si `sinTacc`, aclaración de 140 caracteres como máximo y el botón "Agregar · $X". Sin opciones, "+" agrega directo.
  - `CartBar`: fija abajo, con el contador (rebote al cambiar) y el total o "Tu pedido está vacío". "Ver pedido" lleva a `/carrito`.
  - `flyToCart(fromEl, toEl)`: con Web Animations API; con reduced motion no anima.
  - `CartScreen`: líneas con −/+, aclaraciones y total, y "Continuar" a `/checkout`. Vacío: mascota + "Tu pedido está vacío" + "Ver el menú".

- [ ] **Step 1: Tests que fallan.**
```js
test('agregar sin opciones suma al carrito y actualiza la barra', ...)   // click 'Agregar Fino' → barra '1' y '$14.500'
test('dos agregados iguales suman cantidad; con aclaración distinta son líneas separadas', ...) // reducer
test('producto con variantes abre hoja y exige tamaño', ...)            // botón Agregar deshabilitado hasta elegir 'Doble'; total '$13.500'
test('dip suma al precio unitario', ...)                                // Fino + Dip Lula → '$16.500'
test('dec a cero quita la línea', ...)
test('persiste en localStorage y tolera datos corruptos', ...)          // localStorage 'fino.cart.v1' = '{malo' → app carga con carrito vacío
```
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `"Agregar carrito, opciones de producto y animación al carrito"`

---

### Task 4: Sesión: ingresar y registrarse

**Files:** Create `src/state/auth.jsx`, `src/screens/AuthScreen.jsx`. Modify `App.jsx`. Test: `test/auth.test.jsx`.

**Interfaces:**
- Produces:
  - `useAuth() → { user, loading, login, register, logout }`. Al montar llama a `me()`; un 401 deja `user = null`.
  - `<RequireAuth>`: sin usuario redirige a `/ingresar?volver=<ruta>`.
  - `AuthScreen` en `/ingresar`, con pestañas "Ingresar" y "Crear cuenta". Campos con label arriba: Email y Contraseña; al crear cuenta, además Nombre y apellido, y Teléfono. Errores de la API debajo del formulario (`credenciales_invalidas` → "Email o contraseña incorrectos.", `email_en_uso` → "Ya hay una cuenta con ese email. Ingresá con tu contraseña."); los errores de `validacion` van debajo de cada campo. Si sale bien, navega a `volver` o `/`.

- [ ] **Step 1: Tests que fallan.**
```js
test('checkout sin sesión redirige a ingresar y vuelve después del login', ...)
test('registro muestra error de email en uso', ...)
test('login incorrecto muestra mensaje claro', ...)
```
- [ ] **Step 2: Correr** → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS.
- [ ] **Step 5: Commit** `"Agregar ingreso y registro de clientes"`

---

### Task 5: Checkout

**Files:** Create `src/screens/CheckoutScreen.jsx`. Modify `App.jsx`, `state/cart.jsx` si hace falta. Test: `test/checkout.test.jsx`.

**Interfaces:**
- Consumes: `useCart`, `useAuth`, `useStore`, `createOrder`.
- Produces: pantalla `/checkout` (dentro de `RequireAuth`):
  - Resumen del pedido y una nota opcional de 280 caracteres como máximo.
  - "¿Cómo pagás?":
    - "Pagar ahora con Mercado Pago";
    - "Pagar al retirar", con dos opciones: "Efectivo" (campo opcional "¿Con cuánto pagás?", que muestra el vuelto) o "Tarjeta en el local".
  - Botón "Confirmar pedido · $X".
  - `body = { items: lines.map(l => ({productId, variantId, cantidad, aclaracion, sinTacc, extras})), metodoPago, detallePagoLocal?, pagaCon?, nota?, totalEsperado: total }`.
  - Respuestas:

    | Respuesta | Qué pasa |
    |---|---|
    | MP | `window.location.assign(initPoint)` (inyectable para tests vía prop `redirect`) |
    | Pago en el local | `clear()` y navega a `/pedido/:id` |
    | 422 `productos_no_disponibles` | `flagUnavailable(details.productos)`, muestra "Algunos productos se agotaron. Quitalos para seguir." y deshabilita Confirmar mientras queden marcados |
    | 409 `total_cambio` | "Los precios cambiaron. El total ahora es $X." y el botón pasa a "Confirmar con el nuevo total"; el segundo envío manda `totalEsperado = details.total` |
    | 409 `local_no_disponible` | el mensaje de la API |
    | `sin_conexion` | "No hay conexión. Probá de nuevo." |

  - Mientras envía, el botón queda deshabilitado y dice "Enviando…".

- [ ] **Step 1: Tests que fallan.**
```js
test('pago en el local en efectivo manda el body correcto y va al seguimiento', ...)  // body.metodoPago 'local', detallePagoLocal 'efectivo', pagaCon 20000, totalEsperado 14500
test('pago con MP redirige al initPoint', ...)
test('productos agotados se marcan y bloquean confirmar', ...)
test('total cambiado pide reconfirmar y reenvía con el total nuevo', ...)
test('local pausado deshabilita confirmar y muestra el aviso', ...)
```
- [ ] **Step 2: Correr** → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS.
- [ ] **Step 5: Commit** `"Agregar checkout con Mercado Pago o pago en el local"`

---

### Task 6: Seguimiento en vivo

**Files:** Create `src/api/socket.js`, `src/screens/OrderScreen.jsx`. Test: `test/order.test.jsx` (con `vi.mock('../src/api/socket.js')`).

**Interfaces:**
- Produces:
  - `connectSocket() → Socket` (`io(VITE_API_URL ?? '', { withCredentials:true })`) y `subscribeOrder(socket, orderId, onUpdate) → unsubscribe()`. Este último emite `order:subscribe` y escucha `order:updated` (filtrando por `id`); al reconectar vuelve a suscribirse.
  - `OrderScreen` en `/pedido/:id`. Primero `getOrder(id)` y después el socket.

    | Estado | Título | Debajo |
    |---|---|---|
    | `pendiente_pago` | "Esperando el pago" | "Si ya pagaste, en unos segundos se confirma." |
    | `por_aceptar` | "Esperando al local" | |
    | `en_cocina` | "¡Pedido aceptado!" | "Pasá a retirarlo a las" + HH:MM en grande |
    | `para_retirar` | "¡Tu pedido está listo!" | "Mostrá este número en el mostrador" + `numeroLabel` |
    | `entregado` | "¡Que lo disfrutes!" | |
    | `rechazado` | "No pudimos tomar tu pedido" | Motivo legible y "Te devolvimos el pago" si `pago.estado === 'devuelto'` |
    | `cancelado` | "Pedido cancelado" | Con pago MP rechazado: "El pago no se aprobó." y el botón "Volver a intentar", que recarga las líneas al carrito y lleva a `/checkout` |

  - Barra de 4 pasos: Enviado, Aceptado, Listo, Retirado.
  - "Cancelar pedido" en `pendiente_pago` o `por_aceptar`; pide confirmación en la misma página ("¿Seguro? Sí, cancelar").
  - Al cambiar de estado, la tarjeta hace un pequeño rebote.

- [ ] **Step 1: Tests que fallan.**
```js
test('carga el estado por REST antes del socket', ...)              // getOrder en_cocina → 'Pasá a retirarlo a las' y hora
test('actualiza al recibir order:updated', ...)                      // mock subscribeOrder llama onUpdate({estado:'para_retirar'}) → '¡Tu pedido está listo!' y '#0427'
test('cancelar pide confirmación y llama a la API', ...)
test('pago rechazado ofrece volver a intentar con el mismo pedido', ...)
```
- [ ] **Step 2: Correr** → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS.
- [ ] **Step 5: Commit** `"Agregar seguimiento del pedido en vivo"`

---

### Task 7: Mis pedidos, navegación y build

**Files:** Create `src/screens/MyOrdersScreen.jsx`. Modify `App.jsx` (cabecera con "Mis pedidos" / "Ingresar" / "Salir"), `README` en `apps/web`. Test: `test/myorders.test.jsx`.

**Interfaces:**
- Produces: `/mis-pedidos` (RequireAuth) con lista de `numeroLabel`, fecha, estado legible y total. Tocar un pedido lleva a `/pedido/:id`. "Repetir" agrega sus ítems al carrito, pero solo si los productos siguen en el menú y disponibles, y avisa cuántos no se pudieron agregar. Vacío: "Todavía no hiciste pedidos."

- [ ] **Step 1: Tests que fallan.**
```js
test('lista pedidos y lleva al seguimiento', ...)
test('repetir agrega los productos disponibles y avisa los que faltan', ...)
```
- [ ] **Step 2: Correr** → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS, `npm run build -w @fino/web` sin errores.
- [ ] **Step 5: Commit** `"Agregar mis pedidos y navegación de la web"`

---

## Cierre del Plan 2

- `npm test` en verde desde la raíz (shared + server + web).
- Probar a mano con el server real y el seed: pedido en efectivo de punta a punta, viendo el seguimiento cambiar al aceptar con `curl` como staff.
- Siguiente: Plan 3 (app del local).
