import { PrismaClient } from '@prisma/client'
import { seed } from '../prisma/seed.js'

export const prisma = new PrismaClient()

const TABLES = ['OrderItemExtra', 'OrderItem', 'OrderEvent', 'OrderNote', 'Payment', 'Order', 'Variant', 'Product', 'Category', 'Extra', 'StoreSettings', 'User']

/** Vacía todas las tablas, reinicia secuencias y vuelve a sembrar. */
export async function resetDb(db = prisma) {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
  await seed(db)
}
