# FINO App del Local Implementation Plan (Plan 3 de 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA en React para la tablet del mostrador. Recibe pedidos en tiempo real con sonido, los acepta con tiempo de retiro, los pasa por cocina y retiro, y tiene historial con búsqueda, tal como el diseño "hora pico" aprobado.

**Architecture:** SPA Vite en `apps/local`, siempre en tema oscuro. `api/` (cliente fetch y socket), `state/board.jsx` (reducer del tablero: pedidos por id, aplica eventos del socket y recargas completas), `screens/` (Login, Board, History), `ui/` (Card, Sheet, Bar). El reloj se inyecta (`useNow`) para testear colores de tiempo con fake timers.

**Tech Stack:** Igual que el Plan 2 (React 19.3.1, React Router 8.5.0, Vite 8.3.4, socket.io-client 4.8.1, Vitest 5 + Testing Library), más vite-plugin-pwa 2.0.0.

**Spec:** `docs/superpowers/specs/2026-11-03-fino-takeaway-design.md` (sección 9). Diseño: `docs/design/detalle-pedido.html`.

## Global Constraints

- Colores y fuentes del diseño "hora pico": fondo `#1A0B0E`, tarjetas `#26110F`, borde `#3A1C20`, mostaza `#F4B740`, atrasado `#FF6B5E`, ok `#2F8F5B`. Anton, Poppins e IBM Plex Mono.
- Orden de las columnas:

  | Columna | Orden |
  |---|---|
  | Por aceptar | `creadoEn` ascendente |
  | En cocina | `retiroEstimado` ascendente |
  | Para retirar | `listoEn` ascendente |

- Colores de tiempo:

  | Columna | Amarillo | Rojo |
  |---|---|---|
  | Por aceptar | 3 min o más | 5 min o más |
  | En cocina | faltan 5 min o menos | ya pasó la hora: "Atrasado mm:ss" |
  | Para retirar | 5 min o más esperando | 10 min o más esperando |

- Tiempo de retiro: opciones 10, 15, 20, 25, 30, 45 más el sugerido (`sugeridoMin` de la API) y ±5. Se limita a 5..90.
- Botones de 48 px o más; el de aceptar, 60 px.
- Solo pueden entrar los roles `staff` o `admin`. Si entra un cliente: "Esta cuenta no es del local."
- Sonido: "ding" con Web Audio al recibir `order:new`; si hay algún pedido en "Por aceptar" con 5 min o más, vuelve a sonar cada 60 s. Se habilita con el botón "Activar sonido" después del login.
- Al reconectar el socket se recarga `GET /api/staff/orders`. Sin conexión: banner "Sin conexión. Reintentando…".
- `prefers-reduced-motion` apaga las animaciones.

## Review Focus

1. **Un evento del socket que llega antes de la carga inicial, o duplicado**: el reducer lo aplica por id y la recarga completa manda. Nunca quedan tarjetas duplicadas. (Test en Task 5.)
2. **Otro empleado aceptó el pedido abierto en la hoja (409)**: se muestra "Ya lo tomó otra persona", se cierra y se abre el siguiente pendiente. (Test en Task 3.)
3. **El pedido desaparece de "Por aceptar" mientras la hoja está abierta (lo canceló el cliente)**: la hoja avisa "El cliente canceló este pedido" y no deja aceptar. (Test en Task 5.)
4. **La tablet se queda sin conexión y vuelve**: el banner aparece y se va, y el tablero se recarga. (Test en Task 5.)
5. **Búsqueda con `#`, espacios o mayúsculas** en el tablero y en el historial: encuentra igual. (Tests en Task 2 y Task 6.)

---

## File Structure

```
apps/local/
  package.json  vite.config.js  index.html  public/icon-192.png  public/icon-512.png
  src/main.jsx  src/App.jsx
  src/styles/{tokens.css,app.css}
  src/api/client.js            copia de apps/web (apiFetch, ApiError)
  src/api/endpoints.js         login, me, logout, board, accept, reject, ready, deliver, notPickedUp, refund, addNote, history, detail, setPaused
  src/api/socket.js            connectSocket()
  src/state/auth.jsx           AuthProvider (rechaza clientes), RequireStaff
  src/state/board.jsx          boardReducer, BoardProvider, useBoard
  src/state/clock.js           useNow(intervalMs)
  src/state/alerts.js          createDinger(), useWakeLock()
  src/ui/{TopBar,Lane,OrderCard,DetailSheet,Toast}.jsx
  src/lib/time.js              ageState, dueState, waitState, hhmm, mmss
  src/screens/{LoginScreen,BoardScreen,HistoryScreen}.jsx
  test/{setup.js,utils.jsx,*.test.jsx}
```

---

### Task 1: Scaffold, login del personal y barra superior

**Files:** `apps/local/*` base, `src/api/{client,endpoints}.js`, `src/state/auth.jsx`, `src/screens/LoginScreen.jsx`, `src/ui/TopBar.jsx`, `src/App.jsx`. Test: `test/login.test.jsx`.

**Interfaces:**
- Produces:
  - `useAuth() → { user, loading, login, logout }`. `login` lanza `ApiError(403, 'no_es_local')` si el rol es `cliente`, y además llama a `logout()` en el server.
  - `RequireStaff` → `/ingresar` si no hay sesión.
  - `TopBar({ tab, onTab, counts, query, onQuery, delayMin, paused, onTogglePause, now })`: pestañas "En curso" (con la cantidad) e "Historial", buscador "Buscar #, nombre o teléfono", "Demora actual N min", botón "Recibiendo"/"Pausado" y reloj HH:MM.
- [ ] **Step 1: Tests.**
```js
test('staff ingresa y ve el tablero', ...)                     // POST login → heading 'Por aceptar'
test('cuenta de cliente no entra', ...)                        // alert 'Esta cuenta no es del local.'
test('credenciales malas muestran el error', ...)
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `"Agregar app del local: scaffold, ingreso del personal y barra superior"`

---

### Task 2: Tablero de tres columnas

**Files:** `src/state/{board.jsx,clock.js}`, `src/lib/time.js`, `src/ui/{Lane,OrderCard}.jsx`, `src/screens/BoardScreen.jsx`. Test: `test/board.test.jsx`, `test/time.test.js`.

**Interfaces:**
- Produces:
  - `boardReducer(state, action)`. El estado es `{ byId: Record<id, OrderDTO & {sugeridoMin?}>, demoraMin, loaded }`. Acciones: `load {porAceptar, enCocina, paraRetirar, demoraMin}` (reemplaza todo), `upsert {order}` (si el estado es terminal o `pendiente_pago`, lo quita), `remove {id}`.
  - `selectLanes(state, query) → { porAceptar, enCocina, paraRetirar }`, ordenadas según las Global Constraints. `query` filtra por número (con o sin `#`), nombre o teléfono, sin distinguir mayúsculas.
  - `ageState(creadoEn, now) → 'ok'|'warn'|'late'`, `dueState(retiroEstimado, now) → {state, label}` ("Faltan 02:58" o "Atrasado 02:02") y `waitState(listoEn, now)`.
  - `OrderCard({ order, kind: 'new'|'cook'|'ready', now, onOpen, onReady, onDeliver, onNotPickedUp })`:

    | Tipo | Muestra |
    |---|---|
    | `new` | número, antigüedad, cliente corto, unidades, total, pago y "Ver pedido" |
    | `cook` | número, cuenta regresiva, "Retira HH:MM" y la lista de ítems con cantidades grandes y aclaraciones resaltadas (variante, dips, "Pan sin TACC", aclaración), nota, "Listo para retirar" |
    | `ready` | número, espera, nombre, cartel "Cobrar $X" (efectivo o tarjeta) o "Pagado online", "Entregar" |

- [ ] **Step 1: Tests.**
```js
test('ageState/dueState/waitState con umbrales', ...)          // 2:59 ok, 3:00 warn, 5:00 late; faltan 5:00 warn; -0:01 late 'Atrasado 00:01'
test('carga el tablero y ordena cada columna', ...)
test('cocina muestra los productos y aclaraciones', ...)        // '2' 'Cheeseburger' 'Simple' '1 sin pepinillos'
test('buscador filtra por #número y nombre', ...)              // '#0419' y 'LUCÍA' resaltan solo esa tarjeta
test('los colores de tiempo cambian con el reloj', ...)        // fake timers avanzan 3 min → tarjeta con clase warn
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `"Agregar tablero de pedidos en tres columnas con colores de tiempo"`

---

### Task 3: Hoja de detalle: aceptar y rechazar

**Files:** `src/ui/{DetailSheet,Toast}.jsx`. Modify `BoardScreen.jsx`. Test: `test/sheet.test.jsx`.

**Interfaces:**
- Consumes: `selectLanes`, endpoints `accept(id, minutos)` y `reject(id, motivo)`.
- Produces: `DetailSheet({ order, position: {index, total}, onPrev, onNext, onClose, onAccepted, onRejected, now })`.
  - Cabecera "Pedido N de M por aceptar" con flechas y ✕ (también Escape).
  - Ticket con cantidad, producto, variante, extras, aclaración y subtotal; nota del cliente.
  - Pago: "Pagado online" con número de operación, o "Paga al retirar" con efectivo o tarjeta y el vuelto.
  - Tiempo: grilla de opciones con "SUGERIDO", ±5 y "Listo para retirar a las HH:MM".
  - Botones "Aceptar · retiro HH:MM" y "Rechazar", que muestra 4 motivos (Sin stock / Local cerrando / Demasiados pedidos / Otro motivo).
  - Al aceptar o rechazar: toast y se abre el siguiente pendiente; si no hay más, se cierra.
  - Un 409 muestra el toast "Ya lo tomó otra persona." y pasa al siguiente.
- [ ] **Step 1: Tests.**
```js
test('abre en el primero, muestra sugerido y navega entre pendientes', ...)
test('aceptar manda minutos elegidos y abre el siguiente', ...)    // POST accept {minutos:25}; 'Pedido 1 de 1'
test('rechazar exige motivo y manda el elegido', ...)             // {motivo:'sin_stock'}
test('409 al aceptar avisa y sigue con el próximo', ...)
test('minutos no bajan de 5 ni pasan 90', ...)
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `"Agregar hoja de detalle para aceptar o rechazar pedidos"`

---

### Task 4: Cocina y retiro

**Files:** Modify `OrderCard.jsx`, `BoardScreen.jsx`. Test: `test/flow.test.jsx`.

**Interfaces:**
- Produces:
  - En cocina: "Listo para retirar" → `ready(id)`.
  - En retiro, efectivo o tarjeta: "Entregar" → confirmación en la tarjeta ("¿Cobraste $X?" con [Volver] [Sí, entregar]) → `deliver(id, true)`.
  - En retiro, MP: "Entregar" → `deliver(id, false)` directo.
  - Link "No lo retiró" → confirmación → `notPickedUp(id)`.
  - Cada acción actualiza el tablero con la respuesta (`upsert`) y muestra un toast.
- [ ] **Step 1: Tests.**
```js
test('listo mueve la tarjeta a Para retirar', ...)
test('entregar efectivo pide confirmar cobro', ...)              // body {cobroConfirmado:true}
test('entregar pagado online no pide confirmación', ...)
test('no retirado pide confirmación', ...)
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `"Agregar acciones de cocina y entrega con confirmación de cobro"`

---

### Task 5: Tiempo real, sonido, pausa y conexión

**Files:** `src/api/socket.js`, `src/state/alerts.js`. Modify `board.jsx`, `BoardScreen.jsx`, `TopBar.jsx`. Test: `test/realtime.test.jsx` (socket simulado con un emisor de eventos).

**Interfaces:**
- Produces:
  - `connectSocket() → socket` (la conexión de Socket.io).
  - Comportamiento de `BoardProvider`:

    | Evento | Qué hace |
    |---|---|
    | `order:new` | `upsert`, suena `ding()`, destella la columna "Por aceptar" |
    | `order:updated` | `upsert` |
    | `store:updated` | actualiza la demora y la pausa |
    | `connect`, después de un `disconnect` | recarga el board |
    | `disconnect` | `online=false` |

  - `createDinger(audioCtxFactory) → { unlock(), ding() }`, con 2 tonos de 880 Hz y 660 Hz de 120 ms. `ding` no hace nada si no se desbloqueó.
  - Re-alerta: un intervalo de 60 s llama a `ding()` si hay algún pedido "Por aceptar" con 5 min o más.
  - Pausa: `setPaused(bool)` → `PATCH /api/staff/store`; la barra muestra "Pausado" y el banner "Pedidos pausados…".
  - Si el pedido abierto en la hoja pasa a otro estado por el socket, se muestra el aviso de la Review Focus 3.
- [ ] **Step 1: Tests.**
```js
test('order:new agrega la tarjeta y suena', ...)
test('evento duplicado o previo a la carga no duplica tarjetas', ...)
test('order:updated a cancelado la quita y avisa en la hoja abierta', ...)
test('desconexión muestra banner y reconexión recarga', ...)
test('pausar llama a la API y muestra el banner', ...)
test('re-alerta cada 60 s si hay pedidos de 5 min sin aceptar', ...)  // fake timers
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `"Agregar tiempo real, alertas sonoras, pausa y estado de conexión"`

---

### Task 6: Historial

**Files:** `src/screens/HistoryScreen.jsx`. Modify `App.jsx` y `endpoints.js`. Test: `test/history.test.jsx`.

**Interfaces:**
- Consumes: `GET /api/staff/orders/history?q&estado&desde&hasta&page` y `GET /api/staff/orders/:id`.
- Produces:
  - Filtros: Todos / Entregados / Rechazados / Cancelados / No retirados.
  - Fecha: Hoy / Ayer / Últimos 7 días, que se convierte en `desde`/`hasta` YYYY-MM-DD en Buenos Aires con el corte de las 06:00, igual que el server.
  - Buscador compartido con la barra: en esta pestaña busca en el historial, con 300 ms de espera.
  - Resumen "N pedidos · $X entregado".
  - Tabla con Pedido, Hora, Cliente/teléfono, Total, Pago, Estado y "!" si tiene notas; "Cargar más" pide la página siguiente.
  - Panel de detalle con estado, cliente, ítems, total, pago, línea de tiempo (hora + evento legible + actor) y notas.
  - Acciones: "Reimprimir ticket" (`window.print()` con una vista de ticket), "Devolver pago" (si hay pago aprobado o con devolución pendiente; pide confirmación) y "Agregar nota" (textarea + Guardar).
- [ ] **Step 1: Tests.**
```js
test('lista el historial de hoy con resumen', ...)
test('buscar manda q sin espacios extra y filtra por estado', ...)
test('detalle muestra la línea de tiempo legible', ...)          // 'Aceptado por Fabri'
test('agregar nota la guarda y aparece', ...)
test('devolver pago pide confirmación', ...)
test('cargar más pide page=2', ...)
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `"Agregar historial con búsqueda, detalle, notas y devoluciones"`

---

### Task 7: PWA, pantalla encendida y build

**Files:** `vite.config.js` (VitePWA: `registerType:'autoUpdate'`, manifest `name:'FINO Comandas'`, `display:'standalone'`, `orientation:'landscape'`, `theme_color:'#1A0B0E'`, iconos 192/512 generados del logo), `src/state/alerts.js` (`useWakeLock`), botón "Activar sonido", `apps/local/README.md`. Test: `test/pwa.test.jsx`.

**Interfaces:**
- Produces: `useWakeLock()` pide `navigator.wakeLock.request('screen')` cuando está disponible y lo vuelve a pedir en `visibilitychange`. Si falla, no hace nada. La capa "Tocá para activar el sonido" aparece después del login y llama a `unlock()`.
- [ ] **Step 1: Tests.**
```js
test('pide wake lock si existe', ...)
test('activar sonido desbloquea el audio y oculta la capa', ...)
```
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS, y `npm run build -w @fino/local` genera `manifest.webmanifest` y `sw.js`.
- [ ] **Step 5: Commit** `"Agregar PWA instalable, pantalla siempre encendida y activación de sonido"`

---

## Cierre del Plan 3

- `npm test` en verde en todo el monorepo.
- Prueba E2E con dos navegadores: un cliente pide desde la web, la tablet lo recibe al instante, se acepta, se marca listo y se entrega; el cliente ve cada cambio.
