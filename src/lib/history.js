// Recently viewed products and lookups, shown in the sidebar. Kept in
// localStorage, so it's per browser and needs no account.
const STORAGE_KEY = 'clearcart_history'
const MAX_ENTRIES = 30

export const HISTORY_EVENT = 'clearcart:history-updated'

export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// One entry per page: viewing it again moves it back to the top.
export function recordVisit(label, to) {
  try {
    const entries = [{ label, to, viewedAt: Date.now() }, ...getHistory().filter((entry) => entry.to !== to)]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
    window.dispatchEvent(new Event(HISTORY_EVENT))
  } catch {
    // localStorage unavailable (e.g. private browsing): history just won't persist.
  }
}
