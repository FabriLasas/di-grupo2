import { Routes, Route } from 'react-router'
import { Tablero } from './ui/Tablero.jsx'
import { StoreProvider, useStore } from './state/store.jsx'
import { MenuScreen } from './screens/MenuScreen.jsx'

function Home() {
  const { store } = useStore()
  return (
    <Tablero pickup={store?.aceptaPedidos ? `Retirás en ~${store.demoraMin} min` : null}>
      <MenuScreen />
    </Tablero>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        <Route path="*" element={<Home />} />
      </Routes>
    </StoreProvider>
  )
}
