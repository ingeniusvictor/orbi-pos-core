import { describe, expect, it } from 'vitest'
import { recoverySaleRequestId } from './payment-api'

describe('OC-32 recoverySaleRequestId', () => {
  it('derives a stable sale request id from the durable Payment Core order id', () => {
    const paymentOrderId = '12345678-1234-1234-1234-123456789abc'
    expect(recoverySaleRequestId(paymentOrderId)).toBe(
      'recover_12345678-1234-1234-1234-123456789abc',
    )
    expect(recoverySaleRequestId(paymentOrderId)).toBe(
      recoverySaleRequestId(paymentOrderId),
    )
  })

  it('rejects unsafe payment order ids instead of generating ambiguous recovery keys', () => {
    expect(() => recoverySaleRequestId('bad id')).toThrow(
      'Invalid payment order id for sale recovery',
    )
  })
})
