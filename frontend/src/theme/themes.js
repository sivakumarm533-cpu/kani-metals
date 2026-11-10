/**
 * Application themes. Each theme has an accent colour and a background pattern.
 * Shades (hover, strong text, soft backgrounds) are derived from the accent so
 * every page that uses the --color-primary* tokens follows the theme.
 */
const hexToRgb = (hex) => {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16))
}
const rgbToHex = (rgb) => `#${rgb.map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')}`
const mix = (hex, target, amount) => {
  const from = hexToRgb(hex)
  const to = hexToRgb(target)
  return rgbToHex(from.map((part, index) => part + (to[index] - part) * amount))
}
const rgba = (hex, alpha) => `rgb(${hexToRgb(hex).join(' ')} / ${alpha})`

/** CSS background layers for each pattern, drawn in the theme colour at `alpha`. */
export function patternLayers(pattern, color, alpha = 0.07) {
  const c = rgba(color, alpha)
  switch (pattern) {
    case 'dots': return { image: `radial-gradient(${c} 1.3px, transparent 1.6px)`, size: '18px 18px' }
    case 'grid': return { image: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`, size: '26px 26px' }
    case 'diagonal': return { image: `repeating-linear-gradient(45deg, ${c} 0 1px, transparent 1px 14px)`, size: 'auto' }
    case 'waves': return { image: `radial-gradient(circle at 100% 50%, transparent 20%, ${c} 21%, ${c} 30%, transparent 31%), radial-gradient(circle at 0% 50%, transparent 20%, ${c} 21%, ${c} 30%, transparent 31%)`, size: '32px 20px', position: '0 0, 16px 10px' }
    case 'crosshatch': return { image: `repeating-linear-gradient(45deg, ${c} 0 1px, transparent 1px 16px), repeating-linear-gradient(-45deg, ${c} 0 1px, transparent 1px 16px)`, size: 'auto' }
    case 'zigzag': return { image: `linear-gradient(135deg, ${c} 25%, transparent 25%), linear-gradient(225deg, ${c} 25%, transparent 25%), linear-gradient(315deg, ${c} 25%, transparent 25%), linear-gradient(45deg, ${c} 25%, transparent 25%)`, size: '24px 24px', position: '-12px 0, -12px 0, 0 0, 0 0' }
    case 'triangles': return { image: `linear-gradient(45deg, ${c} 25%, transparent 25%), linear-gradient(-45deg, ${c} 25%, transparent 25%)`, size: '26px 26px' }
    case 'checker': return { image: `conic-gradient(${c} 25%, transparent 0 50%, ${c} 0 75%, transparent 0)`, size: '28px 28px' }
    case 'rings': return { image: `radial-gradient(circle, transparent 7px, ${c} 8px, ${c} 9px, transparent 10px)`, size: '30px 30px' }
    case 'lines': return { image: `repeating-linear-gradient(0deg, ${c} 0 1px, transparent 1px 12px)`, size: 'auto' }
    // Scattered snowflakes of two sizes.
    case 'snow': {
      const big = rgba(color, Math.min(1, alpha * 1.6))
      return { image: `radial-gradient(${big} 2px, transparent 2.6px), radial-gradient(${c} 1.2px, transparent 1.7px), radial-gradient(${c} 1.5px, transparent 2px)`, size: '64px 64px, 40px 40px, 52px 52px', position: '0 0, 20px 26px, 34px 8px' }
    }
    // Kolam: a grid of rice-flour dots with loops drawn around alternate dots.
    case 'kolam': {
      const dot = rgba(color, Math.min(1, alpha * 1.8))
      return { image: `radial-gradient(${dot} 1.5px, transparent 2px), radial-gradient(circle, transparent 9px, ${c} 9.5px, ${c} 10.5px, transparent 11px)`, size: '28px 28px, 56px 56px', position: '0 0, 14px 14px' }
    }
    case 'sparkle': {
      const big = rgba(color, Math.min(1, alpha * 1.8))
      return { image: `radial-gradient(${big} 1.6px, transparent 2.1px), radial-gradient(${c} 1px, transparent 1.5px)`, size: '34px 34px, 21px 21px', position: '0 0, 11px 14px' }
    }
    case 'splash': return { image: `radial-gradient(${c} 3px, transparent 3.6px), radial-gradient(${c} 1.6px, transparent 2.1px), radial-gradient(${c} 2.2px, transparent 2.8px)`, size: '46px 46px, 27px 27px, 61px 61px', position: '0 0, 13px 9px, 30px 22px' }
    case 'stars': return { image: `radial-gradient(${c} 1.1px, transparent 1.6px), radial-gradient(${c} .8px, transparent 1.3px)`, size: '41px 41px, 23px 23px', position: '0 0, 15px 8px' }
    case 'bubbles': return { image: `radial-gradient(circle, transparent 4px, ${c} 4.5px, ${c} 5.5px, transparent 6px), radial-gradient(${c} 1.2px, transparent 1.7px)`, size: '40px 40px, 22px 22px', position: '0 0, 9px 13px' }
    case 'lattice': return { image: `repeating-linear-gradient(60deg, ${c} 0 1px, transparent 1px 18px), repeating-linear-gradient(-60deg, ${c} 0 1px, transparent 1px 18px)`, size: 'auto' }
    default: return { image: 'none', size: 'auto' }
  }
}

export const THEMES = [
  { id: 'copper', name: 'Copper', description: 'Kani Metals copper (default)', primary: '#B96C35', pattern: 'dots', patternName: 'Dots' },
  { id: 'ocean', name: 'Ocean Blue', description: 'Calm and professional', primary: '#2563EB', pattern: 'grid', patternName: 'Grid' },
  { id: 'emerald', name: 'Emerald', description: 'Fresh green, easy on the eyes', primary: '#059669', pattern: 'diagonal', patternName: 'Diagonal lines' },
  { id: 'royal', name: 'Royal Purple', description: 'Bold and modern', primary: '#7C3AED', pattern: 'waves', patternName: 'Waves' },
  { id: 'crimson', name: 'Crimson', description: 'Strong red accent', primary: '#DC2626', pattern: 'crosshatch', patternName: 'Crosshatch' },
  { id: 'teal', name: 'Teal', description: 'Cool blue-green', primary: '#0D9488', pattern: 'zigzag', patternName: 'Zigzag' },
  { id: 'steel', name: 'Steel Grey', description: 'Neutral metal tones', primary: '#475569', pattern: 'triangles', patternName: 'Triangles' },
  { id: 'gold', name: 'Gold', description: 'Polished gold with a gold-coin garland and satin sheen', primary: '#B07D1C', pattern: 'sparkle', patternName: 'Gold glints', tier: 'premium', festive: true, barColor: '#b07d1c', sideColor: '#2e2013' },
  { id: 'rose', name: 'Rose', description: 'Soft pink accent', primary: '#DB2777', pattern: 'rings', patternName: 'Rings' },
  { id: 'midnight', name: 'Midnight', description: 'Deep indigo glass with a neon violet glow', primary: '#4F46E5', pattern: 'grid', patternName: 'Neon grid', tier: 'premium', festive: true, barColor: '#17153b', sideColor: '#141238' },
  // Festive: red accent, snowflake background, Christmas-lights stripe and gentle snowfall (see styles/features.css).
  // Festive: saffron bar with a kolam border, mango-leaf thoranam, pongal pot and sugarcane (see styles/features.css).
  { id: 'pongal', name: 'Pongal', description: 'Harvest festival: kolam, thoranam, pongal pot and sugarcane', primary: '#EA580C', pattern: 'kolam', patternName: 'Kolam', tier: 'premium', festive: true, barColor: '#ea580c', sideColor: '#14532d' },
  { id: 'diwali', name: 'Diwali', description: 'Festival of lights: lanterns, a lit diya and sparkles', primary: '#7E22CE', pattern: 'sparkle', patternName: 'Sparkles', tier: 'premium', festive: true, barColor: '#5b21b6', sideColor: '#5c1010' },
  { id: 'holi', name: 'Holi', description: 'Festival of colours: splashes, rainbow and dripping colours', primary: '#C026D3', pattern: 'splash', patternName: 'Colour splash', tier: 'premium', festive: true, barColor: '#c026d3', sideColor: '#28245f' },
  { id: 'aurora', name: 'Aurora', description: 'Night sky with moving northern lights, stars and a moon', primary: '#0F766E', pattern: 'stars', patternName: 'Stars', tier: 'premium', festive: true, barColor: '#0b1026', sideColor: '#0a1020' },
  { id: 'deepsea', name: 'Deep Sea', description: 'Ocean waves, rising bubbles and a little fish', primary: '#0E7490', pattern: 'bubbles', patternName: 'Bubbles', tier: 'premium', festive: true, barColor: '#0e7490', sideColor: '#08385a' },
  { id: 'luxe', name: 'Black Gold', description: 'Black and gold with a shimmer sweep and a crown', primary: '#A16207', pattern: 'lattice', patternName: 'Gold lattice', tier: 'premium', festive: true, barColor: '#0c0a09', sideColor: '#141110' },
  { id: 'christmas', name: 'Christmas', description: 'Festive red with snow and lights', primary: '#C0262D', pattern: 'snow', patternName: 'Snowflakes', tier: 'premium', festive: true, barColor: '#b3202a', sideColor: '#11472f' },
]

/** Theme groups. Themes without a tier are Normal. */
export const THEME_TIERS = [
  { id: 'normal', name: 'Normal themes', description: 'Simple colour and pattern themes.' },
  { id: 'premium', name: 'Premium themes', description: 'Special themes with extra styling such as dark menus or festive effects.' },
]
export const themeTier = (theme) => (theme?.tier === 'premium' ? 'premium' : 'normal')
export const isPremiumTheme = (theme) => themeTier(theme) === 'premium'
export const THEME_IDS = THEMES.map((theme) => theme.id)

export const DEFAULT_THEME = 'copper'
const STORAGE_KEY = 'kani-theme'

export const findTheme = (id) => THEMES.find((theme) => theme.id === id) || THEMES[0]

export function themeTokens(theme) {
  const primary = theme.primary
  return {
    '--color-primary': primary,
    '--color-primary-hover': mix(primary, '#000000', 0.12),
    '--color-primary-strong': mix(primary, '#000000', 0.26),
    '--color-primary-soft': mix(primary, '#ffffff', 0.9),
    '--color-primary-faint': mix(primary, '#ffffff', 0.96),
    '--color-link': mix(primary, '#000000', 0.26),
    '--color-primary-rgb': hexToRgb(primary).join(' '),
    '--focus-ring': `0 0 0 3px ${rgba(primary, 0.32)}`,
  }
}

/**
 * Applies a theme to the whole document. Unless `persist` is false (live preview),
 * it is remembered for the next page load.
 */
export function applyTheme(id, { persist = true } = {}) {
  const theme = findTheme(id)
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeTokens(theme))) root.style.setProperty(name, value)
  const layers = patternLayers(theme.pattern, theme.primary)
  root.style.setProperty('--app-pattern', layers.image)
  root.style.setProperty('--app-pattern-size', layers.size)
  root.style.setProperty('--app-pattern-position', layers.position || '0 0')
  root.dataset.theme = theme.id
  root.dataset.chrome = theme.darkChrome ? 'dark' : 'light'
  // Festive (premium) themes share the decorated top bar and menu in styles/features.css.
  if (theme.festive) root.dataset.festive = 'true'
  else delete root.dataset.festive
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.barColor || (theme.darkChrome ? '#1e1b4b' : '#ffffff'))
  if (persist) { try { localStorage.setItem(STORAGE_KEY, theme.id) } catch { /* storage unavailable */ } }
  return theme
}

export function cachedThemeId() {
  try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME } catch { return DEFAULT_THEME }
}
