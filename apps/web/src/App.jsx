import { useCallback, useRef, useState } from 'react'
import { Routes, Route } from 'react-router'
import { Tablero } from './ui/Tablero.jsx'
import { CartBar } from './ui/CartBar.jsx'
import { ProductSheet, hasOptions } from './ui/ProductSheet.jsx'
import { Mascot } from './ui/Mascot.jsx'
import { flyToCart } from './ui/fly.js'
import { StoreProvider, useStore } from './state/store.jsx'
import { CartProvider, useCart } from './state/cart.jsx'
import { MenuScreen } from './screens/MenuScreen.jsx'
import { CartScreen } from './screens/CartScreen.jsx'

function Home() {
  const { store, menu, productById } = useStore()
  const { add } = useCart()
  const [open, setOpen] = useState(null)
  const countRef = useRef(null)

  const addLine = useCallback((line, fromEl) => { flyToCart(fromEl, countRef.current); add(line) }, [add])
  const onAdd = (p, el) => {
    const product = productById(p.id)
    if (hasOptions(product)) return setOpen(product)
    addLine({ productId: p.id, variantId: null, extras: [], sinTacc: false, aclaracion: '', cantidad: 1, nombre: p.nombre, varianteNombre: null, extrasNombres: [], precioUnitario: p.precioBase }, el)
  }

  return (
    <Tablero pickup={store?.aceptaPedidos ? `Retirás en ~${store.demoraMin} min` : null}>
      <MenuScreen onAdd={onAdd} />
      <Mascot className="peek" />
      <CartBar countRef={countRef} />
      {open && <ProductSheet product={open} extras={menu?.extras ?? []} onClose={() => setOpen(null)} onAdd={(line, el) => { setOpen(null); addLine(line, el) }} />}
    </Tablero>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <CartProvider>
        <Routes>
          <Route path="/carrito" element={<Tablero><CartScreen /></Tablero>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </CartProvider>
    </StoreProvider>
  )
}
