const configuredApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '')
export const API_BASE_URL = configuredApiUrl
  ? `${configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '')}/api`
  : ''

export const AUTH_TOKEN_KEY = 'kani-auth-token'
export const AUTH_EXPIRED_EVENT = 'kani-auth-expired'

export function getAuthToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || memoryToken } catch { return memoryToken }
}

let memoryToken = null

export function setAuthToken(token) {
  memoryToken = token || null
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    else { localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(AUTH_USER_KEY) }
  } catch { /* storage unavailable (private mode); the session lasts for this page only */ }
}

/**
 * The signed-in user is cached so the app can open instantly on the next visit
 * while the session is confirmed with the server in the background.
 */
export const AUTH_USER_KEY = 'kani-auth-user'

export function getCachedUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null') } catch { return null }
}

export function setCachedUser(user) {
  try {
    if (!user) { localStorage.removeItem(AUTH_USER_KEY); return }
    try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user)) }
    // A large profile photo can exceed the storage quota; keep everything else.
    catch { localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ ...user, profilePicture: '' })) }
  } catch { /* storage unavailable */ }
}

// Sign-in endpoints legitimately answer 401 for a wrong password; that must not end an existing session.
const publicAuthPaths = ['/auth/login', '/auth/totp/', '/auth/status']

/**
 * Low-level request helper. Returns the raw Response so callers can read blobs
 * (backup export) as well as JSON. Adds the bearer token and turns network
 * failures into a readable message.
 */
export async function apiFetch(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error('Backend API URL is missing. Set VITE_API_URL in the frontend deployment to your backend URL ending in /api, then redeploy.')
  }
  const endpoint = path.startsWith('/') ? path : `/${path}`
  const token = getAuthToken()
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  let response
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('Could not reach the server. Check your internet connection and try again.', { cause: error })
  }
  if (response.status === 401 && token && !publicAuthPaths.some((prefix) => endpoint.startsWith(prefix))) {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
  }
  return response
}

export async function apiRequest(path, options = {}) {
  const response = await apiFetch(path, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`)
    error.code = data.code
    error.status = response.status
    throw error
  }
  return data
}
