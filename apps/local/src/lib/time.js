const fmt = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const MIN = 60000

/** HH:MM en Buenos Aires. */
export const hhmm = (d) => fmt.format(new Date(d))
/** mm:ss de un intervalo en ms (valor absoluto). */
export function mmss(ms) {
  const s = Math.floor(Math.abs(ms) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const minsSince = (iso, now) => (now.getTime() - new Date(iso).getTime()) / MIN

/** Antigüedad de un pedido por aceptar: amarillo desde 3 min, rojo desde 5. */
export function ageState(creadoEn, now) {
  const m = minsSince(creadoEn, now)
  return { state: m >= 5 ? 'late' : m >= 3 ? 'warn' : 'ok', label: m < 1 ? 'Recién' : `Hace ${Math.floor(m)} min` }
}

/** Cuenta regresiva a la hora de retiro: amarillo con 5 min o menos, rojo si ya pasó. */
export function dueState(retiroEstimado, now) {
  const left = new Date(retiroEstimado).getTime() - now.getTime()
  if (left < 0) return { state: 'late', label: `Atrasado ${mmss(left)}` }
  return { state: left <= 5 * MIN ? 'warn' : 'ok', label: `Faltan ${mmss(left)}` }
}

/** Espera en el mostrador: amarillo desde 5 min, rojo desde 10. */
export function waitState(listoEn, now) {
  const m = minsSince(listoEn, now)
  return { state: m >= 10 ? 'late' : m >= 5 ? 'warn' : 'ok', label: m < 1 ? 'Recién listo' : `Espera ${Math.floor(m)} min` }
}
