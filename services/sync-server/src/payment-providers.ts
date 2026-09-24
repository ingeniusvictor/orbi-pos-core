import type {
  PaymentOrderStatus,
  PaymentProvider,
  PaymentProviderId,
  PaymentTerminal,
  ProviderCreateOrderInput,
  ProviderOrderState,
} from './payment-types.js'

const MERCADO_PAGO_API = 'https://api.mercadopago.com'

function mapStatus(value: unknown): PaymentOrderStatus {
  const status = String(value ?? '')
  const allowed: PaymentOrderStatus[] = [
    'created',
    'at_terminal',
    'action_required',
    'processed',
    'failed',
    'canceled',
    'expired',
    'refunded',
  ]
  if (allowed.includes(status as PaymentOrderStatus)) return status as PaymentOrderStatus
  throw new Error(`Unsupported Mercado Pago order status: ${status || '(empty)'}`)
}

export class MockPointProvider implements PaymentProvider {
  readonly id = 'mock' as const

  async createOrder(input: ProviderCreateOrderInput): Promise<ProviderOrderState> {
    return {
      providerOrderId: `MOCK-${input.externalReference}`,
      status: 'created',
      statusDetail: 'created',
    }
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrderState> {
    return {
      providerOrderId,
      status: 'created',
      statusDetail: 'mock_state_is_managed_by_orbi_store',
    }
  }

  async cancelOrder(providerOrderId: string): Promise<ProviderOrderState> {
    return {
      providerOrderId,
      status: 'canceled',
      statusDetail: 'canceled',
    }
  }
}

interface MercadoPagoOrderResponse {
  id: string
  status: string
  status_detail?: string
}

export class MercadoPagoPointProvider implements PaymentProvider {
  readonly id = 'mercadopago' as const

  constructor(
    private readonly accessToken: string,
    private readonly baseUrl = MERCADO_PAGO_API,
  ) {
    if (!accessToken) throw new Error('Mercado Pago access token is required')
  }

  private async request(
    path: string,
    init: RequestInit & { idempotencyKey?: string } = {},
  ): Promise<MercadoPagoOrderResponse> {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${this.accessToken}`)
    headers.set('Content-Type', 'application/json')
    if (init.idempotencyKey) headers.set('X-Idempotency-Key', init.idempotencyKey)

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    })

    const body = await response.json().catch(() => null) as
      | MercadoPagoOrderResponse
      | { message?: string; error?: string }
      | null

    if (!response.ok) {
      const message = body && 'message' in body
        ? body.message
        : body && 'error' in body
          ? body.error
          : undefined
      throw new Error(`Mercado Pago API ${response.status}: ${message ?? 'request failed'}`)
    }

    if (!body || !('id' in body) || !('status' in body)) {
      throw new Error('Mercado Pago returned an invalid order payload')
    }

    return body
  }

  async createOrder(input: ProviderCreateOrderInput): Promise<ProviderOrderState> {
    const body = await this.request('/v1/orders', {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
      body: JSON.stringify({
        type: 'point',
        external_reference: input.externalReference,
        expiration_time: 'PT10M',
        transactions: {
          payments: [{ amount: String(input.amount) }],
        },
        config: {
          point: {
            terminal_id: input.terminalId,
            print_on_terminal: 'no_ticket',
          },
        },
        description: 'ORBI POS - Carniceria El Chunchito',
      }),
    })

    return {
      providerOrderId: body.id,
      status: mapStatus(body.status),
      statusDetail: body.status_detail,
    }
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrderState> {
    const body = await this.request(`/v1/orders/${encodeURIComponent(providerOrderId)}`, {
      method: 'GET',
    })

    return {
      providerOrderId: body.id,
      status: mapStatus(body.status),
      statusDetail: body.status_detail,
    }
  }

  async cancelOrder(
    providerOrderId: string,
    idempotencyKey: string,
  ): Promise<ProviderOrderState> {
    const body = await this.request(
      `/v1/orders/${encodeURIComponent(providerOrderId)}/cancel`,
      {
        method: 'POST',
        idempotencyKey,
      },
    )

    return {
      providerOrderId: body.id,
      status: mapStatus(body.status),
      statusDetail: body.status_detail,
    }
  }
}

export interface PaymentRuntimeConfig {
  providerId: PaymentProviderId
  provider: PaymentProvider
  terminal: PaymentTerminal
}

export function createPaymentRuntime(env: NodeJS.ProcessEnv): PaymentRuntimeConfig {
  const requested = env.ORBI_PAYMENT_PROVIDER?.toLowerCase() ?? 'mock'

  if (requested === 'mercadopago') {
    const accessToken = env.MERCADO_PAGO_ACCESS_TOKEN ?? ''
    const terminalId = env.ORBI_POINT_TERMINAL_ID ?? ''
    const ready = Boolean(accessToken && terminalId)

    const terminal: PaymentTerminal = {
      id: terminalId || 'PENDING',
      provider: 'mercadopago',
      label: env.ORBI_POINT_TERMINAL_LABEL || 'Point Smart 2 - Caja principal',
      storeId: env.ORBI_POINT_STORE_ID || undefined,
      posId: env.ORBI_POINT_POS_ID || undefined,
      operatingMode: ready ? 'PDV' : 'UNDEFINED',
      ready,
      isPrimary: true,
    }

    if (!ready) {
      return {
        providerId: 'mercadopago',
        provider: new UnconfiguredProvider('mercadopago'),
        terminal,
      }
    }

    return {
      providerId: 'mercadopago',
      provider: new MercadoPagoPointProvider(accessToken),
      terminal,
    }
  }

  return {
    providerId: 'mock',
    provider: new MockPointProvider(),
    terminal: {
      id: 'MOCK_POINT_SMART_2',
      provider: 'mock',
      label: 'Point Smart 2 - Simulador ORBI',
      storeId: 'mock-store',
      posId: 'mock-pos',
      operatingMode: 'MOCK',
      ready: true,
      isPrimary: true,
    },
  }
}

class UnconfiguredProvider implements PaymentProvider {
  constructor(readonly id: PaymentProviderId) {}

  private fail(): never {
    throw new Error('Mercado Pago provider is selected but credentials/terminal are incomplete')
  }

  async createOrder(): Promise<ProviderOrderState> { return this.fail() }
  async getOrder(): Promise<ProviderOrderState> { return this.fail() }
  async cancelOrder(): Promise<ProviderOrderState> { return this.fail() }
}
