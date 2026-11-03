import http from 'node:http'
import { createApp } from './app.js'
import { attachRealtime } from './realtime/index.js'

/** Arma HTTP + Express + Socket.io. Si deps.realtime no viene, usa el Socket.io real. */
export function createServer(deps) {
  const holder = {}
  const realtime = deps.realtime ?? {
    emitOrder: (...a) => holder.rt.emitOrder(...a),
    emitStore: (...a) => holder.rt.emitStore(...a),
  }
  const app = createApp({ ...deps, realtime })
  const httpServer = http.createServer(app)
  if (!deps.realtime) holder.rt = attachRealtime(httpServer, deps)
  return { app, httpServer, io: holder.rt?.io, realtime: holder.rt ?? realtime }
}
