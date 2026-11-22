import { useCallback, useState } from 'react'

/*
 * Remembers dropdown and filter choices on this device, so the app opens with the
 * option picked last time (for example the unit on a new bill line, or a sort order).
 * Stored in localStorage; when storage is unavailable the defaults are used.
 */

const PREFIX = 'kani-choice:'

/** The saved choice for `key`, or `fallback`. With `allowed`, a saved value no longer offered is ignored. */
export function readChoice(key, fallback, allowed) {
  try {
    const value = localStorage.getItem(PREFIX + key)
    if (value !== null && (!allowed || allowed.includes(value))) return value
  } catch { /* storage unavailable */ }
  return fallback
}

export function saveChoice(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, String(value))
  } catch { /* the choice just isn't remembered */ }
}

/** useState that starts from the remembered choice and remembers every change. */
export function useRememberedState(key, fallback, allowed) {
  const [value, setValue] = useState(() => readChoice(key, fallback, allowed))
  const update = useCallback((next) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      saveChoice(key, resolved)
      return resolved
    })
  }, [key])
  return [value, update]
}
