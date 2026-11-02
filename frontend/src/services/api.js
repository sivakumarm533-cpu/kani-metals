const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const API_BASE_URL = `${configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '')}/api`

export async function apiRequest(path, options = {}) {
  const endpoint = path.startsWith('/') ? path : `/${path}`
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`)
  }
  return data
}
