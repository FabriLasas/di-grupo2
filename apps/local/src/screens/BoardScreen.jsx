export function BoardScreen() {
  return (
    <div className="board">
      <section className="lane" data-s="new"><div className="lh"><h2>Por aceptar</h2></div></section>
      <section className="lane" data-s="cook"><div className="lh"><h2>En cocina</h2></div></section>
      <section className="lane" data-s="ready"><div className="lh"><h2>Para retirar</h2></div></section>
    </div>
  )
}
