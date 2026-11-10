// Levanta API, web del cliente y app del local juntos (funciona en Windows, macOS y Linux).
import { spawn } from 'node:child_process'

const apps = [
  ['api', '@fino/server', '\x1b[35m'],
  ['web', '@fino/web', '\x1b[33m'],
  ['local', '@fino/local', '\x1b[36m'],
]
const children = apps.map(([name, ws, color]) => {
  const child = spawn('npm', ['run', 'dev', '-w', ws], { shell: true, env: process.env })
  const out = (data) => String(data).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`${color}[${name}]\x1b[0m ${l}`))
  child.stdout.on('data', out)
  child.stderr.on('data', out)
  return child
})
console.log('\nWeb del cliente: http://localhost:5173\nApp del local:   http://localhost:5174  (staff@fino.test / fino1234)\n')
const stop = () => { children.forEach((c) => c.kill()); process.exit() }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
