import bcrypt from 'bcryptjs'
import { pathToFileURL } from 'node:url'
import { CATEGORIES, EXTRAS, HORARIO } from './menu-data.js'

/** Carga menú, extras, horario y usuarios del local. Supone tablas vacías. */
export async function seed(prisma) {
  for (const [ci, cat] of CATEGORIES.entries()) {
    await prisma.category.create({
      data: {
        nombre: cat.nombre,
        orden: ci,
        productos: {
          create: cat.productos.map((p, pi) => ({
            nombre: p.nombre,
            descripcion: p.descripcion ?? null,
            precioBase: p.precioBase,
            sinTacc: !!p.sinTacc,
            orden: pi,
            variants: p.variantes ? { create: p.variantes.map(([nombre, precio], vi) => ({ nombre, precio, orden: vi })) } : undefined,
          })),
        },
      },
    })
  }
  await prisma.extra.createMany({ data: EXTRAS.map(([nombre, precio]) => ({ nombre, precio })) })
  await prisma.storeSettings.create({ data: { id: 1, horario: HORARIO, demoraBaseMin: 10 } })
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'fino1234', 10)
  await prisma.user.createMany({
    data: [
      { nombre: 'Admin Fino', email: 'admin@fino.test', telefono: '1100000000', passwordHash, rol: 'admin' },
      { nombre: 'Fabri', email: 'staff@fino.test', telefono: '1100000001', passwordHash, rol: 'staff' },
    ],
  })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const count = await prisma.product.count()
  if (count > 0) console.log('La base ya tiene menú, no se siembra de nuevo.')
  else { await seed(prisma); console.log('Menú de FINO cargado.') }
  await prisma.$disconnect()
}
