import { MercadoPagoConfig, Preference, Payment, PaymentRefund, WebhookSignatureValidator } from 'mercadopago'

/**
 * Gateway real de Mercado Pago (Checkout Pro). Misma forma que createFakeGateway().
 * @param {{accessToken: string, webhookSecret: string, now?: () => number}} opts
 */
export function createMercadoPagoGateway({ accessToken, webhookSecret, now = Date.now }) {
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } })
  const preference = new Preference(client)
  const payment = new Payment(client)
  const refunds = new PaymentRefund(client)
  const norm = (p) => ({ id: String(p.id), status: p.status, externalReference: p.external_reference, amount: Math.round(Number(p.transaction_amount)), raw: p })

  return {
    async createPreference({ order, notificationUrl, backUrl }) {
      const res = await preference.create({
        body: {
          external_reference: order.id,
          notification_url: notificationUrl,
          back_urls: { success: backUrl, failure: backUrl, pending: backUrl },
          auto_return: 'approved',
          statement_descriptor: 'FINO',
          items: order.items.map((i, n) => ({
            id: String(n + 1),
            title: [i.producto, i.variante].filter(Boolean).join(' ') + (i.extras.length ? ` + ${i.extras.join(', ')}` : ''),
            quantity: i.cantidad,
            unit_price: i.precioUnitario,
            currency_id: 'ARS',
          })),
        },
      })
      return { id: res.id, initPoint: res.init_point }
    },
    async getPayment(id) {
      return norm(await payment.get({ id }))
    },
    async searchByReference(orderId) {
      const res = await payment.search({ options: { external_reference: orderId, sort: 'date_created', criteria: 'desc' } })
      const approved = (res.results ?? []).find((p) => p.status === 'approved')
      return approved ? norm(approved) : null
    },
    async refund(paymentId) {
      const r = await refunds.total({ payment_id: paymentId })
      return { status: r.status }
    },
    verifySignature({ xSignature, xRequestId, dataId }) {
      try {
        WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId, secret: webhookSecret, now })
        return true
      } catch {
        return false
      }
    },
  }
}
