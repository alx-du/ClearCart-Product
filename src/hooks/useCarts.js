import { useEffect, useState } from 'react'
import { CARTS_EVENT, getCarts } from '../lib/carts.js'

export function useCarts() {
  const [carts, setCarts] = useState(getCarts)

  useEffect(() => {
    function refresh() {
      setCarts(getCarts())
    }
    window.addEventListener(CARTS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CARTS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return carts
}
