/*
 * In-app translation with the Google Translate website widget.
 *
 * - English (the default) loads nothing, and the browser's own "Translate this page?"
 *   popup stays off (index.html marks the page translate="no").
 * - Another language: the widget is loaded once, hidden, and translates the page.
 *   Google's own toolbar and tooltips are hidden by CSS (styles/app-shell.css).
 *
 * The choice is saved on the profile (preferences.language) and kept on this device so
 * the app opens translated straight away. Keep codes in sync with LANGUAGE_CODES in
 * backend/config/features.js.
 */

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
]

const STORAGE_KEY = 'kani-language'
const isKnown = (code) => LANGUAGES.some((language) => language.code === code)

export function savedLanguage() {
  try { const code = localStorage.getItem(STORAGE_KEY); return isKnown(code) ? code : 'en' } catch { return 'en' }
}

/** Google reads the target language from the "googtrans" cookie. */
function setTranslateCookie(code) {
  const host = window.location.hostname
  const domains = ['', host, host.split('.').length > 2 ? `.${host.split('.').slice(-2).join('.')}` : '']
  for (const domain of new Set(domains)) {
    const scope = `path=/${domain ? `; domain=${domain}` : ''}`
    if (code === 'en') document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${scope}`
    else document.cookie = `googtrans=/en/${code}; ${scope}`
  }
}

/**
 * Keeps React and Google Translate in step. Only installed while a translation is active.
 *
 * Google replaces each text node with a <font> holding the translation, but React keeps
 * the original text node and updates or removes *that* node later. Without this guard:
 *   - React could crash ("removeChild ... is not a child"),
 *   - a changed number (₹0 → ₹7,450, "All (0)" → "All (7)") would keep showing the old value,
 *   - removed text could stay on screen.
 * For each text node React owns, we track what currently shows it on screen (Google's
 * <font>, or a fresh copy of the text). When React changes the text, a fresh copy with the
 * new value is shown. Google translates most of these again; a few labels that change right
 * after a page opens can stay in English, but the value shown is always the current one.
 * When React removes the text, what is on screen is removed.
 */
function protectReactFromTranslation() {
  if (window.__kaniTranslateGuard) return
  window.__kaniTranslateGuard = true
  const removeChild = Node.prototype.removeChild
  const insertBefore = Node.prototype.insertBefore
  const replaceChild = Node.prototype.replaceChild
  const nodeValue = Object.getOwnPropertyDescriptor(Node.prototype, 'nodeValue')

  const shownBy = new WeakMap() // React's text node -> node showing it on screen
  const wrapperOf = new WeakMap() // React's text node -> <span> holding its fresh copy
  const copyOf = new WeakMap() // fresh copy -> React's text node
  const changed = new WeakSet() // text React changed while Google may be translating the old value
  const isText = (node) => node?.nodeType === Node.TEXT_NODE
  const owner = (node) => copyOf.get(node) || node

  /** The outermost node currently standing in for React's text node on screen. */
  const onScreen = (original) => {
    const wrapper = wrapperOf.get(original)
    if (wrapper?.isConnected) return wrapper
    const shown = shownBy.get(original)
    return shown?.isConnected ? shown : null
  }

  /**
   * Shows React's current text through a fresh copy inside a new <span>: Google only
   * translates newly added elements, so this gets the new value translated.
   */
  function showFresh(original) {
    const current = onScreen(original)
    if (!current) return
    const wrapper = document.createElement('span')
    wrapper.className = 'kani-tr'
    const copy = document.createTextNode(nodeValue.get.call(original))
    copyOf.set(copy, original)
    wrapper.appendChild(copy)
    wrapperOf.set(original, wrapper)
    shownBy.set(original, copy)
    replaceChild.call(current.parentNode, wrapper, current)
  }

  Node.prototype.removeChild = function guardedRemoveChild(child) {
    if (child.parentNode !== this) {
      // React removing text that Google replaced: remove what is actually on screen.
      const shown = onScreen(child)
      if (shown?.parentNode === this) { shownBy.delete(child); wrapperOf.delete(child); return removeChild.call(this, shown) }
      return child
    }
    const font = isText(child) && child.previousSibling?.nodeName === 'FONT' ? child.previousSibling : null
    const original = owner(child)
    if (font) shownBy.set(original, font)
    const result = removeChild.call(this, child)
    // Google just showed a translation of an older value: show the current one instead.
    if (font && changed.has(original)) {
      changed.delete(original)
      window.setTimeout(() => showFresh(original), 0)
    }
    return result
  }
  Node.prototype.replaceChild = function guardedReplaceChild(next, old) {
    if (old?.parentNode !== this) {
      const shown = onScreen(old)
      if (shown?.parentNode === this) { shownBy.delete(old); wrapperOf.delete(old); return replaceChild.call(this, next, shown) }
      return old
    }
    if (isText(old) && next?.nodeName === 'FONT') shownBy.set(owner(old), next)
    return replaceChild.call(this, next, old)
  }
  Node.prototype.insertBefore = function guardedInsertBefore(node, reference) {
    if (reference && reference.parentNode !== this) {
      // A late Google translation of text that has since changed: drop it.
      if (node?.nodeName === 'FONT') return node
      const shown = onScreen(reference)
      return insertBefore.call(this, node, shown?.parentNode === this ? shown : null)
    }
    return insertBefore.call(this, node, reference)
  }

  Object.defineProperty(Node.prototype, 'nodeValue', {
    configurable: true,
    enumerable: nodeValue.enumerable,
    get() { return nodeValue.get.call(this) },
    set(value) {
      nodeValue.set.call(this, value)
      if (!isText(this)) return
      if (this.isConnected) changed.add(this)
      else showFresh(this)
    },
  })
}

/** Starts the translation for this page load (called once from main.jsx). */
export function startTranslation(code = savedLanguage()) {
  setTranslateCookie(code)
  if (code === 'en') return
  // Allow the widget to translate (index.html blocks translation for English).
  document.documentElement.removeAttribute('translate')
  document.querySelector('meta[name="google"]')?.remove()
  document.documentElement.classList.add('is-translated')
  protectReactFromTranslation()

  const holder = document.createElement('div')
  holder.id = 'google_translate_element'
  holder.hidden = true
  document.body.appendChild(holder)
  window.kaniTranslateInit = () => {
    // eslint-disable-next-line no-undef
    new google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: LANGUAGES.map((language) => language.code).join(','), autoDisplay: false }, 'google_translate_element')
  }
  const script = document.createElement('script')
  script.src = 'https://translate.google.com/translate_a/element.js?cb=kaniTranslateInit'
  script.async = true
  document.head.appendChild(script)
}

/** Saves the choice on this device and reloads so the page is translated (or restored to English). */
export function switchLanguage(code) {
  const next = isKnown(code) ? code : 'en'
  try { localStorage.setItem(STORAGE_KEY, next) } catch { /* the cookie still carries the choice */ }
  setTranslateCookie(next)
  window.location.reload()
}

/** Keeps this device in step with the language saved on the profile (e.g. chosen on another phone). */
export function syncLanguage(code) {
  if (!isKnown(code) || code === savedLanguage()) return
  // At most once per tab, so a browser that blocks storage cannot reload forever.
  try {
    if (sessionStorage.getItem('kani-language-synced') === code) return
    sessionStorage.setItem('kani-language-synced', code)
  } catch { return }
  switchLanguage(code)
}
