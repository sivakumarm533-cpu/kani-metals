const configuredApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '')
const API_BASE_URL = configuredApiUrl
  ? `${configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '')}/api`
  : ''

export async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error('Backend API URL is missing. Set VITE_API_URL in the frontend deployment to your backend URL ending in /api, then redeploy.')
  }
  const endpoint = path.startsWith('/') ? path : `/${path}`
  const token = localStorage.getItem('kani-auth-token')
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`)
    error.code = data.code
    throw error
  }
  return data
}
