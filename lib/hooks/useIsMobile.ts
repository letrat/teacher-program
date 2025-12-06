'use client'

import { useMediaQuery } from './useMediaQuery'

/**
 * Custom hook to check if current viewport is mobile
 * Uses Tailwind's default breakpoint: 1024px (lg)
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}

/**
 * Custom hook to check if current viewport is tablet
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 641px) and (max-width: 1023px)')
}

/**
 * Custom hook to check if current viewport is desktop
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}

/**
 * Custom hook to check if current viewport is small mobile
 */
export function useIsSmallMobile(): boolean {
  return useMediaQuery('(max-width: 640px)')
}





