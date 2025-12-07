/**
 * Client-side authentication utilities
 * Uses Backend API instead of NextAuth
 */

import api, { setAuthToken, removeAuthToken, setCSRFToken } from './api'
import { UserRole } from '@/types'

export interface User {
  id: string
  username: string
  name: string
  role: UserRole
  schoolId?: string
  jobTypeId?: string
  school?: {
    id: string
    name: string
  }
}

export interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

// Store auth state in memory (can be enhanced with localStorage persistence)
let authState: AuthState = {
  user: null,
  token: null,
  loading: false,
}

const listeners = new Set<(state: AuthState) => void>()

export function subscribe(listener: (state: AuthState) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners() {
  listeners.forEach((listener) => listener(authState))
}

function setState(newState: Partial<AuthState>) {
  authState = { ...authState, ...newState }
  notifyListeners()
}

/**
 * Login user
 */
export async function login(username: string, password: string): Promise<User> {
  try {
    setState({ loading: true })
    
    console.log('🔐 Attempting login...')
    
    // First, check if backend is accessible (with timeout)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
      
      // Use NEXT_PUBLIC_API_URL or current origin for health check
      const healthCheckUrl = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || window.location.origin) + '/health'
        : 'http://localhost:5000/health'
      
      const healthCheck = await fetch(healthCheckUrl, {
        method: 'GET',
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!healthCheck.ok) {
        throw new Error('Backend health check failed')
      }
      console.log('✅ Backend is accessible')
    } catch (healthError: any) {
      setState({ loading: false })
      const errorMessage = healthError.name === 'AbortError' 
        ? 'Backend غير متاح - انتهت مهلة الاتصال'
        : 'Backend غير متاح'
      
      const backendUrl = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || window.location.origin)
        : 'http://localhost:5000'
      
      throw new Error(
        `${errorMessage}!\n` +
        `تأكد من:\n` +
        `1. تشغيل Backend: cd backend && npm run dev\n` +
        `2. Backend يعمل على: ${backendUrl}\n` +
        `3. اختبر: ${backendUrl}/health`
      )
    }
    
    const response = await api.auth.login(username, password)
    console.log('✅ Login response received:', response)
    
    if (!response || !response.user || !response.token) {
      console.error('❌ Invalid response:', response)
      throw new Error('استجابة غير صحيحة من الخادم')
    }
    
    // Validate token format before saving
    const token = response.token.trim()
    if (!token || token.split('.').length !== 3) {
      console.error('❌ Invalid token format:', {
        tokenLength: token.length,
        tokenParts: token.split('.').length,
        tokenPreview: token.substring(0, 20) + '...',
      })
      throw new Error('Token غير صحيح من الخادم')
    }
    
    // Set token first (this will save to localStorage and cookie)
    setAuthToken(token)
    console.log('✅ Token saved')
    
    // Save CSRF token if provided
    if (response.csrfToken) {
      setCSRFToken(response.csrfToken)
      console.log('✅ CSRF token saved')
    }
    
    // Persist user data to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(response.user))
      
      // Verify token was saved
      const tokenSaved = localStorage.getItem('auth_token')
      const cookieSet = document.cookie.includes('token=')
      console.log('✅ User data saved to localStorage')
      console.log('🔑 Token saved:', tokenSaved ? 'Yes' : 'No')
      console.log('🍪 Cookie set:', cookieSet ? 'Yes' : 'No')
      if (cookieSet) {
        const cookieValue = document.cookie.split('token=')[1]?.split(';')[0]
        console.log('🍪 Cookie value length:', cookieValue?.length || 0)
      }
    }
    
    // Update state - this will notify listeners automatically
    const newState = {
      user: response.user,
      token: response.token,
      loading: false,
    }
    setState(newState)
    console.log('✅ Auth state updated:', newState)

    return response.user
  } catch (error: any) {
    console.error('❌ Login error:', error)
    setState({ loading: false })
    
    // Ensure error message is properly formatted
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(error?.message || 'حدث خطأ في تسجيل الدخول')
    }
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await api.auth.logout()
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    removeAuthToken()
    setState({ user: null, token: null })
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_user')
      localStorage.removeItem('auth_token')
    }
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  // Check if we have user in memory
  if (authState.user) {
    return authState.user
  }

  // Check localStorage
  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('auth_user')
    const storedToken = localStorage.getItem('auth_token')
    
    if (storedUser && storedToken) {
      try {
        const user = JSON.parse(storedUser)
        setAuthToken(storedToken)
        setState({ user, token: storedToken })
        return user
      } catch (error) {
        console.error('Error parsing stored user:', error)
      }
    }
  }

  // Try to fetch from API (only if we have a token)
  const token = getAuthToken()
  if (!token) {
    setState({ user: null, token: null })
    return null
  }

  try {
    const response = await api.auth.me()
    const currentToken = getAuthToken()
    setState({ user: response.user, token: currentToken })
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(response.user))
    }
    
    return response.user
  } catch (error: any) {
    // Only clear state if it's a real auth error (not just network error)
    const isNetworkError = error?.message?.includes('fetch') || 
                          error?.message?.includes('Failed to fetch') ||
                          error?.message?.includes('Backend غير متاح') ||
                          error?.name === 'AbortError'
    
    if (error?.message?.includes('غير مصرح') || error?.message?.includes('token') || error?.message?.includes('401') || error?.message?.includes('403')) {
      console.warn('⚠️ Auth error in getCurrentUser:', error.message)
      
      // Only clear token if it's a real auth error (not network)
      if (!isNetworkError) {
        // Check if error is specifically about token expiration/invalidity
        // Be more specific to avoid false positives
        const errorMessage = error.message?.toLowerCase() || ''
        const isTokenExpired = errorMessage.includes('انتهت صلاحية') || 
                              errorMessage.includes('expired') ||
                              errorMessage.includes('منتهية') ||
                              errorMessage.includes('الجلسة منتهية')
        
        const isTokenInvalid = (errorMessage.includes('token') && errorMessage.includes('غير صحيح')) ||
                              (errorMessage.includes('token') && errorMessage.includes('invalid')) ||
                              errorMessage.includes('الجلسة منتهية')
        
        // Only logout for actual token expiration/invalidity errors
        if (isTokenExpired || isTokenInvalid) {
        console.log('🔐 Clearing invalid token and triggering auto-logout')
        setState({ user: null, token: null })
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_user')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('token')
          localStorage.removeItem('csrf_token')
          document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax'
          
            // إرسال event لتسجيل الخروج التلقائي فقط لأخطاء التوكن الحقيقية
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { 
            detail: { reason: 'token_expired_or_invalid', message: error.message } 
          }))
          }
        } else {
          // Other auth errors (permission, etc.) - don't logout, just return null
          console.warn('⚠️ Auth error (not token-related), keeping session:', error.message)
        }
      } else {
        // Network error - keep token for retry
        console.warn('⚠️ Network error, keeping token for retry')
      }
    } else {
      // Other error - keep token
      console.warn('⚠️ getCurrentUser failed (non-auth error):', error.message)
    }
    return null
  }
}

/**
 * Get auth token
 */
export function getAuthToken(): string | null {
  // First check in-memory state
  if (authState.token) {
    return authState.token
  }

  if (typeof window === 'undefined') {
    return null
  }

  // Try localStorage (check both keys for compatibility)
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token')
  if (token) {
    // Update in-memory state
    setState({ token })
    return token
  }

  // Fallback to cookies
  const cookies = document.cookie.split(';')
  const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith('token='))
  if (tokenCookie) {
    // Better parsing - handle cases where token value contains '='
    const parts = tokenCookie.split('=')
    if (parts.length >= 2) {
      const cookieToken = parts.slice(1).join('=').trim()
      // Validate JWT format before using
      if (cookieToken && cookieToken.split('.').length === 3) {
        // Save to localStorage and update state
        localStorage.setItem('auth_token', cookieToken)
        localStorage.setItem('token', cookieToken)
        setState({ token: cookieToken })
        return cookieToken
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Invalid token format in cookie:', {
          tokenLength: cookieToken?.length || 0,
          tokenParts: cookieToken?.split('.').length || 0,
        })
      }
    }
  }

  return null
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!authState.user || (typeof window !== 'undefined' && !!localStorage.getItem('auth_token'))
}

/**
 * Get current auth state
 */
export function getAuthState(): AuthState {
  return { ...authState }
}

/**
 * Initialize auth state from localStorage
 */
export function initAuth() {
  if (typeof window === 'undefined') return

  const storedUser = localStorage.getItem('auth_user')
  const storedToken = localStorage.getItem('auth_token')

  if (storedUser && storedToken) {
    try {
      const user = JSON.parse(storedUser)
      setAuthToken(storedToken)
      setState({ user, token: storedToken })
    } catch (error) {
      console.error('Error initializing auth:', error)
      removeAuthToken()
    }
  }
}
