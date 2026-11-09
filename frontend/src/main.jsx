import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/scrollbars.css'
import App from './App.jsx'
import { applyTheme, cachedThemeId } from './theme/themes.js'
import { autoHideScrollbars } from './utils/scrollbars.js'

// Apply the last used theme before the first paint so colours do not flash.
applyTheme(cachedThemeId())
autoHideScrollbars()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * Fades out the opening animation from index.html once the app has drawn.
 * The full animation plays when the app is opened; reloads in the same tab are quicker.
 */
function hideSplash() {
  const splash = document.getElementById('app-splash')
  if (!splash) return
  let seen = false
  try { seen = sessionStorage.getItem('kani-splash-seen') === '1'; sessionStorage.setItem('kani-splash-seen', '1') } catch { /* storage unavailable */ }
  const minimum = seen ? 300 : 1200
  const wait = Math.max(0, minimum - performance.now())
  window.setTimeout(() => {
    requestAnimationFrame(() => {
      splash.classList.add('is-hidden')
      splash.addEventListener('transitionend', () => splash.remove(), { once: true })
      window.setTimeout(() => splash.remove(), 800)
    })
  }, wait)
}
hideSplash()
