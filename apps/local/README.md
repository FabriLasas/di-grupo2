# FINO Comandas (app del local)

PWA en React para la tablet del mostrador. Consume la API de `server/`.

```bash
npm run dev -w @fino/server   # API en :4000
npm run dev -w @fino/local    # http://localhost:5174 (proxy de /api y /socket.io)
npm test -w @fino/local
npm run build -w @fino/local  # apps/local/dist con manifest y service worker
```

Ingresar con un usuario del local (seed: `staff@fino.test` / `fino1234`). Después del login aparece "Tocá para activar el sonido": los navegadores no dejan reproducir audio sin un toque.

Instalar en la tablet: abrir la URL en Chrome y elegir "Instalar app" (o "Agregar a pantalla de inicio"). La app pide mantener la pantalla encendida mientras está abierta.

Si la API está en otro dominio, compilar con `VITE_API_URL=https://api.ejemplo.com` y usar `COOKIE_SAMESITE=none` en el server.
