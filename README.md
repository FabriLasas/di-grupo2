# FINO · Pedí y retirá

Sistema de pedidos take away para FINO: web del cliente, app del local (tablet) y API.

| Carpeta | Qué es | Puerto en desarrollo |
|---|---|---|
| `apps/web` | Web del cliente (React) | http://localhost:5173 |
| `apps/local` | App del local, PWA para la tablet (React) | http://localhost:5174 |
| `server` | API Express + PostgreSQL + Socket.io | http://localhost:4000 |
| `packages/shared` | Estados, precios y validaciones compartidas | |

## Correrlo en tu computadora

Necesitás **Node.js 22** (https://nodejs.org) y **Docker Desktop** (https://www.docker.com/products/docker-desktop) abierto.

```bash
git clone https://github.com/FabriLasas/di-grupo2.git
cd di-grupo2
git checkout claude/intelligent-einstein-46hl5j
```

Copiá el archivo de configuración (en Windows: `copy .env.example .env`; en Mac/Linux: `cp .env.example .env`). Después:

```bash
npm install
npm run db:up      # levanta PostgreSQL en Docker
npm run setup      # crea las tablas, carga el menú de FINO y deja el local abierto 24 h para probar
npm run dev        # levanta API, web y app del local
```

- Web del cliente: http://localhost:5173
- App del local: http://localhost:5174, usuario `staff@fino.test`, clave `fino1234`

Para ver el tiempo real, abrí las dos en ventanas distintas, hacé un pedido en la web eligiendo **"Pagar al retirar"** y aceptalo en la app del local. Sin credenciales de Mercado Pago el pago online es simulado.

## Tests

```bash
docker compose exec db createdb -U fino fino_test
npm test
```

## Documentación

- Diseño aprobado: `docs/design/propuestas-fino.html` (web, propuesta A) y `docs/design/detalle-pedido.html` (app del local)
- Spec: `docs/superpowers/specs/2026-11-03-fino-takeaway-design.md`
- Planes de implementación: `docs/superpowers/plans/`
