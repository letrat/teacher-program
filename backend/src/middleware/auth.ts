import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/db'
import { UserRole } from '@prisma/client'
import { JWT_SECRET, verifyToken } from '../lib/auth'
import { isTokenBlacklisted } from '../lib/tokenBlacklist'
import logger from '../lib/logger'

export interface AuthRequest extends Request {
  user?: {
    id: string
    username: string
    name: string
    role: UserRole
    schoolId?: string
    jobTypeId?: string
  }
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Try multiple sources for token
    const authHeader = req.headers.authorization
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || null
    const cookieToken = req.cookies?.token
    
    // Better cookie parsing - handle multiple cookies correctly
    let cookieHeaderToken: string | null = null
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';')
      const tokenCookie = cookies.find((cookie) => cookie.trim().startsWith('token='))
      if (tokenCookie) {
        cookieHeaderToken = tokenCookie.split('=').slice(1).join('=').trim()
      }
    }
    
    const customHeaderToken = (req.headers['x-auth-token'] as string)?.trim()

    const token = bearerToken || customHeaderToken || cookieToken || cookieHeaderToken

    if (!token) {
      logger.warn('No token found in request', {
        path: req.path,
        method: req.method,
      })
      return res.status(401).json({ error: 'غير مصرح - لا يوجد token' })
    }

    // Use the same JWT_SECRET as in lib/auth.ts (imported)
    // Trim token to remove any whitespace and validate it's not empty
    const cleanToken = token.trim()
    
    // Validate token format (JWT should have 3 parts separated by dots)
    if (!cleanToken || cleanToken.split('.').length !== 3) {
      logger.warn('Invalid token format', {
        path: req.path,
        method: req.method,
        tokenLength: cleanToken.length,
        tokenParts: cleanToken.split('.').length,
        tokenPreview: cleanToken.substring(0, 20) + '...',
        tokenSource: bearerToken ? 'Bearer' : customHeaderToken ? 'x-auth-token' : cookieToken ? 'cookie' : 'cookie-header',
      })
      return res.status(401).json({ error: 'غير مصرح - token غير صحيح' })
    }
    
    // Check if token is blacklisted (logout)
    if (isTokenBlacklisted(cleanToken)) {
      logger.warn('Blacklisted token used', {
        path: req.path,
        method: req.method,
      })
      return res.status(401).json({ error: 'غير مصرح - الجلسة منتهية' })
    }
    
    let decoded: any
    try {
      decoded = jwt.verify(cleanToken, JWT_SECRET) as any
      logger.debug('Token verified successfully', { userId: decoded.id })
    } catch (verifyError: any) {
      logger.warn('Token verification failed', {
        error: verifyError.message,
        errorName: verifyError.name,
        path: req.path,
        method: req.method,
        tokenLength: cleanToken.length,
        tokenParts: cleanToken.split('.').length,
        tokenPreview: cleanToken.substring(0, 30) + '...',
        tokenSource: bearerToken ? 'Bearer' : customHeaderToken ? 'x-auth-token' : cookieToken ? 'cookie' : 'cookie-header',
      })
      throw verifyError
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        schoolId: true,
        jobTypeId: true,
        status: true,
        school: {
          select: {
            id: true,
            status: true,
            subscriptionEnd: true,
          },
        },
      },
    })

    if (!user || !user.status) {
      return res.status(401).json({ error: 'غير مصرح - المستخدم غير موجود أو معطل' })
    }

    // Admin accounts are not subject to school restrictions
    if (user.role !== UserRole.ADMIN) {
      // Check if school is disabled (only for non-admin users)
      if (user.schoolId && user.school) {
        if (!user.school.status) {
          return res.status(403).json({ error: 'تم تعطيل حساب المدرسة.\nيرجى التواصل مع مدير النظام أو صاحب الموقع' })
        }
        
        // Check if subscription has expired
        if (user.school.subscriptionEnd) {
          const now = new Date()
          const endDate = new Date(user.school.subscriptionEnd)
          if (endDate < now) {
            return res.status(403).json({ error: 'انتهت فترة الاشتراك. الرجاء التواصل مع صاحب الموقع' })
          }
        }
      }
    }

    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId || undefined,
      jobTypeId: user.jobTypeId || undefined,
    }

    next()
  } catch (error: any) {
    logger.error('Authentication error', {
      error: error.message,
      errorType: error.name,
      path: req.path,
    })
    
    if (error.message?.includes('expired')) {
      return res.status(401).json({ error: 'غير مصرح - انتهت صلاحية الجلسة' })
    }
    if (error.message?.includes('invalid')) {
      return res.status(401).json({ error: 'غير مصرح - token غير صحيح' })
    }
    return res.status(401).json({ error: 'غير مصرح - token غير صحيح' })
  }
}

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'غير مصرح - لا تملك الصلاحية' })
    }

    next()
  }
}

export const requireAdmin = requireRole(UserRole.ADMIN)
export const requireSchoolManager = requireRole(UserRole.SCHOOL_MANAGER)
export const requireTeacher = requireRole(UserRole.TEACHER)
