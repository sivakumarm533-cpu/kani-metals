import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'
import { applyTheme, cachedThemeId } from '../theme/themes.js'
import { AppSettingsContext, DEFAULT_BUSINESS } from './appSettingsContext.js'

/** Loads the application-wide theme and business details (used on bills) once signed in. */
export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ theme: cachedThemeId(), business: DEFAULT_BUSINESS, loaded: false }))

  useEffect(() => {
    let active = true
    apiRequest('/app-settings')
      .then((result) => {
        if (!active) return
        applyTheme(result.theme)
        setSettings({ theme: result.theme, business: { ...DEFAULT_BUSINESS, ...result.business }, loaded: true })
      })
      .catch(() => { if (active) setSettings((current) => ({ ...current, loaded: true })) })
    return () => { active = false }
  }, [])

  /** Saves theme and/or business details (admin only) and applies them immediately. */
  const saveSettings = useCallback(async (changes) => {
    const result = await apiRequest('/app-settings', { method: 'PUT', body: JSON.stringify(changes) })
    applyTheme(result.theme)
    setSettings({ theme: result.theme, business: { ...DEFAULT_BUSINESS, ...result.business }, loaded: true })
    return result
  }, [])

  const value = useMemo(() => ({ ...settings, saveSettings }), [settings, saveSettings])
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}
