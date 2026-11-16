import { useEffect, useState } from 'react'
import { getJson } from '../lib/api.js'

// Loads `url` (skips when null). The result is keyed by url, so a new url
// reads as loading straight away without resetting state inside the effect.
export function useApi(url) {
  const [state, setState] = useState({ url: null, data: null, error: null })

  useEffect(() => {
    if (!url) return undefined
    let cancelled = false
    getJson(url).then(
      (data) => {
        if (!cancelled) setState({ url, data, error: null })
      },
      (error) => {
        if (!cancelled) setState({ url, data: null, error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [url])

  const current = state.url === url
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: Boolean(url) && !current,
  }
}
