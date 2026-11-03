import logo from '../assets/logo.png'
import { hhmm } from '../lib/time.js'

export function TopBar({ tab, onTab, active = 0, query, onQuery, delayMin, paused, onTogglePause, now, onLogout }) {
  return (
    <header className="bar">
      <img src={logo} alt="FINO" className="bar-logo" />
      <nav className="navt" aria-label="Secciones" role="tablist">
        <button role="tab" type="button" aria-selected={tab === 'live'} onClick={() => onTab('live')}>En curso <span>{active}</span></button>
        <button role="tab" type="button" aria-selected={tab === 'hist'} onClick={() => onTab('hist')}>Historial</button>
      </nav>
      <div className="find">
        <label htmlFor="q" className="sr">Buscar pedido</label>
        <input id="q" type="search" placeholder="Buscar #, nombre o teléfono" value={query} onChange={(e) => onQuery(e.target.value)} autoComplete="off" />
        {query && <button type="button" aria-label="Borrar búsqueda" onClick={() => onQuery('')}>✕</button>}
      </div>
      <div className="load">
        Demora actual <b>{delayMin ?? '–'} min</b>
        <button type="button" className="recv" aria-pressed={paused} onClick={onTogglePause}>{paused ? 'Pausado' : 'Recibiendo'}</button>
      </div>
      <span className="clock">{hhmm(now)}</span>
      <button type="button" className="icon-btn" aria-label="Salir" onClick={onLogout}>⏻</button>
    </header>
  )
}
