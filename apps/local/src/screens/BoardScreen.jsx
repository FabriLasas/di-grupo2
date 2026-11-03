import { useBoard, selectLanes } from '../state/board.jsx'
import { Lane } from '../ui/Lane.jsx'
import { OrderCard } from '../ui/OrderCard.jsx'

export function BoardScreen({ query, now, onOpen = () => {}, cookActions = () => null, readyActions = () => null, alertNew }) {
  const { state, reload } = useBoard()
  if (state.error && !state.loaded) {
    return <div className="board"><p className="none">No pudimos cargar los pedidos. <button className="linkish" onClick={reload}>Reintentar</button></p></div>
  }
  const lanes = selectLanes(state, query)
  const total = selectLanes(state, '')
  const q = query.trim()
  return (
    <div className="board">
      <Lane id="new" kind="new" title="Por aceptar" sort="Más viejo primero" count={total.porAceptar.length} query={q} alert={alertNew} empty="Sin pedidos por aceptar. Cuando entre uno, esta columna se ilumina y suena.">
        {lanes.porAceptar.map((o) => <OrderCard key={o.id} order={o} kind="new" now={now} highlight={!!q} onOpen={onOpen} />)}
      </Lane>
      <Lane id="cook" kind="cook" title="En cocina" sort="Por hora de retiro" count={total.enCocina.length} query={q} empty="La cocina está libre.">
        {lanes.enCocina.map((o) => <OrderCard key={o.id} order={o} kind="cook" now={now} highlight={!!q} actions={cookActions(o)} />)}
      </Lane>
      <Lane id="ready" kind="ready" title="Para retirar" sort="Esperando hace más" count={total.paraRetirar.length} query={q} empty="Nadie esperando para retirar.">
        {lanes.paraRetirar.map((o) => <OrderCard key={o.id} order={o} kind="ready" now={now} highlight={!!q} actions={readyActions(o)} />)}
      </Lane>
    </div>
  )
}
