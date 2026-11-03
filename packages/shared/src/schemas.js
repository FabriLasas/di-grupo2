import { z } from 'zod'
import { REJECT_REASONS, TERMINAL_STATES } from './states.js'

export const registerSchema = z.object({
  nombre: z.string().trim().min(2).max(60),
  email: z.email().trim().toLowerCase(),
  telefono: z.string().trim().min(8).max(20),
  password: z.string().min(8).max(100),
})

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
})

export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1).optional(),
    cantidad: z.number().int().min(1).max(20),
    aclaracion: z.string().trim().max(140).optional(),
    sinTacc: z.boolean().optional(),
    extras: z.array(z.string().min(1)).max(10).optional(),
  })).min(1).max(50),
  metodoPago: z.enum(['mp', 'local']),
  detallePagoLocal: z.enum(['efectivo', 'tarjeta']).optional(),
  pagaCon: z.number().int().positive().optional(),
  nota: z.string().trim().max(280).optional(),
  totalEsperado: z.number().int().nonnegative(),
}).refine((o) => o.metodoPago !== 'local' || !!o.detallePagoLocal, {
  message: 'Elegí efectivo o tarjeta para pagar en el local', path: ['detallePagoLocal'],
})

export const acceptSchema = z.object({
  minutos: z.number().int().min(5).max(90).refine((m) => m % 5 === 0, 'Debe ser múltiplo de 5'),
})
export const rejectSchema = z.object({ motivo: z.enum(REJECT_REASONS) })
export const deliverSchema = z.object({ cobroConfirmado: z.boolean() })
export const noteSchema = z.object({ texto: z.string().trim().min(1).max(500) })

export const historyQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  estado: z.enum(TERMINAL_STATES).optional(),
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
})
