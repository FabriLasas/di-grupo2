export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {unknown} [details]
   */
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Valida req[where] con un esquema zod y lo reemplaza por el resultado parseado. */
export function validate(schema, where = 'body') {
  return (req, _res, next) => {
    const r = schema.safeParse(req[where] ?? {})
    if (!r.success) {
      const details = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      return next(new HttpError(400, 'validacion', 'Revisá los datos enviados.', details))
    }
    if (where === 'query') req.parsedQuery = r.data
    else req[where] = r.data
    next()
  }
}

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'no_encontrado', 'No existe esa ruta.'))
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) } })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'json_invalido', message: 'El cuerpo no es JSON válido.' } })
  }
  console.error(err)
  res.status(500).json({ error: { code: 'error_interno', message: 'Algo salió mal. Probá de nuevo en un momento.' } })
}
