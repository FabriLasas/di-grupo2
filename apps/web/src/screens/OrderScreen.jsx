import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getOrder } from '../api/endpoints.js'

export function OrderScreen() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  useEffect(() => { getOrder(id).then((r) => setOrder(r.order)) }, [id])
  return <section className="card">{order && <p className="num">{order.numeroLabel}</p>}</section>
}
