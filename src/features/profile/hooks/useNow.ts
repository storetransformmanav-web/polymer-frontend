import { useEffect, useState } from 'react'

/** The time now, updated every second — what the PIN's countdowns are worked out from. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
