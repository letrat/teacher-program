import { Request, Response, NextFunction } from 'express'

export interface PaginationQuery {
  page?: string
  limit?: string
}

export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

/**
 * Parse pagination parameters from query string
 */
export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

/**
 * Create pagination response
 */
export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  const totalPages = Math.ceil(total / limit)

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

/**
 * Middleware to add pagination to request
 */
export function paginationMiddleware(req: Request, res: Response, next: NextFunction) {
  const pagination = parsePagination(req)
  ;(req as any).pagination = pagination
  next()
}










