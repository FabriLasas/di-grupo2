/** Gateway de pagos en memoria para tests y desarrollo sin Mercado Pago. */
export function createFakeGateway() {
  const payments = new Map()
  const fake = {
    failRefunds: false,
    refunds: [],
    preferences: [],
    setPayment(p) { payments.set(String(p.id), { ...p, id: String(p.id) }) },
    async createPreference({ order }) {
      const pref = { id: `pref_${order.id}`, initPoint: `https://mp.test/checkout/${order.id}` }
      fake.preferences.push(pref)
      return pref
    },
    async getPayment(id) {
      const p = payments.get(String(id))
      if (!p) throw new Error(`pago ${id} inexistente`)
      return p
    },
    async searchByReference(orderId) {
      return [...payments.values()].find((p) => p.externalReference === orderId && p.status === 'approved') ?? null
    },
    async refund(paymentId) {
      if (fake.failRefunds) throw new Error('MP no respondió')
      fake.refunds.push(String(paymentId))
      return { status: 'approved' }
    },
    verifySignature({ xSignature }) { return xSignature === 'ok' },
  }
  return fake
}
