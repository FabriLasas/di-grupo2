import { useCallback, useRef, useState } from 'react'
import { Routes, Route, Link } from 'react-router'
import { Tablero } from './ui/Tablero.jsx'
import { CartBar } from './ui/CartBar.jsx'
import { ProductSheet, hasOptions } from './ui/ProductSheet.jsx'
import { Mascot } from './ui/Mascot.jsx'
import { flyToCart } from './ui/fly.js'
import { StoreProvider, useStore } from './state/store.jsx'
import { CartProvider, useCart } from './state/cart.jsx'
import { AuthProvider, useAuth, RequireAuth } from './state/auth.jsx'
import { MenuScreen } from './screens/MenuScreen.jsx'
import { CartScreen } from './screens/CartScreen.jsx'
import { AuthScreen } from './screens/AuthScreen.jsx'
import { CheckoutScreen } from './screens/CheckoutScreen.jsx'
import { OrderScreen } from './screens/OrderScreen.jsx'
import { MyOrdersScreen } from './screens/MyOrdersScreen.jsx'

function Page({ children, pickup }) {
  const { user, logout } = useAuth()
  const nav = user
    ? <><Link to="/mis-pedidos">Mis pedidos</Link><button type="button" onClick={logout}>Salir</button></>
    : <Link to="/ingresar">Ingresar</Link>
  return <Tablero pickup={pickup} nav={nav}>{children}</Tablero>
}

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
    <Page pickup={store?.aceptaPedidos ? `Retirás en ~${store.demoraMin} min` : null}>
      <MenuScreen onAdd={onAdd} />
      <Mascot className="peek" />
      <CartBar countRef={countRef} />
      {open && <ProductSheet product={open} extras={menu?.extras ?? []} onClose={() => setOpen(null)} onAdd={(line, el) => { setOpen(null); addLine(line, el) }} />}
    </Page>
  )
}

export default function App({ redirect }) {
  return (
    <StoreProvider>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route path="/carrito" element={<Page><CartScreen /></Page>} />
            <Route path="/ingresar" element={<Page><AuthScreen /></Page>} />
            <Route path="/checkout" element={<Page><RequireAuth><CheckoutScreen redirect={redirect} /></RequireAuth></Page>} />
            <Route path="/pedido/:id" element={<Page><RequireAuth><OrderScreen /></RequireAuth></Page>} />
            <Route path="/mis-pedidos" element={<Page><RequireAuth><MyOrdersScreen /></RequireAuth></Page>} />
            <Route path="*" element={<Home />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </StoreProvider>
  )
}
