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
 * Pilot master catalog.
 * Only these two prices are seeded from real information visible on the
 * El Chunchito RM-60 receipt shared for the pilot. Codes are provisional ORBI
 * customer-facing codes until the existing RM-60 PLU table is confirmed.
 */
export const initialProducts: Product[] = [
  {
    id: 'pernil',
    code: '101',
    categoryId: 'pork',
    name: 'Pernil',
    price: 4898,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: true,
    sortOrder: 1,
    verifiedPilotData: true,
  },
  {
    id: 'orejas-corazon',
    code: '102',
    categoryId: 'pork',
    name: 'Orejas y corazón',
    price: 4800,
    unitType: 'KG',
    active: true,
    showOnShowcase: true,
    featured: false,
    sortOrder: 2,
    verifiedPilotData: true,
  },
]
