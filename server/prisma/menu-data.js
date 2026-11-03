// Menú real de FINO (historias del local). Precios en pesos enteros.
export const CATEGORIES = [
  {
    nombre: 'Hamburguesas',
    productos: [
      { nombre: 'Fino', precioBase: 14500, sinTacc: true, descripcion: 'Doble carne, cheddar, pepinillos, cebolla brunoise marcada, salsa fino.' },
      { nombre: 'Crispino', precioBase: 16000, sinTacc: true, descripcion: 'Doble carne, cheddar, bacon, cebolla crispy, pepinillos, salsa lula.' },
      { nombre: 'Veggie', precioBase: 17500, sinTacc: true, descripcion: 'Medallón de portobellos rebozados relleno de variedad de quesos, tomate, lechuga y salsa mil islas.' },
      { nombre: 'Josefina', precioBase: 16000, sinTacc: true, descripcion: 'Pan de sésamo, medallón 220grs, cheddar, tomate, lechuga, cebolla morada, mayo heinz.' },
      { nombre: 'Cheeseburger', precioBase: 9500, sinTacc: true, variantes: [['Simple', 9500], ['Doble', 13500], ['Triple', 16500]] },
      { nombre: 'Cheesebacon', precioBase: 10500, sinTacc: true, variantes: [['Simple', 10500], ['Doble', 14500], ['Triple', 17500]] },
    ],
  },
  {
    nombre: 'Sides',
    productos: [
      { nombre: 'Papas finas', precioBase: 9000, descripcion: 'Popcorns de papa con queso y hierbas + mayo pesto' },
      { nombre: 'Papas fritas', precioBase: 4000 },
      { nombre: 'Fried pickles', precioBase: 5000, descripcion: '+ Salsa Fino' },
      { nombre: 'Nuggets (x6)', precioBase: 6000, descripcion: '+ Salsa Ranch' },
    ],
  },
  {
    nombre: 'Milkshakes',
    productos: [
      { nombre: 'Cheesecake', precioBase: 8000 },
      { nombre: 'Oreo', precioBase: 8000 },
      { nombre: 'Chocotorta', precioBase: 8000 },
    ],
  },
  {
    nombre: 'Bebidas',
    productos: [
      { nombre: 'Gaseosa (línea coca)', precioBase: 4000 },
      { nombre: 'Agua mineral', precioBase: 4000 },
      { nombre: 'Cerveza Peroni', precioBase: 6000, descripcion: 'Con alcohol' },
    ],
  },
]

export const EXTRAS = [['Dip Fino', 2000], ['Dip Lula', 2000], ['Dip Ranch', 2000]]

// Horario provisorio (decisión abierta del spec): todos los días de 20:00 a 00:30. Domingo = "0".
export const HORARIO = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [['20:00', '00:30']]]))
