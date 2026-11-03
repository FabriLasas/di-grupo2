import { Router } from 'express'
import { getMenu } from './service.js'

export function menuRoutes({ prisma }) {
  const r = Router()
  r.get('/', async (_req, res) => res.json(await getMenu(prisma)))
  return r
}
