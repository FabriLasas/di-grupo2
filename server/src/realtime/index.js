import { Server } from 'socket.io'
import { COOKIE, verifySession } from '../auth/service.js'

function readCookie(header = '', name) {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

/**
 * Socket.io sobre el servidor HTTP. Sala "local" para el personal y "order:<id>" por pedido.
 * @returns {{io: Server, emitOrder: (dto: object, event: string) => void, emitStore: (status: object) => void}}
 */
export function attachRealtime(httpServer, { prisma, config }) {
  const io = new Server(httpServer, { cors: { origin: [config.webUrl, config.localUrl], credentials: true } })

  io.use((socket, next) => {
    const claims = verifySession(readCookie(socket.handshake.headers.cookie, COOKIE), config.jwtSecret)
    if (!claims) return next(new Error('no_autenticado'))
    socket.data.user = { id: claims.sub, rol: claims.rol }
    next()
  })

  io.on('connection', (socket) => {
    const { user } = socket.data
    if (user.rol === 'staff' || user.rol === 'admin') socket.join('local')

    socket.on('order:subscribe', async (msg, ack = () => {}) => {
      const orderId = typeof msg?.orderId === 'string' ? msg.orderId : null
      const order = orderId && await prisma.order.findUnique({ where: { id: orderId }, select: { clienteId: true } })
      const allowed = order && (order.clienteId === user.id || user.rol !== 'cliente')
      if (!allowed) return ack({ ok: false, error: 'no_encontrado' })
      socket.join(`order:${orderId}`)
      ack({ ok: true })
    })
  })

  return {
    io,
    emitOrder(dto, event) {
      io.to(`order:${dto.id}`).emit('order:updated', dto)
      if (dto.estado !== 'pendiente_pago') io.to('local').emit(event, dto)
    },
    emitStore(status) {
      io.emit('store:updated', status)
    },
  }
}
