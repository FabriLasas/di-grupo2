# FINO Take Away: spec de diseño

Fecha: 2026-11-03
Estado: aprobado el diseño visual. Spec pendiente de revisión.

## 1. Objetivo

Sistema de pedidos para retirar en FINO, una hamburguesería. Tiene dos partes:

- **Web del cliente**: el cliente arma el pedido, se registra, paga online o elige pagar en el local, y sigue el estado del pedido.
- **App del local**: PWA en una tablet del mostrador. Recibe los pedidos en tiempo real. El personal entra a cada pedido, fija el tiempo de retiro, lo acepta o lo rechaza, lo pasa por cocina y lo entrega.

**Contexto**: primero es un proyecto de la facultad (parcial). Después se le quiere vender a la marca. Por eso la demo usa pagos de prueba (sandbox), pero la arquitectura tiene que servir para producción sin reescribirse.

**Criterios de éxito**
- Un cliente hace un pedido completo, con cualquiera de los dos medios de pago, en menos de 2 minutos desde el celular.
- El pedido aparece en la tablet en menos de 2 segundos, con sonido.
- Con 10 o más pedidos activos, el personal encuentra cualquier pedido en menos de 5 segundos (por columna o con el buscador).
- Cualquier pedido de los últimos 7 días se puede encontrar en el historial por número, nombre, teléfono o producto.

## 2. Referencias de diseño (aprobadas)

| Pieza | Archivo | Qué se tomó |
|---|---|---|
| Web del cliente | `docs/design/propuestas-fino.html`, propuesta **A · Tablero** | Fondo a cuadros bordó animado, tarjeta crema con líneas punteadas entre nombre y precio, bolita que vuela al carrito, mascota que saluda, barra de carrito fija abajo. |
| App del local | `docs/design/detalle-pedido.html` (versión "hora pico") | Tres columnas con scroll propio, orden por urgencia, colores de tiempo, hoja de detalle con navegación entre pendientes, buscador, pausa de pedidos, historial. |
| Seguimiento del cliente | Teléfono de `detalle-pedido.html` | Pantalla con barra de 4 pasos: Enviado, Aceptado, Listo, Retirado. |

**Tokens de marca**: bordó `#6E1C25`, crema `#F2EEEA`, cuadros `#7B1F2A` / `#661822`, mostaza `#F4B740` para avisos. Tipografías: Anton (títulos), Poppins (texto), IBM Plex Mono (precios y horas). La app del local siempre está en oscuro; la web del cliente siempre en claro, sobre los cuadros.

**Motion**: la web del cliente anima los cuadros, la bolita al carrito, la mascota y el rebote del contador. La app del local solo anima lo que informa algo: tarjeta nueva, destello de columna, cambio de estado. Todo se desactiva con `prefers-reduced-motion`.

## 3. Alcance

### Incluido
- Menú con categorías, productos, variantes (simple/doble/triple), extras (dips), aclaraciones por producto, marca "sin TACC" y "agotado".
- Cuenta de cliente con email y contraseña, e historial de sus pedidos.
- Carrito, checkout, elección de pago (Mercado Pago o pagar al retirar) y seguimiento en vivo.
- App del local: aceptar o rechazar con tiempo de retiro, cocina, listo, entrega con confirmación de cobro, historial, búsqueda, pausar pedidos.
- Admin básico: editar menú, precios y stock, horario de atención, usuarios del local.
- Mercado Pago Checkout Pro (sandbox), webhook de confirmación y devolución automática al rechazar.

### Fuera de alcance (por ahora)
- Delivery, cupones y descuentos (el campo existe en el modelo pero sin interfaz), programa de puntos.
- Login con Google (queda preparado; se agrega al vender).
- Varias sucursales.
- App nativa en tiendas. Es PWA instalable.
- Impresora térmica real: "Reimprimir" usa la impresión del navegador.
- Notificaciones push al cliente: la página de seguimiento se actualiza por socket. Push y WhatsApp quedan para la versión comercial.

## 4. Arquitectura

```
di-grupo2/
  apps/
    web/        React + Vite. Web del cliente (Tablero)
    local/      React + Vite + vite-plugin-pwa. App del local
  server/       Express + PostgreSQL + Socket.io
  packages/
    shared/     Constantes y validaciones compartidas (estados, esquemas zod, formateo de precios)
  docs/
```

- **Monorepo con npm workspaces.** Tres apps que comparten validaciones y la lista de estados.
- **Lenguaje**: JavaScript con JSDoc. Se migra a TypeScript si la cátedra lo permite (ver decisiones abiertas).
- **Base de datos**: PostgreSQL con **Prisma** para el esquema, las migraciones y el seed del menú real.
- **Tiempo real**: Socket.io sobre el mismo servidor Express. Hay dos salas:
  - `local` (autenticada, rol staff): recibe todos los pedidos.
  - `order:<id>` (el cliente dueño del pedido): solo los cambios de su pedido.
- **Autenticación**: JWT en cookie `httpOnly` y `SameSite=Lax`, contraseñas con bcrypt. El socket se autentica con la misma cookie.
- **Pagos**: SDK oficial `mercadopago` en el servidor. El front nunca ve el access token.
- **Hosting (demo)**: el front en Vercel o Netlify, el server en Render o Railway, Postgres en Neon o Supabase. Todo en planes gratuitos.

### Unidades y responsabilidades (server)

| Módulo | Hace | Depende de |
|---|---|---|
| `auth` | Registro, login, logout, sesión actual y roles | `users` |
| `menu` | CRUD de categorías, productos y variantes; disponibilidad | Prisma |
| `orders` | Crear pedido, cálculo de precios en el servidor, máquina de estados, historial y búsqueda | `menu`, `payments`, `realtime` |
| `payments` | Crear preferencia de MP, recibir el webhook, devolver pagos | SDK de MP |
| `realtime` | Emitir eventos a las salas; no tiene lógica de negocio | Socket.io |
| `store` | Horario, pausa de pedidos, demora actual | Prisma |

Regla: **solo `orders` cambia el estado de un pedido**, y siempre a través de una única función `transition(order, evento, actor)` que valida la transición, guarda el evento en la línea de tiempo y emite el socket.

## 5. Modelo de datos

```
User           id, nombre, email (único), telefono, passwordHash, rol (cliente | staff | admin), creadoEn
Category       id, nombre, orden, activa
Product        id, categoriaId, nombre, descripcion, precioBase, sinTacc (bool), agotado (bool), orden, activo
Variant        id, productoId, nombre ("Simple", "Doble", "Triple"), precio
Extra          id, nombre ("Dip Fino"), precio, activo
Order          id, numero (secuencial, se muestra como #0427), clienteId, estado, metodoPago (mp | local),
               detallePagoLocal (efectivo | tarjeta), pagaCon (nullable), total, nota,
               minutosRetiro, retiroEstimado, creadoEn, aceptadoEn, listoEn, entregadoEn,
               aceptadoPorId, motivoRechazo
OrderItem      id, pedidoId, productoId, varianteId, cantidad, precioUnitario (copiado al crear), aclaracion, sinTacc
OrderItemExtra id, itemId, extraId, precio
OrderEvent     id, pedidoId, tipo, actorId (nullable), detalle (json), creadoEn   ← línea de tiempo del historial
OrderNote      id, pedidoId, autorId, texto, creadoEn                              ← "Agregar nota" / reclamos
Payment        id, pedidoId, mpPreferenceId, mpPaymentId, estado (pendiente | aprobado | rechazado | devuelto), monto, raw (json)
StoreSettings  id, abierto (bool), pausado (bool), horario (json por día), demoraBaseMin
```

Los precios se copian al pedido en el momento de crearlo, así un cambio de precio no altera los pedidos viejos. El total **siempre lo calcula el servidor**: el precio que manda el cliente se ignora.

## 6. Estados del pedido

```
                      ┌─────────────── cancelar (cliente) ───────────────┐
                      │                                                  ▼
pendiente_pago ──(webhook MP aprobado)──► por_aceptar ──aceptar──► en_cocina ──listo──► para_retirar ──entregar──► entregado
      │                                       │                                              │
      └── (pago rechazado / 30 min) ──► cancelado      rechazar ──► rechazado                └── no_retirado (manual)
```

- Pago en el local: el pedido nace en `por_aceptar`.
- Mercado Pago: el pedido nace en `pendiente_pago` y **no aparece en la tablet** hasta que el webhook confirma el pago.
- `aceptar` exige `minutosRetiro`, entre 5 y 90 en pasos de 5, y calcula `retiroEstimado`.
- `rechazar` exige un motivo (sin stock, local cerrando, demasiados pedidos u otro). Si estaba pagado, dispara la devolución en MP.
- `entregar` con pago en el local exige la confirmación de cobro; el front muestra "¿Cobraste $X?".
- El cliente solo puede cancelar mientras el pedido está en `pendiente_pago` o `por_aceptar`.
- Cualquier otra transición devuelve `409 Conflict`.
- Cada transición crea un `OrderEvent` con el actor, y eso arma la línea de tiempo del historial.

## 7. API (REST, prefijo `/api`)

| Método y ruta | Rol | Descripción |
|---|---|---|
| `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | público / sesión | Cuenta |
| `GET /menu` | público | Categorías con productos, variantes, extras y disponibilidad |
| `GET /store` | público | Abierto, pausado, demora actual, horario |
| `POST /orders` | cliente | Crea el pedido. Con MP devuelve `init_point` para redirigir |
| `GET /orders/mine`, `GET /orders/:id` | cliente (dueño) | Historial y seguimiento |
| `POST /orders/:id/cancel` | cliente | Cancela si el estado lo permite |
| `GET /staff/orders?estado=activos` | staff | Tablero: por aceptar, en cocina, para retirar |
| `POST /staff/orders/:id/accept` `{minutos}` | staff | |
| `POST /staff/orders/:id/reject` `{motivo}` | staff | |
| `POST /staff/orders/:id/ready` | staff | |
| `POST /staff/orders/:id/deliver` `{cobroConfirmado}` | staff | |
| `POST /staff/orders/:id/not-picked-up` | staff | |
| `POST /staff/orders/:id/refund` | staff | Devolución manual desde el historial |
| `POST /staff/orders/:id/notes` `{texto}` | staff | |
| `GET /staff/orders/history?q=&estado=&desde=&hasta=&page=` | staff | Búsqueda por número, nombre, teléfono o producto |
| `PATCH /staff/store` `{pausado}` | staff | Pausar o reanudar pedidos |
| `/admin/menu/*`, `/admin/users/*`, `PATCH /admin/store` | admin | Gestión del menú, usuarios y horario |
| `POST /payments/webhook` | Mercado Pago | Verifica la firma `x-signature`, consulta el pago a MP y aplica la transición |

**Eventos de socket**
- Sala `local`: `order:new`, `order:updated`, `store:updated`.
- Sala `order:<id>`: `order:updated`, con el estado, el `retiroEstimado` y el número.

**Demora actual** = `demoraBaseMin` + 2,5 min por cada pedido en cocina, redondeado a 5 y limitado entre 15 y 45. El tiempo sugerido es esa demora, más 5 minutos si el pedido tiene 6 productos o más.

## 8. Web del cliente (apps/web)

**Pantallas**
1. **Menú**: tarjeta Tablero, chips de categorías con scroll a la sección, productos agotados en gris y sin "+".
2. **Producto**: hoja inferior para elegir variante, extras y aclaración. Solo se abre si el producto tiene opciones; si no, "+" lo agrega directo.
3. **Carrito**: cantidades, aclaraciones, total y "Retirás en ~N min".
4. **Ingresar / Registrarse**: se pide al confirmar, no para mirar el menú. Datos: nombre, email, teléfono y contraseña.
5. **Checkout**:
   - Pago: Mercado Pago, o pagar al retirar (efectivo o tarjeta; si es efectivo, "¿Con cuánto pagás?" para calcular el vuelto).
   - Confirmar.
6. **Seguimiento `/pedido/:id`**: barra de 4 pasos, hora de retiro grande, número de pedido, "Cancelar" mientras se pueda. Se actualiza por socket.
7. **Mis pedidos**: lista con "Repetir pedido".

**Estados especiales**
- Local cerrado o pausado: banner arriba ("Fino no está tomando pedidos ahora, volvé a las 20:00"). El menú se puede ver, pero no se puede confirmar.
- Producto agotado mientras está en el carrito: al confirmar, el servidor responde `422` con la lista y el carrito marca esos productos.
- Mercado Pago: después del pago vuelve a `/pedido/:id`. Si el pago falló, muestra "El pago no se aprobó" con un botón para reintentar.

## 9. App del local (apps/local)

Es la del diseño aprobado. Detalles para implementarla:

- **Login de staff** con usuario del local. La sesión dura 12 horas.
- **Barra superior**:
  - pestañas En curso (con la cantidad) e Historial;
  - buscador de pedidos activos;
  - "Demora actual" y el botón Recibiendo / Pausado;
  - reloj.
- **Tablero**:

  | Columna | Orden | Avisos y acciones |
  |---|---|---|
  | Por aceptar | Más viejo primero | Antigüedad en amarillo desde 3 min y en rojo desde 5 min |
  | En cocina | Por `retiroEstimado` | Cuenta regresiva; amarillo cuando faltan 5 min o menos, rojo "Atrasado" al pasarse |
  | Para retirar | Esperando hace más | Cartel "Cobrar $X" si paga en el local |

- **Hoja de detalle**:
  - "Pedido N de M por aceptar", con flechas para navegar;
  - ticket con cantidad, producto, variante, aclaración y subtotal; nota del cliente;
  - pago (medio y número de operación, o efectivo con vuelto);
  - tiempo de retiro (opciones con sugerido, +/− 5 min) y la hora en grande;
  - "Aceptar · retiro HH:MM" y "Rechazar" con motivo.

  Al decidir, se abre el siguiente pendiente.
- **Sonido**:
  - un "ding" al entrar un pedido;
  - si un pedido lleva 5 min sin aceptar, suena otra vez cada 60 s.

  El navegador exige una interacción para habilitar el audio, así que al iniciar sesión se muestra "Tocá para activar el sonido".
- **Wake lock** para que la tablet no se apague, y **reconexión automática** del socket: al reconectar vuelve a pedir `GET /staff/orders` para no perder pedidos. Mientras no hay conexión se muestra un banner rojo "Sin conexión".
- **Historial**:
  - búsqueda y filtros por estado y fecha, con paginación de 50;
  - detalle con línea de tiempo y notas;
  - Reimprimir, Devolver pago y Agregar nota.

## 10. Errores y casos borde

| Caso | Comportamiento |
|---|---|
| Dos personas aceptan el mismo pedido | `transition` usa un update condicional (`WHERE estado = 'por_aceptar'`). El segundo recibe `409` y la tablet muestra "Ya lo aceptó Agus". |
| Webhook de MP repetido o fuera de orden | Idempotente por `mpPaymentId`. Si el pedido ya avanzó, solo se registra. |
| Webhook que nunca llega | Un job cada 5 min consulta en MP los pedidos en `pendiente_pago` con más de 2 min. Después de 30 min, pasa a `cancelado`. |
| Falla la devolución en MP | El pedido queda `rechazado` con el pago en "devolución pendiente", y el historial muestra el aviso y el botón para reintentar. |
| La tablet pierde la conexión | Banner, reintentos y recarga del tablero al volver. |
| El cliente cierra la web en el seguimiento | Al volver a `/pedido/:id` se recupera el estado por REST. |
| El precio cambia entre el carrito y la confirmación | El servidor recalcula; si el total difiere, responde `409` con el total nuevo y el front lo muestra antes de confirmar. |

## 11. Testing

- **Server (Vitest + Supertest)**:
  - tabla completa de transiciones válidas e inválidas de `transition`;
  - cálculo del total;
  - idempotencia del webhook, con MP simulado;
  - permisos por rol;
  - búsqueda del historial.
- **Integración**: Postgres real en Docker para los tests de `orders`.
- **Front (Vitest + Testing Library)**: carrito y cálculo de totales en la web; orden de las columnas, colores de tiempo y flujo de la hoja de detalle en la app del local.
- **E2E (Playwright)**: un flujo feliz por medio de pago, de la web a la tablet a entregado, con dos navegadores.

## 12. Decisiones abiertas (para confirmar con la cátedra o el grupo)

1. **JavaScript o TypeScript.** Este spec asume JS con JSDoc.
2. **Prisma o SQL directo con `pg`.** Este spec asume Prisma; si la cátedra pide SQL a mano, solo cambia la capa de datos.
3. **Fotos de productos.** El diseño funciona sin fotos, pero conviene pedirle a FINO fotos reales antes de la versión comercial.
4. **Horario real de FINO y tiempo base de preparación** (`demoraBaseMin`).
