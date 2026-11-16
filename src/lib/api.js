// Empty in dev and when served by the Express server; the backend's URL when
// the frontend is hosted separately (GitHub Pages).
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function request(url, options) {
  const response = await fetch(`${API_BASE_URL}${url}`, options)
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.message || 'Request failed')
    error.status = response.status
    throw error
  }
  return result
}

export function getJson(url) {
  return request(url)
}

export function postJson(url, body) {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
