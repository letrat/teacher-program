import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from './db'
import { UserRole } from '@prisma/client'
import logger from './logger'

// Export JWT_SECRET to ensure consistency
// In production, JWT_SECRET must be set - no fallback
const getJWTSecret = (): string => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }
  return 'fallback-secret'
}
export const JWT_SECRET: string = getJWTSecret()
// Reduced token expiration to 24 hours for better security
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthUser {
  id: string
  username: string
  name: string
  role: UserRole
  schoolId?: string
  jobTypeId?: string
}

export async function authenticateUser(credentials: LoginCredentials): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { username: credentials.username },
    include: {
      school: {
        select: {
          id: true,
          status: true,
          subscriptionEnd: true,
        },
      },
    },
  })

  if (!user) {
    // Security: Don't reveal if user exists or not
    logger.warn('Login attempt failed: Invalid credentials', { 
      username: credentials.username,
      // Don't log if user exists to prevent account enumeration
    })
    return null
  }

  // Verify password FIRST to avoid revealing school status if password is wrong
  const isValid = await bcrypt.compare(credentials.password, user.password)
  if (!isValid) {
    // Security: Don't reveal user details when password is wrong
    logger.warn('Login attempt failed: Invalid credentials', { 
      username: credentials.username,
      // Don't log userId or role to prevent information disclosure
    })
    return null
  }

  // After password is verified, check school status and user status
  // Admin accounts are not subject to school restrictions
  if (user.role !== UserRole.ADMIN) {
    // Check if school is disabled
    // This check happens AFTER password verification to avoid information disclosure
    if (user.schoolId && user.school) {
      if (!user.school.status) {
        throw new Error('SCHOOL_DISABLED')
      }
      
      // Check if subscription has expired
      if (user.school.subscriptionEnd) {
        const now = new Date()
        const endDate = new Date(user.school.subscriptionEnd)
        if (endDate < now) {
          throw new Error('SUBSCRIPTION_EXPIRED')
        }
      }
    }
  }

  // Check user status AFTER password verification and school checks
  // This ensures we show school-related errors if school is disabled (even if user is also disabled)
  if (!user.status) {
    // If we reach here and user is disabled, it might be due to school being disabled
    // But we already checked school status above, so this is a different case
    // Security: Don't reveal user details when account is disabled
    logger.warn('Login attempt failed: Invalid credentials', { 
      username: credentials.username,
      // Don't log userId or role to prevent information disclosure
    })
    return null
  }

  // Only log successful authentication (this is safe)
  logger.info('User authenticated successfully', {
    username: user.username,
    userId: user.id,
    role: user.role,
  })

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    schoolId: user.schoolId || undefined,
    jobTypeId: user.jobTypeId || undefined,
  }
}

export function generateToken(user: AuthUser): string {
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      schoolId: user.schoolId,
      jobTypeId: user.jobTypeId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  )
  
  return token
}

/**
 * Generate refresh token (longer expiration)
 */
export function generateRefreshToken(user: AuthUser): string {
  const refreshToken = jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  )
  
  return refreshToken
}

/**
 * Verify and decode token
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

/**
 * Generate secure random token for CSRF
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

