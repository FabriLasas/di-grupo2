import { Link } from 'react-router'
import logo from '../assets/logo.png'

/** Fondo a cuadros con la cabecera de FINO. */
export function Tablero({ children, pickup, nav }) {
  return (
    <div className="tablero">
      <div className="shell">
        <header className="top">
          <Link to="/"><img className="logo" src={logo} alt="FINO" /></Link>
          {pickup && <span className="pickup">{pickup}</span>}
          {nav && <nav aria-label="Cuenta">{nav}</nav>}
        </header>
        {children}
      </div>
    </div>
  )
}
