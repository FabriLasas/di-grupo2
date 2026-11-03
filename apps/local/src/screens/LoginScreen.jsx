import { useState } from 'react'
import logo from '../assets/logo.png'
import { useAuth } from '../state/auth.jsx'

const MSG = { credenciales_invalidas: 'Email o contraseña incorrectos.' }

export function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try { await login({ email, password }) } catch (err) { setMsg(MSG[err.code] ?? err.message) } finally { setBusy(false) }
  }
  return (
    <main className="login">
      <form className="login-box" onSubmit={submit}>
        <img src={logo} alt="FINO" className="login-logo" />
        <h1>Comandas</h1>
        <label className="field" htmlFor="email"><span>Email</span><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label className="field" htmlFor="password"><span>Contraseña</span><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {msg && <p className="form-err" role="alert">{msg}</p>}
        <button className="big-btn b-open" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
    </main>
  )
}
