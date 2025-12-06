import { Response, NextFunction } from 'express'
import { prisma } from '../lib/db'
import { AuthRequest } from './auth'
import { UserRole } from '@prisma/client'
import logger from '../lib/logger'

/**
 * Middleware to verify that a school manager can only access resources from their school
 */
export const verifySchoolOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user
    if (!user || user.role !== UserRole.SCHOOL_MANAGER || !user.schoolId) {
      return res.status(403).json({ error: 'غير مصرح - يجب أن تكون مدير مدرسة' })
    }

    // Check if resource belongs to user's school
    const resourceSchoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId

    if (resourceSchoolId && resourceSchoolId !== user.schoolId) {
      logger.warn('School ownership violation attempt', {
        userId: user.id,
        userSchoolId: user.schoolId,
        requestedSchoolId: resourceSchoolId,
        path: req.path,
      })
      return res.status(403).json({ error: 'غير مصرح - لا يمكنك الوصول إلى موارد مدرسة أخرى' })
    }

    // For teacher-related resources, verify teacher belongs to same school
    const teacherId = req.params.teacherId || req.body.teacherId || req.query.teacherId
    if (teacherId) {
      const teacher = await prisma.user.findUnique({
        where: { id: teacherId },
        select: { schoolId: true },
      })

      if (!teacher || teacher.schoolId !== user.schoolId) {
        logger.warn('Teacher ownership violation attempt', {
          userId: user.id,
          userSchoolId: user.schoolId,
          requestedTeacherId: teacherId,
          path: req.path,
        })
        return res.status(403).json({ error: 'غير مصرح - المعلم لا ينتمي لمدرستك' })
      }
    }

    next()
  } catch (error: any) {
    logger.error('Resource ownership verification error:', { error: error.message })
    res.status(500).json({ error: 'حدث خطأ في التحقق من الصلاحيات' })
  }
}

/**
 * Middleware to verify that a teacher can only access their own resources
 */
export const verifyTeacherOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user
    if (!user || user.role !== UserRole.TEACHER) {
      return res.status(403).json({ error: 'غير مصرح - يجب أن تكون معلم' })
    }

    // Check if resource belongs to current user
    const resourceTeacherId = req.params.teacherId || req.body.teacherId || req.query.teacherId

    if (resourceTeacherId && resourceTeacherId !== user.id) {
      logger.warn('Teacher ownership violation attempt', {
        userId: user.id,
        requestedTeacherId: resourceTeacherId,
        path: req.path,
      })
      return res.status(403).json({ error: 'غير مصرح - لا يمكنك الوصول إلى موارد معلم آخر' })
    }

    // For submission-related resources, verify submission belongs to current teacher
    const submissionId = req.params.submissionId || req.body.submissionId || req.query.submissionId
    if (submissionId) {
      const submission = await prisma.evidenceSubmission.findUnique({
        where: { id: submissionId },
        select: { teacherId: true },
      })

      if (!submission || submission.teacherId !== user.id) {
        logger.warn('Submission ownership violation attempt', {
          userId: user.id,
          requestedSubmissionId: submissionId,
          path: req.path,
        })
        return res.status(403).json({ error: 'غير مصرح - الشاهد لا ينتمي لك' })
      }
    }

    next()
  } catch (error: any) {
    logger.error('Teacher ownership verification error:', { error: error.message })
    res.status(500).json({ error: 'حدث خطأ في التحقق من الصلاحيات' })
  }
}

/**
 * Middleware to verify admin can access any resource (no restrictions)
 * This is mainly for explicit admin-only endpoints
 */
export const verifyAdminAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user
  if (!user || user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: 'غير مصرح - يجب أن تكون أدمن' })
  }
  next()
}

/**
 * Middleware to verify resource ID format (UUID)
 */
export const verifyResourceId = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  // Check common ID parameters
  const idParams = ['id', 'schoolId', 'teacherId', 'kpiId', 'jobTypeId', 'submissionId', 'evidenceId']
  
  for (const param of idParams) {
    const value = req.params[param] || req.body[param] || req.query[param]
    if (value && typeof value === 'string' && !uuidRegex.test(value)) {
      logger.warn('Invalid resource ID format', {
        param,
        value: value.substring(0, 20),
        path: req.path,
      })
      return res.status(400).json({ error: `معرف ${param} غير صحيح` })
    }
  }

  next()
}

