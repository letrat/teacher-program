import NodeCache from 'node-cache'
import logger from './logger'

/**
 * Account lockout management
 * Tracks failed login attempts and locks accounts after threshold
 */

const lockoutCache = new NodeCache({
  stdTTL: 15 * 60, // 15 minutes
  checkperiod: 60, // Check every minute
})

export const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 // 15 minutes in seconds

/**
 * Record a failed login attempt
 * Note: Admin accounts are never locked
 */
export function recordFailedAttempt(username: string, userRole?: string): {
  attempts: number
  isLocked: boolean
  lockoutUntil?: Date
} {
  // Admin accounts are never locked
  if (userRole === 'ADMIN') {
    return {
      attempts: 0,
      isLocked: false,
    }
  }

  const key = `lockout:${username}`
  const current = lockoutCache.get<number>(key) || 0
  const newAttempts = current + 1

  lockoutCache.set(key, newAttempts, LOCKOUT_DURATION)

  const isLocked = newAttempts >= MAX_FAILED_ATTEMPTS
  const lockoutUntil = isLocked 
    ? new Date(Date.now() + LOCKOUT_DURATION * 1000)
    : undefined

  if (isLocked) {
    logger.warn('Account locked due to failed login attempts', {
      username,
      attempts: newAttempts,
      lockoutUntil,
    })
  }

  return {
    attempts: newAttempts,
    isLocked,
    lockoutUntil,
  }
}

/**
 * Check if account is locked
 * Note: Admin accounts are never locked
 */
export function isAccountLocked(username: string, userRole?: string): {
  isLocked: boolean
  lockoutUntil?: Date
  remainingAttempts?: number
} {
  // Admin accounts are never locked
  if (userRole === 'ADMIN') {
    return {
      isLocked: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
    }
  }

  const key = `lockout:${username}`
  const attempts = lockoutCache.get<number>(key) || 0

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    const ttl = lockoutCache.getTtl(key) || 0
    const lockoutUntil = new Date(ttl)

    return {
      isLocked: true,
      lockoutUntil,
    }
  }

  return {
    isLocked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - attempts,
  }
}

/**
 * Clear lockout for a specific username (useful for admin accounts)
 */
export function clearLockout(username: string): void {
  const key = `lockout:${username}`
  lockoutCache.del(key)
}

/**
 * Clear failed attempts (on successful login)
 */
export function clearFailedAttempts(username: string): void {
  const key = `lockout:${username}`
  lockoutCache.del(key)
}

