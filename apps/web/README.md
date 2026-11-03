# FINO Web del cliente

React + Vite con el diseño "Tablero". Consume la API de `server/`.

```bash
npm run dev -w @fino/server   # API en :4000
npm run dev -w @fino/web      # web en http://localhost:5173 (proxy de /api y /socket.io al :4000)
npm test -w @fino/web
npm run build -w @fino/web    # genera apps/web/dist
```

En producción, si la API está en otro dominio, definir `VITE_API_URL=https://api.ejemplo.com` al compilar y `COOKIE_SAMESITE=none` en el server.

Rutas: `/` menú, `/carrito`, `/ingresar`, `/checkout`, `/pedido/:id` (seguimiento en vivo), `/mis-pedidos`.
