import { io } from 'socket.io-client'

/** Conexión de tiempo real del local (la cookie de sesión la une a la sala "local"). */
export function connectSocket() {
  return io(import.meta.env.VITE_API_URL ?? '', { withCredentials: true, transports: ['websocket', 'polling'] })
}
