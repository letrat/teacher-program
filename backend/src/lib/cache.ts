import NodeCache from 'node-cache'

/**
 * In-memory cache for API responses
 * For production with 10,000+ users, consider using Redis
 */

const cache = new NodeCache({
  stdTTL: 300, // Default TTL: 5 minutes
  checkperiod: 60, // Check for expired keys every minute
  useClones: false, // Better performance
})

/**
 * Cache keys
 */
export const CacheKeys = {
  DASHBOARD_STATS: (schoolId: string) => `dashboard:stats:${schoolId}`,
  KPI_LIST: (schoolId: string, jobTypeId?: string) => 
    jobTypeId ? `kpi:list:${schoolId}:${jobTypeId}` : `kpi:list:${schoolId}`,
  JOB_TYPES: 'job:types:all',
  TEACHER_SCORES: (schoolId: string) => `teacher:scores:${schoolId}`,
  NOTIFICATIONS: (userId: string) => `notifications:${userId}`,
} as const

/**
 * Get cached value
 */
export function getCache<T>(key: string): T | undefined {
  return cache.get<T>(key)
}

/**
 * Set cached value
 */
export function setCache<T>(key: string, value: T, ttl?: number): boolean {
  return cache.set(key, value, ttl || 300)
}

/**
 * Delete cached value
 */
export function deleteCache(key: string): number {
  return cache.del(key)
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.flushAll()
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware(ttl: number = 300) {
  return (req: any, res: any, next: any) => {
    const key = req.originalUrl || req.url
    const cached = getCache(key)

    if (cached) {
      return res.json(cached)
    }

    // Store original json method
    const originalJson = res.json.bind(res)
    res.json = function (data: any) {
      setCache(key, data, ttl)
      return originalJson(data)
    }

    next()
  }
}

export default cache









