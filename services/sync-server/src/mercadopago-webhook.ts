import { createHmac, timingSafeEqual } from 'node:crypto'

export const MERCADO_PAGO_POINT_ORDER_ACTIONS = [
  'order.processed',
  'order.canceled',
  'order.refunded',
  'order.action_required',
  'order.failed',
  'order.expired',
] as const

export type MercadoPagoPointOrderAction =
  typeof MERCADO_PAGO_POINT_ORDER_ACTIONS[number]

export interface MercadoPagoWebhookVerificationInput {
  xSignature: string
  xRequestId: string
  dataId: string
  secret: string
}

export interface MercadoPagoWebhookVerificationResult {
  valid: boolean
  timestamp?: string
  signature?: string
  manifest?: string
  reason?: string
}

function parseSignatureHeader(value: string): { ts?: string; v1?: string } {
  const result: { ts?: string; v1?: string } = {}

  for (const part of value.split(',')) {
    const [rawKey, rawValue] = part.split('=', 2)
    const key = rawKey?.trim()
    const parsed = rawValue?.trim()
    if (!key || !parsed) continue
    if (key === 'ts') result.ts = parsed
    if (key === 'v1') result.v1 = parsed
  }

  return result
}

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false
  if (left.length !== right.length || left.length % 2 !== 0) return false

  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  if (leftBuffer.length !== rightBuffer.length) return false

  return timingSafeEqual(leftBuffer, rightBuffer)
}

/**
 * Validates Mercado Pago's documented x-signature HMAC.
 *
 * Point order IDs can arrive uppercase but Mercado Pago documents lowercasing
 * data.id when validating these order notifications.
 */
export function verifyMercadoPagoWebhookSignature(
  input: MercadoPagoWebhookVerificationInput,
): MercadoPagoWebhookVerificationResult {
  if (!input.secret) return { valid: false, reason: 'missing_secret' }
  if (!input.xSignature) return { valid: false, reason: 'missing_x_signature' }
  if (!input.xRequestId) return { valid: false, reason: 'missing_x_request_id' }
  if (!input.dataId) return { valid: false, reason: 'missing_data_id' }

  const { ts, v1 } = parseSignatureHeader(input.xSignature)
  if (!ts || !v1) return { valid: false, reason: 'malformed_x_signature' }

  const normalizedDataId = input.dataId.toLowerCase()
  const manifest = `id:${normalizedDataId};request-id:${input.xRequestId};ts:${ts};`
  const expected = createHmac('sha256', input.secret)
    .update(manifest)
    .digest('hex')

  return {
    valid: safeHexEqual(expected, v1),
    timestamp: ts,
    signature: v1,
    manifest,
    reason: safeHexEqual(expected, v1) ? undefined : 'signature_mismatch',
  }
}

export interface MercadoPagoOrderWebhookBody {
  action?: string
  data?: {
    id?: string
    status?: string
    status_detail?: string
  }
  type?: string
  live_mode?: boolean
  date_created?: string
}

export interface NormalizedPointOrderWebhook {
  provider: 'mercadopago'
  providerOrderId: string
  action: MercadoPagoPointOrderAction
  requestId: string
  receivedAt: string
  dedupeKey: string
}

/**
 * Normalizes only the event metadata needed to trigger authoritative
 * reconciliation. ORBI never trusts webhook body status as the final payment
 * state; after validation it must GET /v1/orders/{id}.
 */
export function normalizePointOrderWebhook(
  body: MercadoPagoOrderWebhookBody,
  queryDataId: string,
  requestId: string,
  receivedAt = new Date().toISOString(),
): NormalizedPointOrderWebhook {
  const action = body.action
  if (!MERCADO_PAGO_POINT_ORDER_ACTIONS.includes(action as MercadoPagoPointOrderAction)) {
    throw new Error(`Unsupported Point order webhook action: ${action ?? '(missing)'}`)
  }

  const bodyOrderId = body.data?.id
  if (bodyOrderId && bodyOrderId.toLowerCase() !== queryDataId.toLowerCase()) {
    throw new Error('Webhook body order id does not match data.id query parameter')
  }

  return {
    provider: 'mercadopago',
    providerOrderId: queryDataId,
    action: action as MercadoPagoPointOrderAction,
    requestId,
    receivedAt,
    dedupeKey: `${requestId}:${queryDataId.toLowerCase()}:${action}`,
  }
}
