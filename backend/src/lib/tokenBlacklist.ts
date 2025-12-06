import NodeCache from 'node-cache'

/**
 * Token blacklist for logout functionality
 * In production with high traffic, consider using Redis
 */
const blacklist = new NodeCache({
  stdTTL: 7 * 24 * 60 * 60, // 7 days (matches token expiration)
  checkperiod: 60 * 60, // Check for expired tokens every hour
})

/**
 * Add token to blacklist
 */
export function blacklistToken(token: string): void {
  // Store token hash to save memory
  const tokenHash = hashToken(token)
  blacklist.set(tokenHash, true)
}

/**
 * Check if token is blacklisted
 */
export function isTokenBlacklisted(token: string): boolean {
  const tokenHash = hashToken(token)
  return blacklist.has(tokenHash)
}

/**
 * Hash token for storage (simple hash for memory efficiency)
 */
function hashToken(token: string): string {
  // Simple hash function - in production, use crypto.createHash
  let hash = 0
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

/**
 * Clear all blacklisted tokens (for testing/admin purposes)
 */
export function clearBlacklist(): void {
  blacklist.flushAll()
}

