'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { initAuth, getCurrentUser, login, logout, subscribe, AuthState, User } from '@/lib/auth-client'
import { UserRole } from '@/types'

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true })
  const [initialLoading, setInitialLoading] = useState(true) // تتبع التحميل الأولي
  const [redirecting, setRedirecting] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Initialize auth from localStorage immediately
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('auth_user')
      const storedToken = localStorage.getItem('auth_token')
      
      if (storedUser && storedToken) {
        try {
          const user = JSON.parse(storedUser)
          setState({ user, token: storedToken, loading: false })
        } catch (e) {
          console.error('Error parsing stored user:', e)
        }
      }
    }
    
    // Initialize auth from localStorage
    initAuth()

    // Subscribe to auth state changes
    const unsubscribe = subscribe((newState) => {
      setState((prevState) => ({
        ...newState,
        // نبقي loading true ما دمنا في مرحلة التحميل الأولي
        loading: initialLoading ? true : newState.loading
      }))
    })

    // Load current user (will verify token with backend)
    getCurrentUser().finally(() => {
      setInitialLoading(false)
      setState((prev) => ({ ...prev, loading: false }))
    })

    // معالج لتسجيل الخروج التلقائي عند 401 أو 403
    const handleUnauthorized = async (event: CustomEvent) => {
      const { reason, message } = event.detail || {}
      console.warn('🔐 Unauthorized access detected:', reason, message)
      
      // تسجيل خروج تلقائي
      try {
        await logout()
        // إعادة التوجيه لصفحة تسجيل الدخول
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          router.replace('/login')
        }
      } catch (error) {
        console.error('Error during auto-logout:', error)
        // حتى لو فشل logout، نمسح البيانات المحلية
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_user')
          localStorage.removeItem('auth_token')
          localStorage.removeItem('token')
          localStorage.removeItem('csrf_token')
          document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax'
        }
        setState({ user: null, token: null, loading: false })
        router.replace('/login')
      }
    }

    // إضافة event listener
    if (typeof window !== 'undefined') {
      window.addEventListener('auth:unauthorized', handleUnauthorized as unknown as EventListener)
    }

    return () => {
      unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:unauthorized', handleUnauthorized as unknown as EventListener)
      }
    }
  }, [router])

    // Redirect based on role
  useEffect(() => {
    // Don't redirect while loading or already redirecting
    if (state.loading || redirecting || initialLoading) {
      return
    }
    
    const path = pathname
    const role = state.user?.role

    // If on login/register and authenticated, redirect to dashboard
    if ((path === '/login' || path === '/register') && state.user && role) {
      setRedirecting(true)
      // Use router.replace instead of window.location to avoid full page reload
      if (role === UserRole.ADMIN) {
        router.replace('/admin')
      } else if (role === UserRole.SCHOOL_MANAGER) {
        router.replace('/school')
      } else if (role === UserRole.TEACHER) {
        router.replace('/teacher')
      }
      // Reset redirecting flag after a delay
      setTimeout(() => setRedirecting(false), 1000)
      return
    }

    // If on protected route and not authenticated, redirect to login
    // But only if we're sure the user is not authenticated (not just loading)
    // IMPORTANT: Don't redirect if token exists - it might just need verification
    if (!state.loading && !state.user && path !== '/login' && path !== '/register' && !initialLoading) {
      // Check localStorage as fallback - only redirect if NO token at all
      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('token')
        if (!storedToken) {
          // No token at all - safe to redirect
          setRedirecting(true)
          router.replace('/login')
          setTimeout(() => setRedirecting(false), 1000)
          return
        }
        // Token exists but user is null - might be invalid
        // Don't redirect immediately - let getCurrentUser() retry
        // This prevents auto-logout when backend is temporarily unavailable
      } else {
        // Server-side: redirect if no user
        setRedirecting(true)
        router.replace('/login')
        setTimeout(() => setRedirecting(false), 1000)
        return
      }
    }

    // Check role-based access
    if (state.user && role && !initialLoading) {
      if (path.startsWith('/admin') && role !== UserRole.ADMIN) {
        setRedirecting(true)
        router.replace('/login')
        setTimeout(() => setRedirecting(false), 1000)
      } else if (path.startsWith('/school') && role !== UserRole.SCHOOL_MANAGER) {
        setRedirecting(true)
        router.replace('/login')
        setTimeout(() => setRedirecting(false), 1000)
      } else if (path.startsWith('/teacher') && role !== UserRole.TEACHER) {
        setRedirecting(true)
        router.replace('/login')
        setTimeout(() => setRedirecting(false), 1000)
      }
    }
  }, [state.user, state.loading, pathname, router, redirecting, initialLoading])

  const handleLogin = async (username: string, password: string) => {
    try {
      const user = await login(username, password)
      return user
    } catch (error) {
      // Re-throw error to be handled by login page
      throw error
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const refresh = async () => {
    await getCurrentUser()
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login: handleLogin,
        logout: handleLogout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

