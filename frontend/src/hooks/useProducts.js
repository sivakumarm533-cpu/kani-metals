import { useEffect, useState } from 'react'
import { apiRequest } from '../services/api.js'

export const LOW_STOCK_LIMIT = 10

/** Loads the product catalog once for the Dashboard, Inventory and Products pages. */
export function useProducts() {
  const [state, setState] = useState({ products: [], loading: true, error: '' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    apiRequest('/products')
      .then((products) => { if (active) setState({ products: Array.isArray(products) ? products : [], loading: false, error: '' }) })
      .catch((error) => { if (active) setState({ products: [], loading: false, error: error.message }) })
    return () => { active = false }
  }, [attempt])

  const retry = () => { setState((current) => ({ ...current, loading: true, error: '' })); setAttempt((count) => count + 1) }
  return { ...state, retry }
}
