import { describe, expect, it } from 'vitest'
import { demoCatalogIsIsolated, demoProducts } from './demo-catalog'

describe('safe visual demo catalog', () => {
  it('contains six clearly isolated presentation products', () => {
    expect(demoCatalogIsIsolated(demoProducts)).toBe(true)
  })

  it('never contains RM-60 PLUs or verified-pilot flags', () => {
    expect(demoProducts.every((product) => product.plu === undefined)).toBe(true)
    expect(demoProducts.every((product) => product.verifiedPilotData !== true)).toBe(true)
  })

  it('uses demo-prefixed customer-facing codes', () => {
    expect(demoProducts.map((product) => product.code)).toEqual([
      'D101', 'D102', 'D103', 'D104', 'D105', 'D106',
    ])
  })
})
