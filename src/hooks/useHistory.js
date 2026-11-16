import { useEffect, useState } from 'react'
import { HISTORY_EVENT, getHistory } from '../lib/history.js'

export function useHistory() {
  const [entries, setEntries] = useState(getHistory)

  useEffect(() => {
    function refresh() {
      setEntries(getHistory())
    }
    window.addEventListener(HISTORY_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(HISTORY_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return entries
}
