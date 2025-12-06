/**
 * API Client for Backend
 * This file provides a centralized way to make API calls to the backend
 */

// Get API URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

// Log API URL in development to help debug
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔗 API Base URL:', API_BASE_URL)
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>
}

/**
 * Make an API request to the backend
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options

  // Build URL with query parameters
  let url = `${API_BASE_URL}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  // Get token from cookies or localStorage
  const token = getAuthToken()

  // Set default headers - ensure Content-Type is set correctly
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string> || {}),
    'Content-Type': 'application/json', // Set after to ensure it's not overridden
  }

  // Add authorization header if token exists
  if (token) {
    // Trim token to remove any whitespace
    const cleanToken = token.trim()
    headers['Authorization'] = `Bearer ${cleanToken}`
    headers['x-auth-token'] = cleanToken // Also send as custom header for middleware
    
    // Get and add CSRF token for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || 'GET')) {
      const csrfToken = getCSRFToken()
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ CSRF token not found for request:', endpoint)
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔑 Sending token in request:', cleanToken.substring(0, 20) + '...')
      console.log('🔑 Token length:', cleanToken.length)
      console.log('🔑 Token ends with:', cleanToken.substring(cleanToken.length - 10))
    }
  } else {
    // Don't warn for auth endpoints (login, register) - it's normal to not have a token
    if (process.env.NODE_ENV === 'development' && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
      console.warn('⚠️ No token found for request:', endpoint)
    }
  }

  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include', // Include cookies for CORS
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)

    // Extract CSRF token from response header if present
    const csrfTokenFromHeader = response.headers.get('X-CSRF-Token')
    if (csrfTokenFromHeader) {
      setCSRFToken(csrfTokenFromHeader)
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ CSRF token received from response header')
      }
    }

    if (!response.ok) {
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        const error = await response.json().catch(() => ({ error: 'غير مصرح - token غير صحيح' }))
        
        // Log the error for debugging
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ 401 Unauthorized - token may be invalid or expired')
          console.warn('   Current token in localStorage:', localStorage.getItem('auth_token') ? 'exists' : 'missing')
          console.warn('   Error message:', error.error)
        }
        
        // Only trigger auto-logout for actual auth errors, not for login endpoint
        const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register')
        if (typeof window !== 'undefined' && !isAuthEndpoint) {
          // Check if error is specifically about token expiration/invalidity
          // Be more specific to avoid false positives
          const errorMessage = error.error?.toLowerCase() || ''
          const isTokenExpired = errorMessage.includes('انتهت صلاحية') || 
                                errorMessage.includes('expired') ||
                                errorMessage.includes('منتهية') ||
                                errorMessage.includes('الجلسة منتهية')
          
          const isTokenInvalid = (errorMessage.includes('token') && errorMessage.includes('غير صحيح')) ||
                                (errorMessage.includes('token') && errorMessage.includes('invalid')) ||
                                errorMessage.includes('الجلسة منتهية')
          
          // Only logout for actual token expiration/invalidity errors
          if (isTokenExpired || isTokenInvalid) {
            // إرسال event لتسجيل الخروج التلقائي فقط لأخطاء التوكن الحقيقية
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { 
            detail: { reason: 'token_expired_or_invalid', message: error.error || 'غير مصرح - token غير صحيح' } 
          }))
          }
        }
        
        throw new Error(error.error || 'غير مصرح - token غير صحيح')
      }
      
      // Handle 403 Forbidden - insufficient permissions
      if (response.status === 403) {
        const error = await response.json().catch(() => ({ error: 'غير مصرح - لا توجد صلاحيات' }))
        
        // Log the error for debugging
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ 403 Forbidden - insufficient permissions')
          console.warn('   Error message:', error.error)
        }
        
        // Only trigger auto-logout for school/subscription errors, not for permission errors
        // And only if NOT on login/register endpoint (user is already logged in)
        const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register')
        const isSchoolError = error.error?.includes('المدرسة') || error.error?.includes('الاشتراك')
        
        if (typeof window !== 'undefined' && isSchoolError && !isAuthEndpoint) {
          // إرسال event لتسجيل الخروج التلقائي فقط لأخطاء المدرسة/الاشتراك
          // ولا يحدث عند محاولة تسجيل الدخول (isAuthEndpoint)
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { 
            detail: { reason: 'school_disabled_or_subscription_expired', message: error.error || 'غير مصرح - لا توجد صلاحيات' } 
          }))
        }
        
        throw new Error(error.error || 'غير مصرح - لا توجد صلاحيات')
      }
      
      const error = await response.json().catch(() => ({ error: 'حدث خطأ' }))
      
      // Include validation details if available
      if (error.details && Array.isArray(error.details)) {
        const detailsMessage = error.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
        throw new Error(`${error.error || 'خطأ في التحقق من البيانات'}\n${detailsMessage}`)
      }
      
      throw new Error(error.error || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error: any) {
    console.error('❌ API request error:', error)
    console.error('📍 Request URL:', url)
    console.error('🔗 API_BASE_URL:', API_BASE_URL)
    
    // Handle abort (timeout) or network errors
    if (error.name === 'AbortError' || 
        (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('ERR_NETWORK_CHANGED')))) {
      const backendUrl = API_BASE_URL.replace('/api', '')
      const errorMessage = `فشل الاتصال بالخادم.\n` +
        `تأكد من:\n` +
        `1. Backend يعمل: cd backend && npm run dev\n` +
        `2. Backend على: ${backendUrl}\n` +
        `3. اختبر: ${backendUrl}/health\n` +
        `4. إذا كان Backend يعمل، أعد تشغيله`
      
      throw new Error(errorMessage)
    }
    
    // Re-throw original error if it's not a connection error
    throw error
  }
}

/**
 * Get authentication token from cookies or localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null

  // Try to get from localStorage first (most reliable)
  let token = localStorage.getItem('auth_token') || localStorage.getItem('token')
  
  if (token && token.trim()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔑 Token found in localStorage, length:', token.length)
    }
    return token.trim()
  }

  // Fallback to cookies
  const cookies = document.cookie.split(';')
  const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith('token='))
  if (tokenCookie) {
    // Better parsing - handle cases where token value contains '='
    const parts = tokenCookie.split('=')
    if (parts.length >= 2) {
      const cookieToken = parts.slice(1).join('=').trim()
      if (cookieToken && cookieToken.trim() && cookieToken.split('.').length === 3) {
        // Validate JWT format before saving
        // Also save to localStorage for next time
        localStorage.setItem('auth_token', cookieToken.trim())
        localStorage.setItem('token', cookieToken.trim())
        if (process.env.NODE_ENV === 'development') {
          console.log('🔑 Token found in cookie, saved to localStorage')
        }
        return cookieToken.trim()
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Invalid token format in cookie:', {
          tokenLength: cookieToken?.length || 0,
          tokenParts: cookieToken?.split('.').length || 0,
        })
      }
    }
  }

  // Only log detailed warnings in development and for non-auth endpoints
  // (It's normal to not have a token for login/register)
  if (process.env.NODE_ENV === 'development') {
    // Only log if we're not on an auth endpoint (to reduce noise)
    const isAuthEndpoint = typeof window !== 'undefined' && 
      (window.location.pathname.includes('/login') || window.location.pathname.includes('/register'))
    
    if (!isAuthEndpoint) {
      console.warn('⚠️ No token found in localStorage or cookies')
      console.warn('   localStorage.auth_token:', localStorage.getItem('auth_token') ? 'exists' : 'missing')
      console.warn('   localStorage.token:', localStorage.getItem('token') ? 'exists' : 'missing')
    }
  }

  return null
}

/**
 * Set authentication token
 */
export function setAuthToken(token: string) {
  if (typeof window === 'undefined') return
  
  // Validate token format before saving
  const trimmedToken = token.trim()
  
  // Validate JWT format (should have 3 parts separated by dots)
  if (!trimmedToken || trimmedToken.split('.').length !== 3) {
    console.error('❌ Invalid token format:', {
      tokenLength: trimmedToken.length,
      tokenParts: trimmedToken.split('.').length,
      tokenPreview: trimmedToken.substring(0, 20) + '...',
    })
    throw new Error('Invalid token format')
  }
  
  // Save to both keys for compatibility
  localStorage.setItem('auth_token', trimmedToken)
  localStorage.setItem('token', trimmedToken)
  
  // Also set cookie for backend middleware
  const maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieString = `token=${trimmedToken}; Path=/; Max-Age=${maxAge}; SameSite=${isProduction ? 'Strict' : 'Lax'}${isProduction ? '; Secure' : ''}`
  document.cookie = cookieString
  
  if (process.env.NODE_ENV === 'development') {
    console.log('💾 Token saved to localStorage and cookie')
    console.log('   auth_token:', localStorage.getItem('auth_token') ? 'saved' : 'failed')
    console.log('   token:', localStorage.getItem('token') ? 'saved' : 'failed')
    console.log('   cookie:', document.cookie.includes('token=') ? 'saved' : 'failed')
    console.log('   token length:', trimmedToken.length)
    console.log('   token parts:', trimmedToken.split('.').length)
  }
}

/**
 * Get CSRF token from localStorage
 */
export function getCSRFToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('csrf_token')
}

/**
 * Save CSRF token to localStorage
 */
export function setCSRFToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem('csrf_token', token)
  if (process.env.NODE_ENV === 'development') {
    console.log('💾 CSRF token saved')
  }
}

/**
 * Remove authentication token
 */
export function removeAuthToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
  localStorage.removeItem('csrf_token') // Also remove CSRF token
  // Also clear cookie by setting it to expire
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax'
}

// API Methods
export const api = {
  // Auth
  auth: {
    login: async (username: string, password: string) => {
      console.log('📡 Sending login request to:', `${API_BASE_URL}/auth/login`)
      const result = await apiRequest<{ user: any; token: string; csrfToken?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      console.log('📥 Login response:', result)
      
      // Save CSRF token if provided
      if (result.csrfToken) {
        setCSRFToken(result.csrfToken)
      }
      
      return result
    },
    register: (data: any) =>
      apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => apiRequest<{ user: any }>('/auth/me'),
    logout: () =>
      apiRequest('/auth/logout', {
        method: 'POST',
      }),
    changePassword: (data: { oldPassword: string; newPassword: string }) =>
      apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Admin
  admin: {
    dashboard: {
      stats: () => apiRequest('/admin/dashboard/stats'),
    },
    schools: {
      list: () => apiRequest('/admin/schools'),
      details: (id: string) => apiRequest(`/admin/schools/${id}/details`),
      create: (data: any) =>
        apiRequest('/admin/schools', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: any) =>
        apiRequest(`/admin/schools/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        apiRequest(`/admin/schools/${id}`, {
          method: 'DELETE',
        }),
      resetPassword: (id: string, newPassword: string) =>
        apiRequest(`/admin/schools/${id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ newPassword }),
        }),
    },
    users: {
      list: () => apiRequest('/admin/users'),
      create: (data: any) =>
        apiRequest('/admin/users', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: any) =>
        apiRequest(`/admin/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        apiRequest(`/admin/users/${id}`, {
          method: 'DELETE',
        }),
    },
    jobTypes: {
      list: () => apiRequest('/admin/job-types'),
      create: (data: any) =>
        apiRequest('/admin/job-types', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: any) =>
        apiRequest(`/admin/job-types/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        apiRequest(`/admin/job-types/${id}`, {
          method: 'DELETE',
        }),
      kpis: (id: string) => apiRequest(`/admin/job-types/${id}/kpis`),
      createKpi: (id: string, data: any) =>
        apiRequest(`/admin/job-types/${id}/kpis`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      previewExcel: async (file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        
        // Get token for authorization
        const token = getAuthToken()
        const csrfToken = getCSRFToken()
        
        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token.trim()}`
          headers['x-auth-token'] = token.trim()
        }
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken
        }
        
        const url = `${API_BASE_URL}/admin/job-types/preview-excel`
        const response = await fetch(url, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData,
        })
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'حدث خطأ في معاينة الملف' }))
          throw new Error(error.error || 'حدث خطأ في معاينة الملف')
        }
        
        return response.json()
      },
      importExcel: async (file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        
        // Get token for authorization
        const token = getAuthToken()
        const csrfToken = getCSRFToken()
        
        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token.trim()}`
          headers['x-auth-token'] = token.trim()
        }
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken
        }
        
        const url = `${API_BASE_URL}/admin/job-types/import-excel`
        const response = await fetch(url, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData,
        })
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'حدث خطأ في استيراد الملف' }))
          throw new Error(error.error || 'حدث خطأ في استيراد الملف')
        }
        
        return response.json()
      },
    },
    kpis: {
      update: (id: string, data: any) =>
        apiRequest(`/admin/kpis/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        apiRequest(`/admin/kpis/${id}`, {
          method: 'DELETE',
        }),
      evidence: (id: string) => apiRequest(`/admin/kpis/${id}/evidence`),
      createEvidence: (id: string, data: any) =>
        apiRequest(`/admin/kpis/${id}/evidence`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },
    evidence: {
      update: (id: string, data: any) =>
        apiRequest(`/admin/evidence/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        apiRequest(`/admin/evidence/${id}`, {
          method: 'DELETE',
        }),
    },
  },

  // School
  school: {
    dashboard: {
      stats: () => apiRequest('/school/dashboard/stats'),
      charts: () => apiRequest('/school/dashboard/charts'),
    },
    teachers: {
      list: () => apiRequest('/school/teachers'),
      create: (data: any) =>
        apiRequest('/school/teachers', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: any) =>
        apiRequest(`/school/teachers/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        apiRequest(`/school/teachers/${id}`, {
          method: 'DELETE',
        }),
      scores: () => apiRequest('/school/teachers/scores'),
      score: (id: string) => apiRequest(`/school/teachers/${id}/score`),
      submissions: (id: string) => apiRequest(`/school/teachers/${id}/submissions`),
    },
    kpis: {
      list: () => apiRequest('/school/kpis'),
      create: (data: any) =>
        apiRequest('/school/kpis', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: any) =>
        apiRequest(`/school/kpis/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        apiRequest(`/school/kpis/${id}`, {
          method: 'DELETE',
        }),
      evidence: {
        create: (kpiId: string, data: any) =>
          apiRequest(`/school/kpis/${kpiId}/evidence`, {
            method: 'POST',
            body: JSON.stringify(data),
          }),
        update: (kpiId: string, data: any) =>
          apiRequest(`/school/kpis/${kpiId}/evidence`, {
            method: 'PUT',
            body: JSON.stringify(data),
          }),
        delete: (kpiId: string, evidenceId: string) =>
          apiRequest(`/school/kpis/${kpiId}/evidence`, {
            method: 'DELETE',
            body: JSON.stringify({ evidenceId }),
          }),
      },
    },
    evidence: {
      pending: () => apiRequest('/school/evidence/pending'),
      review: (id: string, data: any) =>
        apiRequest(`/school/evidence/${id}/review`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },
    jobTypes: {
      list: () => apiRequest('/school/job-types'),
      weights: (jobTypeId: string) =>
        apiRequest(`/school/job-types/${jobTypeId}/kpis/weights`),
      updateWeights: (jobTypeId: string, weights: any[]) => {
        console.log('📤 API - updateWeights called with:', {
          jobTypeId,
          weights,
          weightsIsArray: Array.isArray(weights),
          weightsLength: weights?.length,
          weightsType: typeof weights,
          weightsValue: weights,
        })
        
        if (!Array.isArray(weights)) {
          console.error('❌ ERROR: weights is not an array!', {
            weights,
            type: typeof weights,
            isNull: weights === null,
            isUndefined: weights === undefined,
          })
          throw new Error('يجب إرسال مصفوفة من الأوزان')
        }
        
        if (weights.length === 0) {
          console.error('❌ ERROR: weights array is empty!')
          throw new Error('يجب إرسال مصفوفة غير فارغة من الأوزان')
        }
        
        const bodyData = { weights }
        const bodyString = JSON.stringify(bodyData)
        
        console.log('📤 API - Request body:', {
          bodyData,
          bodyString,
          bodyStringLength: bodyString.length,
          firstWeight: weights[0],
        })
        
        return apiRequest(`/school/job-types/${jobTypeId}/kpis/weights`, {
          method: 'PUT',
          body: bodyString,
        })
      },
      validateWeights: (jobTypeId: string) =>
        apiRequest(`/school/job-types/${jobTypeId}/kpis/weights/validate`),
    },
    reports: () => apiRequest('/school/reports'),
  },

  // Teacher
  teacher: {
    dashboard: () => apiRequest('/teacher/dashboard'),
    jobTypes: () => apiRequest('/teacher/job-types'),
    kpis: (jobTypeId?: string) =>
      apiRequest('/teacher/kpis', {
        params: jobTypeId ? { jobTypeId } : undefined,
      }),
    evidence: (kpiId: string) =>
      apiRequest('/teacher/evidence', {
        params: { kpiId },
      }),
    submitEvidence: (data: any) =>
      apiRequest('/teacher/evidence/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    submissions: () => apiRequest('/teacher/submissions'),
    progress: () => apiRequest('/teacher/progress'),
  },

  // Notifications
  notifications: {
    list: (unreadOnly?: boolean, limit?: number) =>
      apiRequest('/notifications', {
        params: {
          ...(unreadOnly && { unreadOnly: 'true' }),
          ...(limit && { limit: limit.toString() }),
        },
      }),
    markRead: (id: string) =>
      apiRequest(`/notifications/${id}/read`, {
        method: 'PUT',
      }),
    markAllRead: () =>
      apiRequest('/notifications/read-all', {
        method: 'PUT',
      }),
  },

  // Upload
  upload: {
    file: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const token = getAuthToken()
      const csrfToken = getCSRFToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
        headers['x-auth-token'] = token
      }
      
      // Add CSRF token for POST requests
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken
      } else if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ CSRF token not found for file upload')
      }

      // First, try to get CSRF token from a GET request if not available
      if (!csrfToken) {
        try {
          // Make a simple GET request to get CSRF token
          const token = getAuthToken()
          if (token) {
            const preflightResponse = await fetch(`${API_BASE_URL}/teacher/dashboard`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'x-auth-token': token,
              },
              credentials: 'include',
            })
            
            const newCsrfToken = preflightResponse.headers.get('X-CSRF-Token')
            if (newCsrfToken) {
              setCSRFToken(newCsrfToken)
              headers['x-csrf-token'] = newCsrfToken
              if (process.env.NODE_ENV === 'development') {
                console.log('✅ CSRF token obtained from preflight request')
              }
            }
          }
        } catch (preflightError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Failed to get CSRF token from preflight:', preflightError)
          }
        }
      }

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      })

      // Extract CSRF token from response header if present
      const csrfTokenFromHeader = response.headers.get('X-CSRF-Token')
      if (csrfTokenFromHeader) {
        setCSRFToken(csrfTokenFromHeader)
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ CSRF token received from upload response header')
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'حدث خطأ' }))
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    },
  },
}

export default api

