import { calcDelay } from '@fino/shared'

const TZ = 'America/Argentina/Buenos_Aires'
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

/** Día de semana (0 = domingo) y minuto del día en Buenos Aires. */
export function localParts(date) {
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return { day: DAYS[parts.weekday], minute: Number(parts.hour) * 60 + Number(parts.minute) }
}

/** Abierto según el flag y el horario. Una franja cuyo fin es menor o igual al inicio sigue después de medianoche. */
export function isOpenAt(settings, date) {
  if (!settings.abierto) return false
  const { day, minute } = localParts(date)
  const prev = (day + 6) % 7
  const today = settings.horario?.[day] ?? settings.horario?.[String(day)] ?? []
  const yesterday = settings.horario?.[prev] ?? settings.horario?.[String(prev)] ?? []
  for (const [a, b] of today) {
    const s = toMin(a), e = toMin(b)
    if (e > s ? minute >= s && minute < e : minute >= s) return true
  }
  for (const [a, b] of yesterday) {
    const s = toMin(a), e = toMin(b)
    if (e <= s && minute < e) return true
  }
  return false
}

export async function getSettings(prisma) {
  return prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } })
}

/** @returns {Promise<{abierto: boolean, pausado: boolean, aceptaPedidos: boolean, demoraMin: number, horario: object}>} */
export async function getStoreStatus(prisma, clock) {
  const s = await getSettings(prisma)
  const cookCount = await prisma.order.count({ where: { estado: 'en_cocina' } })
  const abierto = isOpenAt(s, clock.now())
  return { abierto, pausado: s.pausado, aceptaPedidos: abierto && !s.pausado, demoraMin: calcDelay({ cookCount, baseMin: s.demoraBaseMin }), horario: s.horario }
}
