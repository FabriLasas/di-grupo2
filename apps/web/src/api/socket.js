import { io } from 'socket.io-client'

/** Conexión de tiempo real con la cookie de sesión. */
export function connectSocket() {
  return io(import.meta.env.VITE_API_URL ?? '', { withCredentials: true, transports: ['websocket', 'polling'] })
}

/** Se suscribe a los cambios de un pedido; se re-suscribe al reconectar. Devuelve la función para cortar. */
export function subscribeOrder(socket, orderId, onUpdate) {
  const join = () => socket.emit('order:subscribe', { orderId })
  const handler = (dto) => { if (dto?.id === orderId) onUpdate(dto) }
  socket.on('connect', join)
  socket.on('order:updated', handler)
  if (socket.connected) join()
  return () => { socket.off('connect', join); socket.off('order:updated', handler) }
}
