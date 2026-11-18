/**
 * Interface styles. A UI style changes shapes, surfaces, type and spacing; the colour theme
 * (theme/themes.js) still decides the colours, so any theme works with any style.
 * 'modern' is the current design (styles/ui-modern.css); 'classic' is the original look.
 */
export const UI_STYLES = [
  { id: 'modern', name: 'Modern', description: 'Flat cards, softer corners, cleaner menus and tables' },
  { id: 'classic', name: 'Classic', description: 'The original Kani Metals look' },
]
export const UI_STYLE_IDS = UI_STYLES.map((style) => style.id)
export const DEFAULT_UI_STYLE = 'modern'
const STORAGE_KEY = 'kani-ui-style'

export const normalizeUiStyle = (id) => (UI_STYLE_IDS.includes(id) ? id : DEFAULT_UI_STYLE)

/** Sets the style on <html>. Unless `persist` is false (live preview), it is kept for the next load. */
export function applyUiStyle(id, { persist = true } = {}) {
  const style = normalizeUiStyle(id)
  document.documentElement.dataset.uiStyle = style
  if (persist) { try { localStorage.setItem(STORAGE_KEY, style) } catch { /* storage unavailable */ } }
  return style
}

export function cachedUiStyle() {
  try { return normalizeUiStyle(localStorage.getItem(STORAGE_KEY)) } catch { return DEFAULT_UI_STYLE }
}
