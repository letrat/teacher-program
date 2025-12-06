'use client'

import { useState, useEffect } from 'react'

interface WindowSize {
  width: number
  height: number
}

/**
 * Custom hook to track window size
 * Returns { width: 0, height: 0 } on server side to prevent hydration issues
 */
export function useWindowSize(): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    // Set initial size
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}





