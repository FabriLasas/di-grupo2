import { useEffect } from 'react'

export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, 3400)
    return () => clearTimeout(t)
  }, [toast, onDone])
  if (!toast) return null
  return <div className={`toast${toast.bad ? ' bad' : ''}`} role="status"><i aria-hidden="true">{toast.bad ? '!' : '✓'}</i><span>{toast.text}</span></div>
}
