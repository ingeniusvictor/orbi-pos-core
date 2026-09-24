import type { Category, Product } from './domain'

export const categories: Category[] = [
  { id: 'all', name: 'Todos', icon: '✦' },
  { id: 'meat', name: 'Carnes', icon: '🥩' },
  { id: 'pork', name: 'Cerdo', icon: '🐖' },
  { id: 'chicken', name: 'Pollo', icon: '🍗' },
  { id: 'cold-cuts', name: 'Cecinas', icon: '🌭' },
  { id: 'other', name: 'Otros', icon: '🧺' },
]

/**
 * Pilot catalog.
 * Only the two products below are seeded from real information visible on the
 * El Chunchito RM-60 receipt shared for the pilot. Add the full catalog later.
 */
export const products: Product[] = [
  {
    id: 'pernil',
    categoryId: 'pork',
    name: 'Pernil',
    price: 4898,
    unitType: 'KG',
    verifiedPilotData: true,
  },
  {
    id: 'orejas-corazon',
    categoryId: 'pork',
    name: 'Orejas y corazón',
    price: 4800,
    unitType: 'KG',
    verifiedPilotData: true,
  },
]
