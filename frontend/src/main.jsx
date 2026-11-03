import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyTheme, cachedThemeId } from './theme/themes.js'

// Apply the last used theme before the first paint so colours do not flash.
applyTheme(cachedThemeId())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
