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
