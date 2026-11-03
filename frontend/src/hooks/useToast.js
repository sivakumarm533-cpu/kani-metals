import { useCallback, useEffect, useState } from 'react'

/**
 * Returns [toast, notify]. `notify(message, type, icon)` shows a toast that hides itself
 * after `duration` ms. Types: success, info, danger.
 */
export function useToast(duration = 3200) {
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), duration)
    return () => window.clearTimeout(timeout)
  }, [toast, duration])

  const notify = useCallback((message, type = 'success', icon) => {
    setToast({ id: `${Date.now()}-${Math.random()}`, message, type, icon })
  }, [])

  return [toast, notify]
}
