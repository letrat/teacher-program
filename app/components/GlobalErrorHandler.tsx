'use client'

import { useEffect } from 'react'

export default function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Ignore browser extension errors
      if (event.reason?.message?.includes('message channel')) {
        event.preventDefault()
        console.warn('Browser extension error ignored:', event.reason)
        return
      }
      // Log other unhandled rejections for debugging
      console.error('Unhandled promise rejection:', event.reason)
    }

    // Handle general errors
    const handleError = (event: ErrorEvent) => {
      // Ignore browser extension errors
      if (event.message?.includes('message channel')) {
        event.preventDefault()
        return
      }
      console.error('Global error:', event.error)
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  return null // This component doesn't render anything
}









