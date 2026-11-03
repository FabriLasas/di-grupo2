import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../state/auth.jsx'

const FIELD_MSG = {
  nombre: 'Escribí tu nombre y apellido.',
  telefono: 'Ingresá un teléfono con código de área (mínimo 8 números).',
  email: 'Revisá el email.',
  password: 'Usá al menos 8 caracteres.',
}
const API_MSG = {
  credenciales_invalidas: 'Email o contraseña incorrectos.',
  email_en_uso: 'Ya hay una cuenta con ese email. Ingresá con tu contraseña.',
}

function Field({ id, label, type = 'text', value, onChange, error, autoComplete }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} required />
      {error && <span className="err" id={`${id}-err`}>{error}</span>}
    </label>
  )
}

export function AuthScreen() {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const back = params.get('volver')?.startsWith('/') ? params.get('volver') : '/'
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ nombre: '', telefono: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null); setErrors({})
    try {
      if (mode === 'login') await login({ email: f.email, password: f.password })
      else await register({ nombre: f.nombre, telefono: f.telefono, email: f.email, password: f.password })
      nav(back, { replace: true })
    } catch (err) {
      if (err.code === 'validacion' && Array.isArray(err.details)) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.path, FIELD_MSG[d.path] ?? d.message])))
      } else {
        setMsg(API_MSG[err.code] ?? err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <div className="tabs" role="tablist" aria-label="Cuenta">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setMsg(null) }}>Ingresar</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setMsg(null) }}>Crear cuenta</button>
      </div>
      <h1 className="h-sm">{mode === 'login' ? 'Ingresá para pedir' : 'Creá tu cuenta'}</h1>
      <form className="form" onSubmit={submit} noValidate>
        {mode === 'register' && (
          <>
            <Field id="nombre" label="Nombre y apellido" value={f.nombre} onChange={set('nombre')} error={errors.nombre} autoComplete="name" />
            <Field id="telefono" label="Teléfono" type="tel" value={f.telefono} onChange={set('telefono')} error={errors.telefono} autoComplete="tel" />
          </>
        )}
        <Field id="email" label="Email" type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <Field id="password" label="Contraseña" type="password" value={f.password} onChange={set('password')} error={errors.password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {msg && <p className="form-err" role="alert">{msg}</p>}
        <button className="btn block" type="submit" disabled={busy}>{busy ? 'Enviando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
      </form>
    </section>
  )
}
