import { useEffect, useState } from 'react'

/** Reloj del sistema: avisa cada segundo. */
export const systemClock = {
  now: () => new Date(),
  subscribe(fn) { const t = setInterval(fn, 1000); return () => clearInterval(t) },
}

/** Hora actual que se re-renderiza con cada tick del reloj inyectado. */
export function useNow(clock) {
  const [now, setNow] = useState(() => clock.now())
  useEffect(() => clock.subscribe(() => setNow(clock.now())), [clock])
  return now
}
