import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../services/api.js'

/**
 * Loads `path` and reloads whenever it changes or `reload()` is called.
 * The last data stays available while the next request is loading.
 */
export function useApiData(path, extraKey = '') {
  const [attempt, setAttempt] = useState(0)
  const key = `${path}#${extraKey}#${attempt}`
  const [state, setState] = useState({ key: null, data: null, error: '' })

  useEffect(() => {
    let active = true
    apiRequest(path)
      .then((data) => { if (active) setState({ key, data, error: '' }) })
      .catch((error) => { if (active) setState((current) => ({ key, data: current.data, error: error.message })) })
    return () => { active = false }
  }, [path, key])

  const reload = useCallback(() => setAttempt((count) => count + 1), [])
  return { data: state.data, error: state.error, loading: state.key !== key, reload }
}
