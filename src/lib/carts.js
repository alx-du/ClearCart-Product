const STORAGE_KEY = 'clearcart_carts'
const MAX_CARTS = 30

export const CARTS_EVENT = 'clearcart:carts-updated'

export function getCarts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getCartById(id) {
  return getCarts().find((cart) => cart.id === id) ?? null
}

function persist(carts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(carts))
    window.dispatchEvent(new Event(CARTS_EVENT))
  } catch {
    // localStorage unavailable (e.g. private browsing) — history just won't persist.
  }
}

// Starts a new history entry for a chat session.
export function addCart(productName, messages) {
  const cart = { id: crypto.randomUUID(), productName, createdAt: Date.now(), messages }
  persist([cart, ...getCarts()].slice(0, MAX_CARTS))
  return cart
}

// Updates the same session's entry in place (and bumps it to the top)
// instead of creating a new sidebar item for every message.
export function updateCart(id, messages) {
  const carts = getCarts()
  const existing = carts.find((cart) => cart.id === id)
  if (!existing) return null
  const updated = { ...existing, messages }
  persist([updated, ...carts.filter((cart) => cart.id !== id)].slice(0, MAX_CARTS))
  return updated
}
