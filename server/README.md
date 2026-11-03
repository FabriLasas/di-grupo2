# FINO API

Express + PostgreSQL (Prisma) + Socket.io. Atiende la web del cliente y la app del local.

## Levantar en local

```bash
cp .env.example .env          # completar JWT_SECRET y, si hay, credenciales de Mercado Pago
npm install
npm run db:up                 # Postgres 16 en Docker (usuario/clave fino/fino)
npm run db:migrate -w @fino/server
npm run db:seed -w @fino/server
npm run dev -w @fino/server   # http://localhost:4000/api/health
```

Usuarios del seed: `admin@fino.test` y `staff@fino.test`, con la clave de `SEED_PASSWORD` (por defecto `fino1234`).

## Tests

Necesitan una base `fino_test` (misma instancia de Postgres):

```bash
docker compose exec db createdb -U fino fino_test
npm test
```

## Mercado Pago (sandbox)

1. Crear credenciales de prueba en el panel de desarrolladores de Mercado Pago y poner `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` en `.env`.
2. Exponer el server con un túnel (por ejemplo `cloudflared tunnel --url http://localhost:4000`) y poner esa URL en `PUBLIC_URL`, así el webhook llega a `/api/payments/webhook`.
3. Sin `MP_ACCESS_TOKEN` el server usa un gateway simulado.

Cada 5 minutos el server consulta en Mercado Pago los pedidos que siguen pendientes de pago por si el webhook no llegó. A los 30 minutos sin pago los cancela.
