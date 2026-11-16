// In-memory sliding-window limiter, keyed by client IP. Resets when the server
// restarts, which is fine for keeping one visitor from burning paid lookups.
export function createLimiter({ limit, windowMs }) {
  const hits = new Map()

  return function take(key) {
    const now = Date.now()
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs)
    if (recent.length >= limit) {
      hits.set(key, recent)
      return false
    }
    recent.push(now)
    hits.set(key, recent)
    // Drop idle keys now and then so the map doesn't grow forever.
    if (hits.size > 5000) {
      for (const [k, times] of hits) if (times.every((time) => now - time >= windowMs)) hits.delete(k)
    }
    return true
  }
}
