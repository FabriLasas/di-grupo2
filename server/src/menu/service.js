/** Menú público: categorías activas con productos activos, variantes y extras, ordenados. */
export async function getMenu(prisma) {
  const cats = await prisma.category.findMany({
    where: { activa: true },
    orderBy: { orden: 'asc' },
    include: { productos: { where: { activo: true }, orderBy: { orden: 'asc' }, include: { variants: { orderBy: { orden: 'asc' } } } } },
  })
  const extras = await prisma.extra.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } })
  return {
    categorias: cats.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      productos: c.productos.map((p) => ({
        id: p.id, nombre: p.nombre, descripcion: p.descripcion, precioBase: p.precioBase,
        sinTacc: p.sinTacc, agotado: p.agotado,
        variantes: p.variants.map((v) => ({ id: v.id, nombre: v.nombre, precio: v.precio })),
      })),
    })),
    extras: extras.map((e) => ({ id: e.id, nombre: e.nombre, precio: e.precio })),
  }
}
