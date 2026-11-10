// Solo para probar: deja el local abierto las 24 h y sin pausa.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const horario = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [['00:00', '23:59']]]))
await prisma.storeSettings.update({ where: { id: 1 }, data: { horario, abierto: true, pausado: false } })
console.log('Local abierto las 24 h para pruebas.')
await prisma.$disconnect()
