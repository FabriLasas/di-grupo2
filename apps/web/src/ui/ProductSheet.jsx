import { useEffect, useId, useRef, useState } from 'react'
import { formatPrice } from '@fino/shared'
import { unitPrice } from '../state/cart.jsx'

const DIP_CATEGORIES = ['Hamburguesas', 'Sides']

/** ¿El producto necesita la hoja de opciones? */
export const hasOptions = (p) => p.variantes.length > 0 || p.sinTacc || DIP_CATEGORIES.includes(p.categoria)

/** Hoja inferior: tamaño, dips, pan sin TACC, aclaración y cantidad. */
export function ProductSheet({ product, extras, onAdd, onClose }) {
  const [variantId, setVariantId] = useState(null)
  const [dips, setDips] = useState([])
  const [sinTacc, setSinTacc] = useState(false)
  const [aclaracion, setAclaracion] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const titleId = useId()
  const boxRef = useRef(null)
  const addRef = useRef(null)
  const showDips = DIP_CATEGORIES.includes(product.categoria)
  const needsVariant = product.variantes.length > 0
  const unit = unitPrice(product, variantId, dips, extras)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    boxRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleDip = (id) => setDips((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))
  const submit = () => onAdd({
    productId: product.id, variantId, extras: dips, sinTacc, aclaracion: aclaracion.trim(), cantidad,
    nombre: product.nombre, varianteNombre: product.variantes.find((v) => v.id === variantId)?.nombre ?? null,
    extrasNombres: dips.map((id) => extras.find((e) => e.id === id)?.nombre).filter(Boolean),
    precioUnitario: unit,
  }, addRef.current)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={boxRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden="true" />
        <h2 id={titleId}>{product.nombre}</h2>
        {product.descripcion && <p className="desc">{product.descripcion}</p>}

        {needsVariant && (
          <fieldset className="opts">
            <legend>Tamaño</legend>
            {product.variantes.map((v) => (
              <label key={v.id} className="opt">
                <input type="radio" name="variante" checked={variantId === v.id} onChange={() => setVariantId(v.id)} />
                <span>{v.nombre}</span><span className="pr">{formatPrice(v.precio)}</span>
              </label>
            ))}
          </fieldset>
        )}

        {showDips && extras.length > 0 && (
          <fieldset className="opts">
            <legend>Sumá dips</legend>
            {extras.map((e) => (
              <label key={e.id} className="opt">
                <input type="checkbox" checked={dips.includes(e.id)} onChange={() => toggleDip(e.id)} />
                <span>{e.nombre}</span><span className="pr">+{formatPrice(e.precio)}</span>
              </label>
            ))}
          </fieldset>
        )}

        {product.sinTacc && (
          <label className="opt solo">
            <input type="checkbox" checked={sinTacc} onChange={(e) => setSinTacc(e.target.checked)} />
            <span>Pan sin TACC</span>
          </label>
        )}

        <label className="field">
          <span>Aclaración</span>
          <input type="text" maxLength={140} value={aclaracion} onChange={(e) => setAclaracion(e.target.value)} placeholder="Ej.: sin pepinillos" />
        </label>

        <div className="sheet-foot">
          <div className="stepper">
            <button type="button" aria-label="Restar uno" onClick={() => setCantidad((c) => Math.max(1, c - 1))} disabled={cantidad <= 1}>−</button>
            <output aria-label="Cantidad">{cantidad}</output>
            <button type="button" aria-label="Sumar uno" onClick={() => setCantidad((c) => Math.min(20, c + 1))}>+</button>
          </div>
          <button ref={addRef} type="button" className="btn grow" disabled={needsVariant && !variantId} onClick={submit}>
            Agregar · {formatPrice(unit * cantidad)}
          </button>
        </div>
      </div>
    </div>
  )
}
