import { createContext, useContext } from 'react'

export const DEFAULT_BUSINESS = {
  name: 'Kani Metals',
  tagline: 'Scrap metal traders',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  terms: 'Goods once sold will not be taken back. Please pay the balance amount on or before the due date.',
  showTerms: true,
  showGreeting: true,
  greeting: 'Thank you for your business',
}

/** Dropdown choices until the saved lists load. Keep in sync with DEFAULT_LISTS in backend/config/features.js. */
export const DEFAULT_LISTS = {
  itemCategories: ['Metal', 'Plastic', 'Paper', 'Electronics'],
  dealerCategories: ['Regular Dealer', 'Wholesale Dealer'],
  units: ['kg', 'pcs', 'ton', 'g', 'litre', 'metre', 'bundle'],
}

/** POS (thermal receipt) printing. Keep in sync with POS_DEFAULTS in backend/models/AppSetting.js. */
export const POS_DEFAULTS = {
  template: 'classic', paperWidth: '80', fontSize: 'normal', copies: 1, feedLines: 3,
  showLogo: true, showAddress: true, showPhone: true, showGstin: true, showDealer: true,
  showItemNotes: false, showPayments: true, showStatus: false, showPreviousBalance: false, showTerms: false, showGreeting: true,
  footerNote: '',
}

export const AppSettingsContext = createContext(null)

export function useAppSettings() {
  const context = useContext(AppSettingsContext)
  if (!context) throw new Error('useAppSettings must be used inside AppSettingsProvider')
  return context
}
