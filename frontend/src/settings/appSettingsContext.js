import { createContext, useContext } from 'react'

export const DEFAULT_BUSINESS = {
  name: 'Kani Metals',
  tagline: 'Scrap metal traders',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  terms: 'Goods once sold will not be taken back. Please pay the balance amount on or before the due date.',
}

export const AppSettingsContext = createContext(null)

export function useAppSettings() {
  const context = useContext(AppSettingsContext)
  if (!context) throw new Error('useAppSettings must be used inside AppSettingsProvider')
  return context
}
