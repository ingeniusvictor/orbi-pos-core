import { describe, expect, it } from 'vitest'
import { createPaymentRuntime } from './payment-providers.js'

describe('payment runtime', () => {
  it('defaults to a clearly labeled mock Point Smart 2 terminal', () => {
    const runtime = createPaymentRuntime({})
    expect(runtime.providerId).toBe('mock')
    expect(runtime.terminal).toMatchObject({
      id: 'MOCK_POINT_SMART_2',
      provider: 'mock',
      operatingMode: 'MOCK',
      ready: true,
      isPrimary: true,
    })
  })

  it('keeps Mercado Pago unconfigured until token and real terminal id exist', () => {
    const runtime = createPaymentRuntime({
      ORBI_PAYMENT_PROVIDER: 'mercadopago',
    })

    expect(runtime.providerId).toBe('mercadopago')
    expect(runtime.terminal.id).toBe('PENDING')
    expect(runtime.terminal.ready).toBe(false)
    expect(runtime.terminal.operatingMode).toBe('UNDEFINED')
  })

  it('marks Mercado Pago PDV ready only with backend credentials and terminal id', () => {
    const runtime = createPaymentRuntime({
      ORBI_PAYMENT_PROVIDER: 'mercadopago',
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-test-secret',
      ORBI_POINT_TERMINAL_ID: 'NEWLAND_N950__TESTSERIAL',
      ORBI_POINT_STORE_ID: 'store-1',
      ORBI_POINT_POS_ID: 'pos-1',
    })

    expect(runtime.terminal).toMatchObject({
      id: 'NEWLAND_N950__TESTSERIAL',
      provider: 'mercadopago',
      storeId: 'store-1',
      posId: 'pos-1',
      operatingMode: 'PDV',
      ready: true,
    })
  })
})
