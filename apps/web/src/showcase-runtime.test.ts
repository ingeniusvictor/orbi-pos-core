import { describe, expect, it } from 'vitest'
import { previousShowcasePage, showcaseConnectionInfo } from './showcase-runtime'

describe('Showcase kiosk runtime', () => {
  it('keeps healthy sync status out of the customer presentation', () => {
    expect(showcaseConnectionInfo('synced', '2026-09-24T18:00:00.000Z').shouldShow).toBe(false)
  })

  it('warns while preserving last-known-content semantics offline', () => {
    const info = showcaseConnectionInfo('offline', '2026-09-24T18:00:00.000Z')
    expect(info.shouldShow).toBe(true)
    expect(info.label).toBe('Sin conexión')
    expect(info.detail).toContain('Mostrando última información')
  })

  it('wraps previous slide navigation', () => {
    expect(previousShowcasePage(0, 4)).toBe(3)
    expect(previousShowcasePage(2, 4)).toBe(1)
    expect(previousShowcasePage(0, 1)).toBe(0)
  })
})
