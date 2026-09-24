import { describe, expect, it } from 'vitest'
import { demoProducts } from './demo-catalog'
import {
  completeDemoReceipt,
  createDemoReference,
  demoCartTotal,
  demoSessionIsIsolated,
  makeDemoLine,
  transitionDemoPayment,
} from './demo-session'

describe('isolated owner demo session', () => {
  it('accepts only the isolated demo catalog', () => {
    expect(demoSessionIsIsolated(demoProducts)).toBe(true)

    expect(() => makeDemoLine({
      ...demoProducts[0],
      id: 'real-product',
      code: '101',
    }, 1)).toThrow('demo products only')
  })

  it('calculates demo cart totals using the same POS subtotal rules', () => {
    const pernil = makeDemoLine(demoProducts[0], 1.146, 'l1')
    const costillar = makeDemoLine(demoProducts[1], 0.8, 'l2')

    expect(pernil.subtotal).toBe(6860)
    expect(costillar.subtotal).toBe(5990)
    expect(demoCartTotal([pernil, costillar])).toBe(12850)
  })

  it('requires the terminal step before approval', () => {
    expect(() => transitionDemoPayment('created', 'processed'))
      .toThrow('Invalid demo payment transition')

    expect(transitionDemoPayment('created', 'at_terminal')).toBe('at_terminal')
    expect(transitionDemoPayment('at_terminal', 'processed')).toBe('processed')
  })

  it('never completes a demo receipt unless payment is processed', () => {
    const line = makeDemoLine(demoProducts[0], 1, 'l1')

    expect(() => completeDemoReceipt(
      'failed',
      'DEMO-REF',
      [line],
      'debit',
    )).toThrow('processed payment')

    const receipt = completeDemoReceipt(
      'processed',
      'DEMO-REF',
      [line],
      'debit',
      '2026-09-24T22:30:00.000Z',
    )

    expect(receipt.reference).toBe('DEMO-REF')
    expect(receipt.total).toBe(line.subtotal)
    expect(receipt.lines).toHaveLength(1)
  })

  it('creates an unmistakable DEMO reference', () => {
    expect(createDemoReference(
      new Date('2026-09-24T19:30:45-03:00'),
      'TEST',
    )).toMatch(/^DEMO-\d{8}-\d{6}-TEST$/)
  })
})
