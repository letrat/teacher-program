/**
 * Unified Authentication Utilities
 * Combines server-side and client-side auth functions
 */

import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'
import api, { setAuthToken, removeAuthToken } from './api'

// ==================== Types ====================

export interface User {
  id: string
  username: string
  name: string
  role: UserRole
  schoolId?: string
  jobTypeId?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

interface JWTPayload {
  id: string
  username: string
  name: string
  role: UserRole
  schoolId?: string
  jobTypeId?: string
}

// ==================== Server-Side Functions ====================

/**
 * Get current user from server-side (Next.js Server Component)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token) {
      return null
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT_SECRET is not set')
    }

    const decoded = jwt.verify(token, secret) as JWTPayload

    return {
      id: decoded.id,
      username: decoded.username,
      name: decoded.name,
      role: decoded.role,
      schoolId: decoded.schoolId,
      jobTypeId: decoded.jobTypeId,
    }
  } catch (error) {
    return null
  }
}

/**
 * Require authentication (server-side)
 */
export async function requireAuth(requiredRole?: UserRole): Promise<User> {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (requiredRole && user.role !== requiredRole) {
    redirect('/login')
  }

  return user
}

export async function requireAdmin() {
  return requireAuth(UserRole.ADMIN)
}

export async function requireSchoolManager() {
  return requireAuth(UserRole.SCHOOL_MANAGER)
}

export async function requireTeacher() {
  return requireAuth(UserRole.TEACHER)
}

// ==================== Client-Side Functions ====================

// Store auth state in memory (client-side only)
let authState: AuthState = {
  user: null,
  token: null,
  loading: false,
}

const listeners = new Set<(state: AuthState) => void>()

function notifyListeners() {
  listeners.forEach((listener) => listener(authState))
}

function setState(newState: Partial<AuthState>) {
  authState = { ...authState, ...newState }
  notifyListeners()
}

/**
 * Subscribe to auth state changes (client-side)
 */
export function subscribe(listener: (state: AuthState) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Login user (client-side)
 */
export async function login(username: string, password: string): Promise<User> {
  try {
    setState({ loading: true })

    // Health check with timeout
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      const healthCheck = await fetch('http://localhost:5000/health', {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!healthCheck.ok) {
        throw new Error('Backend health check failed')
      }
    } catch (healthError: any) {
      setState({ loading: false })
      const errorMessage = healthError.name === 'AbortError'
        ? 'Backend غير متاح - انتهت مهلة الاتصال'
        : 'Backend غير متاح'

      throw new Error(
        `${errorMessage}!\n` +
        `تأكد من:\n` +
        `1. تشغيل Backend: cd backend && npm run dev\n` +
        `2. Backend يعمل على: http://localhost:5000\n` +
        `3. اختبر: http://localhost:5000/health`
      )
    }

    const response = await api.auth.login(username, password)

    if (!response || !response.user || !response.token) {
      throw new Error('استجابة غير صحيحة من الخادم')
    }

    setAuthToken(response.token)

    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(response.user))
    }

    const newState = {
      user: response.user,
      token: response.token,
      loading: false,
    }
    setState(newState)

    return response.user
  } catch (error: any) {
    setState({ loading: false })

    if (error instanceof Error) {
      throw error
    } else {
      throw new Error(error?.message || 'حدث خطأ في تسجيل الدخول')
    }
  }
}

/**
 * Logout user (client-side)
 */
export async function logout(): Promise<void> {
  try {
    await api.auth.logout()
  } catch (error) {
    // Ignore logout errors
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
 * Get current user (client-side)
 */
export async function getCurrentUserClient(): Promise<User | null> {
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
        // Ignore parse errors
      }
    }
  }

  // Try to fetch from API (only if we have a token)
  const token = getAuthTokenClient()
  if (!token) {
    setState({ user: null, token: null })
    return null
  }

  try {
    const response = await api.auth.me()
    const currentToken = getAuthTokenClient()
    setState({ user: response.user, token: currentToken })

    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(response.user))
    }

    return response.user
  } catch (error: any) {
    // Only clear state if it's a real auth error
    if (error?.message?.includes('غير مصرح') || error?.message?.includes('token') || error?.message?.includes('401')) {
      if (!error.message?.includes('fetch') && !error.message?.includes('Failed to fetch')) {
        setState({ user: null, token: null })
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_user')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('token')
        }
      }
    }
    return null
  }
}

/**
 * Get auth token (client-side)
 */
export function getAuthTokenClient(): string | null {
  // First check in-memory state
  if (authState.token) {
    return authState.token
  }

  if (typeof window === 'undefined') {
    return null
  }

  // Try localStorage
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token')
  if (token) {
    setState({ token })
    return token
  }

  // Fallback to cookies
  const cookies = document.cookie.split(';')
  const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith('token='))
  if (tokenCookie) {
    const cookieToken = tokenCookie.split('=')[1]?.trim()
    if (cookieToken) {
      localStorage.setItem('auth_token', cookieToken)
      localStorage.setItem('token', cookieToken)
      setState({ token: cookieToken })
      return cookieToken
    }
  }

  return null
}

/**
 * Check if user is authenticated (client-side)
 */
export function isAuthenticated(): boolean {
  return !!authState.user || (typeof window !== 'undefined' && !!localStorage.getItem('auth_token'))
}

/**
 * Get current auth state (client-side)
 */
export function getAuthState(): AuthState {
  return { ...authState }
}

/**
 * Initialize auth state from localStorage (client-side)
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
      removeAuthToken()
    }
  }
}







