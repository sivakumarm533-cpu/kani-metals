import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'
import { applyTheme } from '../theme/themes.js'
import { useAuth } from '../auth/authContextValue.js'
import { AppSettingsContext, DEFAULT_BUSINESS } from './appSettingsContext.js'

const CACHE_KEY = 'kani-app-settings'

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}
function writeCache(settings) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(settings)) } catch { /* storage unavailable */ }
}

function normalize(result) {
  return {
    theme: result?.theme || 'copper',
    allowUserThemes: result?.allowUserThemes !== false,
    features: result?.features || {},
    business: { ...DEFAULT_BUSINESS, ...result?.business },
  }
}

/**
 * Loads the workspace theme, feature access and business details (used on bills).
 * The last copy is cached so menus and colours are right before the request finishes.
 */
export function AppSettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(() => {
    const cached = readCache()
    return { ...normalize(cached), loaded: false }
  })

  useEffect(() => {
    let active = true
    apiRequest('/app-settings')
      .then((result) => {
        if (!active) return
        const next = normalize(result)
        writeCache(next)
        setSettings({ ...next, loaded: true })
      })
      .catch(() => { if (active) setSettings((current) => ({ ...current, loaded: true })) })
    return () => { active = false }
  }, [])

  // A personal theme (when allowed) wins over the workspace theme.
  const personalTheme = settings.allowUserThemes ? user?.preferences?.theme || '' : ''
  const effectiveTheme = personalTheme || settings.theme
  useEffect(() => { applyTheme(effectiveTheme) }, [effectiveTheme])

  /** Saves workspace settings (admins and sub-admins only). */
  const saveSettings = useCallback(async (changes) => {
    const result = await apiRequest('/app-settings', { method: 'PUT', body: JSON.stringify(changes) })
    const next = normalize(result)
    writeCache(next)
    setSettings({ ...next, loaded: true })
    return result
  }, [])

  const value = useMemo(() => ({ ...settings, personalTheme, effectiveTheme, saveSettings }), [settings, personalTheme, effectiveTheme, saveSettings])
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}
