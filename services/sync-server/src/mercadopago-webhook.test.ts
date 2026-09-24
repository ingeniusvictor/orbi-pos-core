import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  normalizePointOrderWebhook,
  verifyMercadoPagoWebhookSignature,
} from './mercadopago-webhook.js'

function signature(secret: string, dataId: string, requestId: string, ts: string) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

describe('Mercado Pago webhook verification', () => {
  it('validates the documented HMAC manifest and lowercases Point order data.id', () => {
    const secret = 'whsec-orbi-test'
    const dataId = 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3'
    const requestId = 'request-123'
    const ts = '1742505638683'

    const result = verifyMercadoPagoWebhookSignature({
      secret,
      dataId,
      xRequestId: requestId,
      xSignature: signature(secret, dataId, requestId, ts),
    })

    expect(result.valid).toBe(true)
    expect(result.manifest).toBe(
      'id:ord01jq4s4ky8hwq6na5pxb65b3d3;request-id:request-123;ts:1742505638683;',
    )
  })

  it('rejects a modified request id in constant-time comparison path', () => {
    const secret = 'whsec-orbi-test'
    const dataId = 'ORD01TEST'
    const ts = '1742505638683'

    const result = verifyMercadoPagoWebhookSignature({
      secret,
      dataId,
      xRequestId: 'tampered',
      xSignature: signature(secret, dataId, 'original', ts),
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('signature_mismatch')
  })

  it('normalizes action_required without trusting webhook body status', () => {
    const event = normalizePointOrderWebhook(
      {
        action: 'order.action_required',
        data: {
          id: 'ORD01TEST',
          status: 'action_required',
          status_detail: 'check_on_terminal',
        },
      },
      'ord01test',
      'request-abc',
      '2026-09-24T21:20:00.000Z',
    )

    expect(event).toEqual({
      provider: 'mercadopago',
      providerOrderId: 'ord01test',
      action: 'order.action_required',
      requestId: 'request-abc',
      receivedAt: '2026-09-24T21:20:00.000Z',
      dedupeKey: 'request-abc:ord01test:order.action_required',
    })
  })

  it('rejects mismatched body/query order ids', () => {
    expect(() => normalizePointOrderWebhook(
      { action: 'order.processed', data: { id: 'ORD-A' } },
      'ORD-B',
      'request-x',
    )).toThrow('does not match')
  })
})
