import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { formatPrice } from '@fino/shared'
import { useCart } from '../state/cart.jsx'

/** Barra fija con contador (rebota al cambiar) y total. */
export function CartBar({ countRef }) {
  const { count, total } = useCart()
  const local = useRef(null)
  const ref = countRef ?? local
  const prev = useRef(count)
  useEffect(() => {
    if (count !== prev.current && ref.current) { ref.current.classList.remove('bump'); void ref.current.offsetWidth; ref.current.classList.add('bump') }
    prev.current = count
  }, [count, ref])
  return (
    <section className="cartbar" role="region" aria-label="Tu pedido">
      <span className="cnt" ref={ref} data-testid="count">{count}</span>
      <span className="tot">{count ? formatPrice(total) : 'Tu pedido está vacío'}</span>
      <Link className="btn" to="/carrito" aria-disabled={!count}>Ver pedido</Link>
    </section>
  )
}
