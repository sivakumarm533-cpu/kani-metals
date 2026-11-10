import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../services/api.js'
import { applyTheme, THEME_IDS } from '../theme/themes.js'
import { useAuth } from '../auth/authContextValue.js'
import { AppSettingsContext, DEFAULT_BUSINESS, DEFAULT_LISTS } from './appSettingsContext.js'

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
    // Themes team members may pick; older settings without the list allow every theme.
    userThemes: Array.isArray(result?.userThemes) ? THEME_IDS.filter((id) => result.userThemes.includes(id)) : [...THEME_IDS],
    features: result?.features || {},
    menuOrder: Array.isArray(result?.menuOrder) ? result.menuOrder : [],
    billTemplate: result?.billTemplate || 'classic',
    lists: Object.fromEntries(Object.keys(DEFAULT_LISTS).map((key) => [key, Array.isArray(result?.lists?.[key]) && result.lists[key].length ? result.lists[key] : DEFAULT_LISTS[key]])),
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

  // A personal theme (when allowed) wins over the workspace theme. Team members only keep
  // it while the administrator still allows that theme; admins and sub-admins may use any.
  const manager = user?.role === 'admin' || user?.role === 'subadmin'
  const savedPersonal = user?.preferences?.theme || ''
  const personalTheme = settings.allowUserThemes && savedPersonal && (manager || settings.userThemes.includes(savedPersonal)) ? savedPersonal : ''
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
