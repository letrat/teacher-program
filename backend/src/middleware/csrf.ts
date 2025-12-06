import { Request, Response, NextFunction } from 'express'
import { generateCSRFToken } from '../lib/auth'
import NodeCache from 'node-cache'
import logger from '../lib/logger'

/**
 * CSRF token storage (in-memory cache)
 * In production with multiple servers, use Redis or database
 */
const csrfTokens = new NodeCache({
  stdTTL: 60 * 60, // 1 hour
  checkperiod: 60 * 5, // Check every 5 minutes
})

/**
 * Generate and store CSRF token
 */
export function generateCSRFTokenForSession(sessionId: string): string {
  const token = generateCSRFToken()
  csrfTokens.set(sessionId, token)
  return token
}

/**
 * Get CSRF token for session
 */
export function getCSRFTokenForSession(sessionId: string): string | undefined {
  return csrfTokens.get<string>(sessionId)
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(sessionId: string, token: string): boolean {
  const storedToken = csrfTokens.get<string>(sessionId)
  return storedToken === token
}

/**
 * Delete CSRF token (on logout)
 */
export function deleteCSRFToken(sessionId: string): void {
  csrfTokens.del(sessionId)
}

/**
 * CSRF protection middleware
 * Only applies to state-changing methods (POST, PUT, DELETE, PATCH)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Skip CSRF for auth endpoints (login, register, refresh)
  // Register may be called without token for first admin creation
  // Note: req.path is relative to the router, not the full path
  if (req.path === '/login' || req.path === '/refresh' || req.path === '/register' || 
      req.path === '/api/auth/login' || req.path === '/api/auth/refresh' || req.path === '/api/auth/register') {
    return next()
  }

  // Get session ID from token or user ID
  const authHeader = req.headers.authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '') || 
                req.cookies?.token || 
                req.headers['x-auth-token'] as string

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح - لا يوجد token' })
  }

  // Use token hash as session ID
  const sessionId = hashToken(token)

  // Get CSRF token from header or body
  const csrfToken = req.headers['x-csrf-token'] as string || 
                    req.body?.csrfToken || 
                    req.query?.csrfToken as string

  if (!csrfToken) {
    logger.warn('CSRF token missing', {
      path: req.path,
      method: req.method,
      sessionId: sessionId.substring(0, 8),
    })
    return res.status(403).json({ error: 'CSRF token مطلوب' })
  }

  // Verify CSRF token
  if (!verifyCSRFToken(sessionId, csrfToken)) {
    logger.warn('CSRF token verification failed', {
      path: req.path,
      method: req.method,
      sessionId: sessionId.substring(0, 8),
    })
    return res.status(403).json({ error: 'CSRF token غير صحيح' })
  }

  next()
}

/**
 * Middleware to add CSRF token to response
 * Call this after authentication to generate CSRF token
 */
export const addCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  // Only add CSRF token if user is authenticated
  const authHeader = req.headers.authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '') || 
                req.cookies?.token || 
                req.headers['x-auth-token'] as string

  if (token) {
    const sessionId = hashToken(token)
    let csrfToken = getCSRFTokenForSession(sessionId)
    
    // Generate new token if doesn't exist
    if (!csrfToken) {
      csrfToken = generateCSRFTokenForSession(sessionId)
    }

    // Add CSRF token to response header
    res.setHeader('X-CSRF-Token', csrfToken)
  }

  next()
}

/**
 * Simple hash function for token (for session ID)
 */
function hashToken(token: string): string {
  let hash = 0
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

