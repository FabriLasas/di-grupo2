import { Routes, Route } from 'react-router'
import { Tablero } from './ui/Tablero.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Tablero><div className="card"><h1>Menú Fino</h1></div></Tablero>} />
    </Routes>
  )
}
