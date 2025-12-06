import { Router, Response } from 'express'
import jwt from 'jsonwebtoken'
import { authenticateUser, generateToken, generateRefreshToken, hashPassword, JWT_SECRET } from '../lib/auth'
import bcrypt from 'bcryptjs'
import { blacklistToken } from '../lib/tokenBlacklist'
import { generateCSRFTokenForSession, addCSRFToken, csrfProtection } from '../middleware/csrf'
import { recordFailedAttempt, isAccountLocked, clearFailedAttempts, clearLockout } from '../lib/accountLockout'
import { MAX_FAILED_ATTEMPTS } from '../lib/accountLockout'
import { validatePasswordStrength, isCommonPassword } from '../utils/password'
import { validate } from '../middleware/validation'
import { loginSchema, registerSchema, changePasswordSchema } from '../schemas/auth'
import { prisma } from '../lib/db'
import { UserRole } from '@prisma/client'
import { AuthRequest, authenticate } from '../middleware/auth'
import { loginLimiter } from '../middleware/rateLimit'
import logger from '../lib/logger'
import cookieParser from 'cookie-parser'

const router = Router()

// Login with rate limiting and account lockout
router.post('/login', loginLimiter, validate({ body: loginSchema }), async (req, res) => {
  try {
    const { username, password } = req.body

    // First, try to get user to check role (for admin exception)
    let userRole: string | undefined
    try {
      const userCheck = await prisma.user.findUnique({
        where: { username },
        select: { role: true },
      })
      userRole = userCheck?.role
    } catch (error) {
      // If we can't check, continue normally
    }

    // Check if account is locked (admin accounts are never locked)
    const lockoutStatus = isAccountLocked(username, userRole)
    if (lockoutStatus.isLocked) {
      const minutesLeft = lockoutStatus.lockoutUntil 
        ? Math.ceil((lockoutStatus.lockoutUntil.getTime() - Date.now()) / 60000)
        : 15
      return res.status(423).json({ 
        error: `الحساب مقفل مؤقتاً بسبب محاولات تسجيل دخول فاشلة. يرجى المحاولة بعد ${minutesLeft} دقيقة`,
        lockoutUntil: lockoutStatus.lockoutUntil,
      })
    }

    let user
    try {
      user = await authenticateUser({ username, password })
    } catch (authError: any) {
      if (authError.message === 'SCHOOL_DISABLED') {
        return res.status(403).json({ 
          error: 'تم تعطيل حساب المدرسة.\nيرجى التواصل مع مدير النظام أو صاحب الموقع',
        })
      }
      if (authError.message === 'SUBSCRIPTION_EXPIRED') {
        return res.status(403).json({ 
          error: 'انتهت فترة الاشتراك. الرجاء التواصل مع صاحب الموقع',
        })
      }
      // For other errors, treat as failed login
      logger.error('Authentication error:', {
        username,
        error: authError.message,
        stack: authError.stack,
      })
      user = null
    }

    if (!user) {
      // Record failed attempt (admin accounts are never locked)
      const attemptResult = recordFailedAttempt(username, userRole)
      
      if (attemptResult.isLocked) {
        return res.status(423).json({ 
          error: `تم قفل الحساب مؤقتاً بسبب محاولات تسجيل دخول فاشلة متعددة. يرجى المحاولة بعد 15 دقيقة`,
        })
      }

      // Security: Don't reveal account type or remaining attempts
      // Return same message for all accounts to prevent information disclosure
      const remainingAttempts = userRole === 'ADMIN' 
        ? MAX_FAILED_ATTEMPTS // Always return same value for admin (not revealed to client)
        : (MAX_FAILED_ATTEMPTS - attemptResult.attempts)
      
      // Security: Log minimal information to prevent account enumeration
      // Don't log userRole or remainingAttempts to prevent attackers from identifying admin accounts
      logger.warn('Failed login attempt', {
        username,
        // Don't log userRole or remainingAttempts for security
        attempts: attemptResult.attempts,
        isLocked: attemptResult.isLocked,
      })
      
      // Security: Don't include remainingAttempts in response to prevent account enumeration
      return res.status(401).json({ 
        error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
      })
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(username)
    
    // If this is an admin account, also clear any lockout (extra safety)
    if (user.role === UserRole.ADMIN) {
      clearLockout(username)
    }

    const token = generateToken(user)
    const refreshToken = generateRefreshToken(user)
    
    // Generate CSRF token for this session
    const tokenHash = hashToken(token)
    const csrfToken = generateCSRFTokenForSession(tokenHash)
    
    logger.info('User logged in successfully', { username: user.username, userId: user.id })

    const isProduction = process.env.NODE_ENV === 'production'
    const cookieOptions = {
      httpOnly: isProduction, // httpOnly in production for security, false in dev for Next.js middleware
      secure: isProduction,
      sameSite: isProduction ? 'strict' as const : 'lax' as const, // Strict in production
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches token expiration)
      path: '/',
      domain: undefined,
    }

    // Set access token cookie
    res.cookie('token', token, cookieOptions)
    
    // Set refresh token cookie (always httpOnly for security)
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      httpOnly: true, // Always httpOnly for refresh tokens
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    res.json({
      user,
      token,
      refreshToken: isProduction ? undefined : refreshToken, // Don't send refresh token in response in production
      csrfToken, // Include CSRF token in response
    })
  } catch (error: any) {
    logger.error('Login error:', { error: error.message, stack: error.stack })
    res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول' })
  }
})

// Register (Admin only, or first admin if no admins exist)
router.post('/register', validate({ body: registerSchema }), async (req: AuthRequest, res: Response) => {
  try {
    // Check if any admin exists
    const adminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    })

    // If admins exist, require authentication
    if (adminCount > 0) {
      // Try to authenticate
      const authHeader = req.headers.authorization
      const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || null
      const cookieToken = req.cookies?.token
      const customHeaderToken = (req.headers['x-auth-token'] as string)?.trim()
      const token = bearerToken || customHeaderToken || cookieToken

      if (!token) {
        return res.status(401).json({ error: 'غير مصرح - يجب تسجيل الدخول كأدمن لإنشاء حسابات جديدة' })
      }

      // Validate token format
      const cleanToken = token.trim()
      if (!cleanToken || cleanToken.split('.').length !== 3) {
        return res.status(401).json({ error: 'غير مصرح - token غير صحيح' })
      }

      // Verify token
      let decoded: any
      try {
        decoded = jwt.verify(cleanToken, JWT_SECRET) as any
      } catch (verifyError: any) {
        logger.warn('Token verification failed in register', {
          error: verifyError.message,
          path: req.path,
        })
        return res.status(401).json({ error: 'غير مصرح - token غير صحيح' })
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { role: true, status: true },
      })

      if (!user || !user.status || user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'غير مصرح - فقط الأدمن يمكنه إنشاء حسابات' })
      }
    }

    const { username, password, name, role, schoolId, jobTypeId } = req.body

    // If this is the first admin, ensure role is ADMIN
    if (adminCount === 0 && role !== UserRole.ADMIN) {
      return res.status(400).json({ error: 'يجب إنشاء حساب أدمن أولاً' })
    }

    // Validate password strength
    const passwordStrength = validatePasswordStrength(password)
    if (!passwordStrength.isValid) {
      return res.status(400).json({ 
        error: 'كلمة المرور ضعيفة',
        details: passwordStrength.feedback,
      })
    }

    // Check for common passwords
    if (isCommonPassword(password)) {
      return res.status(400).json({ 
        error: 'كلمة المرور شائعة جداً. يرجى استخدام كلمة مرور أقوى',
      })
    }

    // Check if username exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' })
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: role as UserRole,
        schoolId: schoolId || null,
        jobTypeId: jobTypeId || null,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        schoolId: true,
        jobTypeId: true,
      },
    })

    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user })
  } catch (error: any) {
    logger.error('Register error:', { error: error.message, stack: error.stack })
    res.status(500).json({ error: 'حدث خطأ في إنشاء الحساب' })
  }
})

// Get current user
router.get('/me', authenticate, addCSRFToken, async (req: AuthRequest, res: Response) => {
  try {
    // Get user with school and jobType relations
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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
            name: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' })
    }

    res.json({ user })
  } catch (error: any) {
    logger.error('Error fetching current user:', { error: error.message })
    res.status(500).json({ error: 'حدث خطأ في جلب معلومات المستخدم' })
  }
})

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token مطلوب' })
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Token غير صحيح' })
    }

    // Get user from database
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
      },
    })

    if (!user || !user.status) {
      return res.status(401).json({ error: 'المستخدم غير موجود أو معطل' })
    }

    // Generate new tokens
    const newToken = generateToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId || undefined,
      jobTypeId: user.jobTypeId || undefined,
    })

    const isProduction = process.env.NODE_ENV === 'production'
    res.cookie('token', newToken, {
      httpOnly: isProduction,
      secure: isProduction,
      sameSite: isProduction ? 'strict' as const : 'lax' as const,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    })

    res.json({
      token: newToken,
    })
  } catch (error: any) {
    logger.error('Refresh token error:', { error: error.message })
    res.status(401).json({ error: 'Refresh token غير صحيح' })
  }
})

// Change password
router.post('/change-password', authenticate, validate({ body: changePasswordSchema }), csrfProtection, async (req: AuthRequest, res: Response) => {
  try {
    logger.info('Change password endpoint called', { userId: req.user?.id, path: req.path })
    const { oldPassword, newPassword } = req.body
    const userId = req.user?.id

    if (!userId) {
      logger.warn('Change password: No user ID found')
      return res.status(401).json({ error: 'غير مصرح' })
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' })
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password)
    if (!isOldPasswordValid) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' })
    }

    // Validate new password strength
    const passwordStrength = validatePasswordStrength(newPassword)
    if (!passwordStrength.isValid) {
      return res.status(400).json({ 
        error: 'كلمة المرور الجديدة ضعيفة',
        details: passwordStrength.feedback,
      })
    }

    // Check for common passwords
    if (isCommonPassword(newPassword)) {
      return res.status(400).json({ 
        error: 'كلمة المرور الجديدة شائعة جداً. يرجى استخدام كلمة مرور أقوى',
      })
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    logger.info('Password changed successfully', { userId })

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' })
  } catch (error: any) {
    logger.error('Change password error:', { error: error.message, stack: error.stack })
    res.status(500).json({ error: error.message || 'حدث خطأ في تغيير كلمة المرور' })
  }
})

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || 
                  req.cookies?.token || 
                  req.headers['x-auth-token'] as string

    if (token) {
      // Add token to blacklist
      blacklistToken(token)
    }

    // Clear cookies
    res.clearCookie('token', { path: '/' })
    res.clearCookie('refreshToken', { path: '/' })
    
    res.json({ message: 'تم تسجيل الخروج بنجاح' })
  } catch (error: any) {
    logger.error('Logout error:', { error: error.message })
    res.json({ message: 'تم تسجيل الخروج بنجاح' })
  }
})

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

export default router
