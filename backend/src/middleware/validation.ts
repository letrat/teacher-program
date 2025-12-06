import { Request, Response, NextFunction } from 'express'
import { z, ZodError } from 'zod'
import logger from '../lib/logger'

/**
 * Validation middleware factory
 * Validates request body, params, and query against Zod schema
 */
export function validate(schema: {
  body?: z.ZodSchema<any>
  params?: z.ZodSchema<any>
  query?: z.ZodSchema<any>
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body)
      }

      // Validate params
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params)
      }

      // Validate query
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query)
      }

      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }))

        logger.warn('Validation error', {
          errors,
          path: req.path,
          method: req.method,
        })

        return res.status(400).json({
          error: 'خطأ في التحقق من البيانات',
          details: errors,
        })
      }

      logger.error('Validation middleware error:', { error })
      res.status(500).json({ error: 'حدث خطأ في التحقق من البيانات' })
    }
  }
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj }
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key]) as any
    } else if (Array.isArray(sanitized[key])) {
      // Handle arrays - sanitize each element
      sanitized[key] = sanitized[key].map((item: any) => {
        if (typeof item === 'string') {
          return sanitizeString(item)
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item)
        }
        return item
      }) as any
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]) as any
    }
  }
  
  return sanitized
}

/**
 * Sanitization middleware
 */
export const sanitize = (req: Request, res: Response, next: NextFunction) => {
  // Skip sanitization for PUT /job-types/:jobTypeId/kpis/weights to avoid breaking arrays
  if (req.method === 'PUT' && req.path.includes('/job-types/') && req.path.includes('/kpis/weights')) {
    // For this specific route, we need to preserve the weights array structure
    // Only sanitize string fields within the objects, not the array structure itself
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      if (req.body.weights && Array.isArray(req.body.weights)) {
        // Sanitize only string fields in each weight object, preserve array structure
        req.body.weights = req.body.weights.map((item: any) => {
          if (typeof item === 'object' && item !== null) {
            const sanitized: any = { ...item }
            // Only sanitize string fields
            for (const key in sanitized) {
              if (typeof sanitized[key] === 'string') {
                sanitized[key] = sanitizeString(sanitized[key])
              }
            }
            return sanitized
          }
          return item
        })
      } else {
        // Normal sanitization for other fields
        req.body = sanitizeObject(req.body)
      }
    }
    return next()
  }
  
  // Handle body - could be object or array
  if (req.body) {
    if (Array.isArray(req.body)) {
      // If body is an array, sanitize each element
      req.body = req.body.map((item: any) => {
        if (typeof item === 'string') {
          return sanitizeString(item)
        } else if (typeof item === 'object' && item !== null) {
          return sanitizeObject(item)
        }
        return item
      })
    } else if (typeof req.body === 'object') {
      req.body = sanitizeObject(req.body)
    }
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as any) as any
  }
  
  next()
}

