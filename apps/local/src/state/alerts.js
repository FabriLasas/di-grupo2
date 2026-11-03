/**
 * "Ding" con Web Audio: dos tonos cortos. Los navegadores exigen una interacción
 * antes de reproducir sonido, por eso arranca bloqueado hasta unlock().
 */
export function createDinger(makeContext = () => new (window.AudioContext || window.webkitAudioContext)()) {
  let ctx = null
  const d = {
    unlocked: false,
    unlock() {
      try { ctx = ctx || makeContext(); ctx.resume?.(); d.unlocked = true } catch { d.unlocked = false }
    },
    ding() {
      if (!d.unlocked || !ctx) return
      const t0 = ctx.currentTime
      ;[[880, 0], [660, 0.16]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, t0 + delay)
        gain.gain.exponentialRampToValueAtTime(0.4, t0 + delay + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.12)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(t0 + delay); osc.stop(t0 + delay + 0.13)
      })
    },
  }
  return d
}
