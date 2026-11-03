const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * fetch a la API con cookies de sesión y errores tipados.
 * @param {string} path
 * @param {{method?: string, body?: unknown}} [opts]
 */
export async function apiFetch(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'content-type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'sin_conexion', 'No hay conexión. Revisá internet y probá de nuevo.')
  }
  if (res.status === 204) return null
  let data = null
  try { data = await res.json() } catch { /* respuesta sin JSON */ }
  if (!res.ok) {
    const e = data?.error
    // la sesión venció: la app vuelve al login
    if (res.status === 401 && e?.code === 'no_autenticado') window.dispatchEvent(new Event('fino:unauthorized'))
    throw new ApiError(res.status, e?.code ?? 'red', e?.message ?? 'Algo salió mal. Probá de nuevo en un momento.', e?.details)
  }
  return data
}
