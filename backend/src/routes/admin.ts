import { Router, Response } from 'express'
import { z } from 'zod'
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth'
import { csrfProtection } from '../middleware/csrf'
import { verifyResourceId } from '../middleware/resourceOwnership'
import { validate } from '../middleware/validation'
import { sanitize } from '../middleware/validation'
import { 
  createSchoolSchema, 
  updateSchoolSchema, 
  resetPasswordSchema,
  createUserSchema,
  updateUserSchema,
  createJobTypeSchema,
  updateJobTypeSchema,
  createKPISchema,
  updateKPISchema,
  createEvidenceSchema,
  updateEvidenceSchema 
} from '../schemas/admin'
import { uuidSchema } from '../schemas/common'
import { prisma } from '../lib/db'
import bcrypt from 'bcryptjs'
import { UserRole, SubmissionStatus } from '@prisma/client'
import { parsePagination, createPaginationResponse } from '../middleware/pagination'
import { adminLimiter } from '../middleware/rateLimit'
import { validatePasswordStrength, isCommonPassword } from '../utils/password'
import logger from '../lib/logger'
import multer from 'multer'
import * as XLSX from 'xlsx'

const router = Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ]
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls') || 
        file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('يرجى رفع ملف Excel صالح (.xlsx, .xls, .csv)'))
    }
  },
})

// Apply authentication and security middleware to all admin routes
router.use(authenticate)
router.use(requireAdmin)
router.use(verifyResourceId) // Validate UUID format
router.use(sanitize) // XSS protection
router.use(csrfProtection) // CSRF protection for state-changing methods
router.use(adminLimiter)

// ==================== Dashboard ====================

// GET /api/admin/dashboard/stats - Get admin dashboard statistics
router.get('/dashboard/stats', async (req, res: Response) => {
  try {
    logger.info('📊 Admin dashboard stats endpoint called')
    console.log('📊 Admin dashboard stats endpoint called')
    const [
      schoolsCount,
      activeSchoolsCount,
      managersCount,
      activeManagersCount,
      teachersCount,
      activeTeachersCount,
      jobTypesCount,
      activeJobTypesCount,
      kpisCount,
      officialKPIsCount,
      evidenceItemsCount,
      submissionsCount,
      pendingSubmissionsCount,
      approvedSubmissionsCount,
      rejectedSubmissionsCount,
      schoolsWithSubscriptions,
      expiredSubscriptions,
      recentSubmissions,
      topJobTypes,
      schoolsByStatus
    ] = await Promise.all([
      // Basic counts
      prisma.school.count(),
      prisma.school.count({ where: { status: true } }),
      prisma.user.count({ where: { role: UserRole.SCHOOL_MANAGER } }),
      prisma.user.count({ where: { role: UserRole.SCHOOL_MANAGER, status: true } }),
      prisma.user.count({ where: { role: UserRole.TEACHER } }),
      prisma.user.count({ where: { role: UserRole.TEACHER, status: true } }),
      prisma.jobType.count(),
      prisma.jobType.count({ where: { status: true } }),
      prisma.kPI.count(),
      prisma.kPI.count({ where: { isOfficial: true } }),
      prisma.evidenceItem.count(),
      prisma.evidenceSubmission.count(),
      prisma.evidenceSubmission.count({ where: { status: SubmissionStatus.PENDING } }),
      prisma.evidenceSubmission.count({ where: { status: SubmissionStatus.ACCEPTED } }),
      prisma.evidenceSubmission.count({ where: { status: SubmissionStatus.REJECTED } }),
      // Subscription stats
      prisma.school.count({ 
        where: { 
          subscriptionStart: { not: null },
          subscriptionEnd: { not: null }
        }
      }),
      prisma.school.count({
        where: {
          subscriptionEnd: { 
            not: null,
            lt: new Date()
          },
          status: true
        }
      }),
      // Recent submissions (last 7 days)
      prisma.evidenceSubmission.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          teacher: {
            select: { name: true, school: { select: { name: true } } }
          },
          kpi: { select: { name: true } },
          evidence: { select: { name: true } }
        }
      }),
      // Top job types by user count
      prisma.jobType.findMany({
        include: {
          _count: {
            select: { users: true }
          }
        }
      }),
      // Schools by status
      prisma.school.groupBy({
        by: ['status'],
        _count: true
      })
    ])

    // Calculate growth percentages (comparing last 30 days to previous 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    
    const [recentSchools, previousSchools, recentSubmissions30, previousSubmissions30] = await Promise.all([
      prisma.school.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.school.count({ 
        where: { 
          createdAt: { 
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        }
      }),
      prisma.evidenceSubmission.count({ 
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.evidenceSubmission.count({
        where: {
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        }
      })
    ])

    const schoolsGrowth = previousSchools > 0 
      ? ((recentSchools - previousSchools) / previousSchools * 100).toFixed(1)
      : recentSchools > 0 ? '100' : '0'
    
    const submissionsGrowth = previousSubmissions30 > 0
      ? ((recentSubmissions30 - previousSubmissions30) / previousSubmissions30 * 100).toFixed(1)
      : recentSubmissions30 > 0 ? '100' : '0'

    const responseData = {
      // Basic stats
      schoolsCount,
      activeSchoolsCount,
      managersCount,
      activeManagersCount,
      teachersCount,
      activeTeachersCount,
      jobTypesCount,
      activeJobTypesCount,
      kpisCount,
      officialKPIsCount,
      evidenceItemsCount,
      submissionsCount,
      pendingSubmissionsCount,
      approvedSubmissionsCount,
      rejectedSubmissionsCount,
      // Subscription stats
      schoolsWithSubscriptions,
      expiredSubscriptions,
      // Growth stats
      schoolsGrowth: parseFloat(schoolsGrowth),
      submissionsGrowth: parseFloat(submissionsGrowth),
      // Detailed data
      recentSubmissions: recentSubmissions.map(s => ({
        id: s.id,
        userName: s.teacher.name,
        schoolName: s.teacher.school?.name || 'غير محدد',
        kpiName: s.kpi.name,
        evidenceName: s.evidence.name,
        status: s.status,
        createdAt: s.createdAt
      })),
      topJobTypes: topJobTypes
        .map(jt => ({
          id: jt.id,
          name: jt.name,
          usersCount: jt._count.users
        }))
        .sort((a, b) => b.usersCount - a.usersCount)
        .slice(0, 5),
      schoolsByStatus: schoolsByStatus.map(s => ({
        status: s.status,
        count: s._count
      }))
    }

    logger.info('📊 Dashboard stats calculated successfully', {
      schoolsCount,
      submissionsCount,
      recentSubmissionsCount: recentSubmissions.length,
      topJobTypesCount: responseData.topJobTypes.length
    })
    console.log('✅ Dashboard stats response prepared:', {
      schoolsCount: responseData.schoolsCount,
      submissionsCount: responseData.submissionsCount,
      recentSubmissionsCount: responseData.recentSubmissions.length,
      topJobTypesCount: responseData.topJobTypes.length
    })

    res.json(responseData)
  } catch (error: any) {
    logger.error('Error fetching admin dashboard stats:', { 
      error: error.message, 
      stack: error.stack,
      name: error.name,
      code: error.code
    })
    console.error('❌ Dashboard stats error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    })
    res.status(500).json({ 
      error: error.message || 'حدث خطأ في جلب الإحصائيات',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// ==================== Schools ====================

// GET /api/admin/schools - Get all schools with pagination
router.get('/schools', async (req, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req)

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
      include: {
        users: {
          where: { role: UserRole.SCHOOL_MANAGER },
          select: {
            id: true,
            username: true,
            name: true,
            status: true,
          },
        },
        _count: {
          select: {
            users: {
              where: { role: UserRole.TEACHER },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.school.count(),
    ])

    res.json(createPaginationResponse(schools, total, page, limit))
  } catch (error: any) {
    logger.error('Error fetching schools:', { error: error.message, stack: error.stack })
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب المدارس' })
  }
})

// POST /api/admin/schools - Create school
router.post('/schools', validate({ body: createSchoolSchema }), async (req, res: Response) => {
  try {
    const { name, managerUsername, managerPassword, managerName, managerPhone, managerEmail, subscriptionStart, subscriptionEnd } = req.body

    // Validate password strength
    const passwordStrength = validatePasswordStrength(managerPassword)
    if (!passwordStrength.isValid) {
      return res.status(400).json({ 
        error: 'كلمة المرور ضعيفة',
        details: passwordStrength.feedback,
      })
    }

    // Check for common passwords
    if (isCommonPassword(managerPassword)) {
      return res.status(400).json({ 
        error: 'كلمة المرور شائعة جداً. يرجى استخدام كلمة مرور أقوى',
      })
    }

    // Use school name as username if managerUsername not provided
    const finalUsername = managerUsername || name

    // Check if username exists
    const existingUser = await prisma.user.findUnique({
      where: { username: finalUsername },
    })

    if (existingUser) {
      return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' })
    }

    // Validate subscription dates
    if (subscriptionStart && subscriptionEnd) {
      const startDate = new Date(subscriptionStart)
      const endDate = new Date(subscriptionEnd)
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'تاريخ نهاية الاشتراك يجب أن يكون بعد تاريخ البداية' })
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(managerPassword, 10)

    // Create school and manager in transaction
    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: { 
          name,
          subscriptionStart: subscriptionStart ? new Date(subscriptionStart) : null,
          subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : null,
        },
      })

      // Use school name as username if not provided, otherwise use provided username
      const finalUsername = managerUsername || name

      const manager = await tx.user.create({
        data: {
          username: finalUsername,
          password: hashedPassword,
          name: managerName,
          phone: managerPhone || null,
          email: managerEmail || null,
          role: UserRole.SCHOOL_MANAGER,
          schoolId: school.id,
        },
      })

      return { school, manager }
    })

    res.status(201).json(result.school)
  } catch (error: any) {
    logger.error('Error creating school:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في إنشاء المدرسة' })
  }
})

// GET /api/admin/schools/:id/details - Get school details (users, KPIs, weights, etc.)
// MUST be before /schools/:id routes to avoid route conflicts
// Note: CSRF protection is skipped for GET requests, so this should work
router.get('/schools/:id/details', validate({ 
  params: z.object({ id: uuidSchema }) 
}), async (req: AuthRequest, res: Response) => {
  try {
    logger.info('📋 School details endpoint called', { 
      schoolId: req.params.id,
      path: req.path,
      method: req.method 
    })
    const { id } = req.params

    // Get school
    const school = await prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        subscriptionStart: true,
        subscriptionEnd: true,
      },
    })

    if (!school) {
      return res.status(404).json({ error: 'المدرسة غير موجودة' })
    }

    // Get manager info
    const manager = await prisma.user.findFirst({
      where: {
        schoolId: id,
        role: UserRole.SCHOOL_MANAGER,
      },
      select: {
        name: true,
        username: true,
        phone: true,
        email: true,
      },
    })

    // Get all users in school
    const users = await prisma.user.findMany({
      where: { schoolId: id },
      include: {
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get all job types
    const jobTypes = await prisma.jobType.findMany({
      where: { status: true },
      orderBy: { name: 'asc' },
    })

    // Get KPIs and weights for each job type
    const jobTypesWithKPIs = await Promise.all(
      jobTypes.map(async (jobType) => {
        // Get official KPIs
        const officialKPIs = await prisma.kPI.findMany({
          where: {
            jobTypeId: jobType.id,
            isOfficial: true,
            schoolId: null,
          },
          select: {
            id: true,
            name: true,
            weight: true,
          },
          orderBy: { name: 'asc' },
        })

        // Get school-specific KPIs
        const schoolKPIs = await prisma.kPI.findMany({
          where: {
            jobTypeId: jobType.id,
            schoolId: id,
            isOfficial: false,
          },
          select: {
            id: true,
            name: true,
            weight: true,
          },
          orderBy: { name: 'asc' },
        })

        const allKPIs = [...officialKPIs, ...schoolKPIs]

        // Get custom weights from SchoolJobTypeKPI
        let schoolJobTypeKPIs: Array<{ kpiId: string; weight: number; isActive: boolean }> = []
        try {
          schoolJobTypeKPIs = await prisma.schoolJobTypeKPI.findMany({
            where: {
              schoolId: id,
              jobTypeId: jobType.id,
            },
            select: {
              kpiId: true,
              weight: true,
              isActive: true,
            },
          })
        } catch (error: any) {
          // If table doesn't exist or error, use default weights
          logger.warn('Error fetching SchoolJobTypeKPI, using default weights', {
            error: error.message,
            schoolId: id,
            jobTypeId: jobType.id,
          })
        }

        const customWeightsMap = new Map(
          schoolJobTypeKPIs.map((sjk) => [sjk.kpiId, { weight: sjk.weight, isActive: sjk.isActive }])
        )

        const officialKPIsSet = new Set(officialKPIs.map((k) => k.id))

        const kpisWithWeights = await Promise.all(
          allKPIs.map(async (kpi) => {
            const custom = customWeightsMap.get(kpi.id)
            
            // Get evidence items for this KPI (official + school-specific)
            const evidenceItems = await prisma.evidenceItem.findMany({
              where: {
                kpiId: kpi.id,
                OR: [
                  { isOfficial: true, schoolId: null }, // Official evidence
                  { schoolId: id, isOfficial: false }, // School-specific evidence
                ],
              },
              select: {
                id: true,
                name: true,
                isOfficial: true,
                schoolId: true,
              },
              orderBy: { name: 'asc' },
            })
            
            // Log evidence items for debugging
            if (evidenceItems.length > 0) {
              logger.info('📎 Evidence items found for KPI', {
                kpiId: kpi.id,
                kpiName: kpi.name,
                evidenceCount: evidenceItems.length,
                evidenceNames: evidenceItems.map(ev => ev.name),
              })
            }
            
            return {
              kpiId: kpi.id,
              name: kpi.name,
              weight: custom?.weight ?? kpi.weight,
              isActive: custom?.isActive ?? true,
              isOfficial: officialKPIsSet.has(kpi.id),
              evidenceItems: evidenceItems.map((ev) => ({
                id: ev.id,
                name: ev.name,
                isOfficial: ev.isOfficial,
              })),
            }
          })
        )

        const activeKPIs = kpisWithWeights.filter((k) => k.isActive)
        const totalWeight = activeKPIs.reduce((sum, k) => sum + k.weight, 0)

        // Count only school-specific KPIs (not official)
        const schoolSpecificKPIs = kpisWithWeights.filter((k) => !k.isOfficial)
        const activeSchoolSpecificKPIs = schoolSpecificKPIs.filter((k) => k.isActive)

        logger.info('📊 Job Type KPI counts', {
          jobTypeId: jobType.id,
          jobTypeName: jobType.name,
          totalKPIs: kpisWithWeights.length,
          activeKPIs: activeKPIs.length,
          schoolSpecificKPIs: schoolSpecificKPIs.length,
          activeSchoolSpecificKPIs: activeSchoolSpecificKPIs.length,
          officialKPIs: kpisWithWeights.filter((k) => k.isOfficial).length,
        })

        return {
          jobType: {
            id: jobType.id,
            name: jobType.name,
          },
          kpis: kpisWithWeights,
          totalWeight,
          isValid: Math.abs(totalWeight - 100) < 0.01,
          activeCount: activeKPIs.length,
          totalCount: kpisWithWeights.length,
          // School-specific counts (excluding official KPIs)
          schoolSpecificCount: schoolSpecificKPIs.length,
          activeSchoolSpecificCount: activeSchoolSpecificKPIs.length,
        }
      })
    )

    logger.info('School details fetched successfully', {
      schoolId: id,
      usersCount: users.length,
      jobTypesCount: jobTypesWithKPIs.length,
    })

    res.json({
      school: {
        ...school,
        managerName: manager?.name || null,
        managerUsername: manager?.username || null,
        managerPhone: manager?.phone || null,
        managerEmail: manager?.email || null,
      },
      users,
      jobTypesWithKPIs,
      stats: {
        totalUsers: users.length,
        teachers: users.filter((u) => u.role === UserRole.TEACHER).length,
        activeUsers: users.filter((u) => u.status).length,
      },
    })
  } catch (error: any) {
    logger.error('Error fetching school details:', { error: error.message, stack: error.stack, schoolId: req.params.id })
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب تفاصيل المدرسة' })
  }
})

// PUT /api/admin/schools/:id - Update school
router.put('/schools/:id', validate({ 
  params: z.object({ id: uuidSchema }),
  body: updateSchoolSchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, status, subscriptionStart, subscriptionEnd, managerName, managerUsername, managerPhone, managerEmail } = req.body

    logger.info('📝 Updating school:', { 
      id, 
      name, 
      status, 
      subscriptionStart, 
      subscriptionEnd,
      body: req.body 
    })

    // Validate subscription dates if both provided
    if (subscriptionStart && subscriptionEnd) {
      const startDate = new Date(subscriptionStart)
      const endDate = new Date(subscriptionEnd)
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'تاريخ نهاية الاشتراك يجب أن يكون بعد تاريخ البداية' })
      }
    }

    // Check if subscription has expired
    const now = new Date()
    let finalStatus = status
    
    // Get current school data to check existing subscription
    const currentSchool = await prisma.school.findUnique({
      where: { id },
      select: { subscriptionEnd: true, status: true },
    })
    
    // Determine the subscription end date to check
    const subscriptionEndToCheck = subscriptionEnd !== undefined 
      ? (subscriptionEnd ? new Date(subscriptionEnd) : null)
      : (currentSchool?.subscriptionEnd ? new Date(currentSchool.subscriptionEnd) : null)
    
    // If subscription has expired, disable school
    if (subscriptionEndToCheck && subscriptionEndToCheck < now) {
      finalStatus = false
    }

    // Update school and users in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {}
      
      if (name) {
        updateData.name = name
      }
      
      if (finalStatus !== undefined) {
        updateData.status = finalStatus
      }
      
      // Always update subscription dates if they are in the request (even if null)
      if (subscriptionStart !== undefined) {
        updateData.subscriptionStart = subscriptionStart ? new Date(subscriptionStart) : null
        logger.info('📅 Setting subscriptionStart:', { 
          original: subscriptionStart, 
          parsed: updateData.subscriptionStart 
        })
      }
      
      if (subscriptionEnd !== undefined) {
        updateData.subscriptionEnd = subscriptionEnd ? new Date(subscriptionEnd) : null
        logger.info('📅 Setting subscriptionEnd:', { 
          original: subscriptionEnd, 
          parsed: updateData.subscriptionEnd 
        })
      }
      
      logger.info('📝 Update data:', updateData)
      
      const school = await tx.school.update({
      where: { id },
        data: updateData,
      })
      
      logger.info('✅ School updated:', { 
        id: school.id, 
        subscriptionStart: school.subscriptionStart, 
        subscriptionEnd: school.subscriptionEnd 
    })

      // If status is being changed, update all users' status
      if (finalStatus !== undefined) {
        await tx.user.updateMany({
          where: { schoolId: id },
          data: { status: finalStatus },
        })
      }

      // Update manager info if provided
      // Note: managerUsername is never updated after creation - it's only set during school creation
      if (managerName !== undefined || managerPhone !== undefined || managerEmail !== undefined) {
        const manager = await tx.user.findFirst({
          where: {
            schoolId: id,
            role: UserRole.SCHOOL_MANAGER,
          },
        })

        if (manager) {
          const managerUpdateData: any = {}
          
          if (managerName !== undefined) {
            managerUpdateData.name = managerName
          }
          
          // Username never changes after creation - it's only set during school creation
          // So we don't update username here
          
          if (managerPhone !== undefined) {
            managerUpdateData.phone = managerPhone || null
          }
          
          if (managerEmail !== undefined) {
            managerUpdateData.email = managerEmail || null
          }
          
          await tx.user.update({
            where: { id: manager.id },
            data: managerUpdateData,
          })
        }
      }

      return school
    })

    res.json(result)
  } catch (error: any) {
    logger.error('Error updating school:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تحديث المدرسة' })
  }
})

// DELETE /api/admin/schools/:id - Delete school
router.delete('/schools/:id', validate({ 
  params: z.object({ id: uuidSchema }) 
}), async (req: AuthRequest, res: Response) => {
    const { id } = req.params
  try {
    await prisma.school.delete({
      where: { id },
    })

    res.json({ message: 'تم حذف المدرسة بنجاح' })
  } catch (error: any) {
    logger.error('Error deleting school:', { error: error.message, stack: error.stack, schoolId: id })
    res.status(500).json({ error: error.message || 'حدث خطأ في حذف المدرسة' })
  }
})

// POST /api/admin/schools/:id/reset-password - Reset manager password
router.post('/schools/:id/reset-password', validate({ 
  params: z.object({ id: uuidSchema }),
  body: resetPasswordSchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { newPassword } = req.body

    // Validate password strength
    const passwordStrength = validatePasswordStrength(newPassword)
    if (!passwordStrength.isValid) {
      return res.status(400).json({ 
        error: 'كلمة المرور ضعيفة',
        details: passwordStrength.feedback,
      })
    }

    // Check for common passwords
    if (isCommonPassword(newPassword)) {
      return res.status(400).json({ 
        error: 'كلمة المرور شائعة جداً. يرجى استخدام كلمة مرور أقوى',
      })
    }

    // Find school manager
    const manager = await prisma.user.findFirst({
      where: {
        schoolId: id,
        role: UserRole.SCHOOL_MANAGER,
      },
    })

    if (!manager) {
      return res.status(404).json({ error: 'مدير المدرسة غير موجود' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: manager.id },
      data: { password: hashedPassword },
    })

    res.json({ message: 'تم تحديث كلمة المرور بنجاح' })
  } catch (error: any) {
    logger.error('Error resetting password:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تحديث كلمة المرور' })
  }
})

// ==================== Users ====================

// GET /api/admin/users - Get all users with pagination
router.get('/users', async (req, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req)

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        include: {
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ])

    res.json(createPaginationResponse(users, total, page, limit))
  } catch (error: any) {
    logger.error('Error fetching users:', { error: error.message, stack: error.stack })
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب المستخدمين' })
  }
})

// POST /api/admin/users - Create user
router.post('/users', validate({ body: createUserSchema }), async (req, res: Response) => {
  try {
    const { username, password, name, role, schoolId, jobTypeId } = req.body

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

    const hashedPassword = await bcrypt.hash(password, 10)

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
        status: true,
        createdAt: true,
      },
    })

    res.status(201).json(user)
  } catch (error: any) {
    logger.error('Error creating user:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في إنشاء المستخدم' })
  }
})

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', validate({ 
  params: z.object({ id: uuidSchema }),
  body: updateUserSchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, status, schoolId, jobTypeId } = req.body

    const updateData: any = {}
    if (name) updateData.name = name
    if (status !== undefined) updateData.status = status
    if (schoolId !== undefined) updateData.schoolId = schoolId || null
    if (jobTypeId !== undefined) updateData.jobTypeId = jobTypeId || null

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        schoolId: true,
        jobTypeId: true,
        status: true,
        createdAt: true,
      },
    })

    res.json(user)
  } catch (error: any) {
    logger.error('Error updating user:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تحديث المستخدم' })
  }
})

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', validate({ 
  params: z.object({ id: uuidSchema }) 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await prisma.user.delete({
      where: { id },
    })

    res.json({ message: 'تم حذف المستخدم بنجاح' })
  } catch (error: any) {
    logger.error('Error deleting user:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في حذف المستخدم' })
  }
})

// ==================== Job Types ====================

// GET /api/admin/job-types - Get all job types with pagination
router.get('/job-types', async (req, res: Response) => {
  try {
    const { page, limit, skip } = parsePagination(req)

    const jobTypes = await prisma.jobType.findMany({
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    // Get official KPIs count for each job type (only official KPIs created by admin)
    const jobTypesWithOfficialKPICount = await Promise.all(
      jobTypes.map(async (jobType) => {
        // Count only official KPIs (created by admin, not by schools)
        const officialKPICount = await prisma.kPI.count({
          where: {
            jobTypeId: jobType.id,
            isOfficial: true,
            schoolId: null, // Only official KPIs created by admin (no schoolId)
          },
        })

        // Also get total count for comparison (for debugging)
        const totalKPICount = await prisma.kPI.count({
          where: {
            jobTypeId: jobType.id,
          },
        })

        // Log for debugging
        logger.info('Job type KPI count calculation', {
          jobTypeId: jobType.id,
          jobTypeName: jobType.name,
          officialKPICount,
          totalKPICount,
          difference: totalKPICount - officialKPICount,
        })

        return {
          ...jobType,
          _count: {
            ...jobType._count,
            kpis: officialKPICount, // Only official KPIs (created by admin)
          },
        }
      })
    )

    const total = await prisma.jobType.count()

    res.json(createPaginationResponse(jobTypesWithOfficialKPICount, total, page, limit))
  } catch (error: any) {
    logger.error('Error fetching job types:', { error: error.message, stack: error.stack })
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب صفات الموظفين' })
  }
})

// POST /api/admin/job-types - Create job type
router.post('/job-types', validate({ body: createJobTypeSchema }), async (req, res: Response) => {
  try {
    const { name } = req.body

    const jobType = await prisma.jobType.create({
      data: { name },
    })

    res.status(201).json(jobType)
  } catch (error: any) {
    logger.error('Error creating job type:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في إنشاء الصفة' })
  }
})

// PUT /api/admin/job-types/:id - Update job type
router.put('/job-types/:id', validate({ 
  params: z.object({ id: uuidSchema }),
  body: updateJobTypeSchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, status } = req.body

    const updateData: any = {}
    if (name) updateData.name = name
    if (status !== undefined) updateData.status = status

    const jobType = await prisma.jobType.update({
      where: { id },
      data: updateData,
    })

    res.json(jobType)
  } catch (error: any) {
    logger.error('Error updating job type:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تحديث الصفة' })
  }
})

// DELETE /api/admin/job-types/:id - Delete job type
router.delete('/job-types/:id', validate({ 
  params: z.object({ id: uuidSchema }) 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await prisma.jobType.delete({
      where: { id },
    })

    res.json({ message: 'تم حذف الصفة بنجاح' })
  } catch (error: any) {
    logger.error('Error deleting job type:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في حذف الصفة' })
  }
})

// ==================== KPIs ====================

// GET /api/admin/job-types/:id/kpis - Get KPIs for job type
router.get('/job-types/:id/kpis', validate({ 
  params: z.object({ id: uuidSchema }) 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const kpis = await prisma.kPI.findMany({
      where: {
        jobTypeId: id,
        isOfficial: true,
        schoolId: null,
      },
      include: {
        evidenceItems: {
          where: {
            isOfficial: true,
            schoolId: null,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(kpis)
  } catch (error: any) {
    logger.error('Error fetching KPIs:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب المعايير' })
  }
})

// POST /api/admin/job-types/:id/kpis - Create KPI
router.post('/job-types/:id/kpis', validate({ 
  params: z.object({ id: uuidSchema }),
  body: createKPISchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, weight, minAcceptedEvidence } = req.body

    const kpi = await prisma.kPI.create({
      data: {
        name,
        weight,
        minAcceptedEvidence: minAcceptedEvidence || null,
        jobTypeId: id,
        isOfficial: true,
        schoolId: null,
      },
    })

    res.status(201).json(kpi)
  } catch (error: any) {
    logger.error('Error creating KPI:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في إنشاء المعيار' })
  }
})

// PUT /api/admin/kpis/:id - Update KPI
router.put('/kpis/:id', validate({ 
  params: z.object({ id: uuidSchema }),
  body: updateKPISchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, weight, minAcceptedEvidence } = req.body

    const updateData: any = {}
    if (name) updateData.name = name
    if (weight !== undefined) {
      updateData.weight = weight
    }
    if (minAcceptedEvidence !== undefined) {
      updateData.minAcceptedEvidence = minAcceptedEvidence
    }

    const kpi = await prisma.kPI.update({
      where: { id },
      data: updateData,
    })

    res.json(kpi)
  } catch (error: any) {
    logger.error('Error updating KPI:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تحديث المعيار' })
  }
})

// DELETE /api/admin/kpis/:id - Delete KPI
router.delete('/kpis/:id', validate({ 
  params: z.object({ id: uuidSchema }) 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // حذف جميع السجلات المرتبطة أولاً
    await prisma.$transaction(async (tx) => {
      // حذف EvidenceSubmission المرتبطة بالمعيار
      await tx.evidenceSubmission.deleteMany({
        where: { kpiId: id },
      })

      // حذف EvidenceSubmission المرتبطة بالشواهد التابعة للمعيار
      const evidenceItems = await tx.evidenceItem.findMany({
        where: { kpiId: id },
        select: { id: true },
      })

      if (evidenceItems.length > 0) {
        const evidenceIds = evidenceItems.map((e) => e.id)
        await tx.evidenceSubmission.deleteMany({
          where: { evidenceId: { in: evidenceIds } },
        })
      }

      // حذف SchoolJobTypeKPI المرتبطة
      await tx.schoolJobTypeKPI.deleteMany({
        where: { kpiId: id },
      })

      // حذف SchoolKPI المرتبطة
      await tx.schoolKPI.deleteMany({
        where: { kpiId: id },
      })

      // حذف المعيار نفسه (سيحذف EvidenceItem تلقائياً بسبب onDelete: Cascade)
      await tx.kPI.delete({
        where: { id },
      })
    })

    res.json({ message: 'تم حذف المعيار وجميع الشواهد المرتبطة به بنجاح' })
  } catch (error: any) {
    logger.error('Error deleting KPI:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في حذف المعيار' })
  }
})

// ==================== Evidence Items ====================

// GET /api/admin/kpis/:id/evidence - Get evidence items for KPI
router.get('/kpis/:id/evidence', validate({ 
  params: z.object({ id: uuidSchema }) 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const evidenceItems = await prisma.evidenceItem.findMany({
      where: {
        kpiId: id,
        isOfficial: true,
        schoolId: null,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(evidenceItems)
  } catch (error: any) {
    logger.error('Error fetching evidence items:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب الشواهد' })
  }
})

// POST /api/admin/kpis/:id/evidence - Create evidence item
router.post('/kpis/:id/evidence', validate({ 
  params: z.object({ id: uuidSchema }),
  body: createEvidenceSchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name } = req.body

    const evidenceItem = await prisma.evidenceItem.create({
      data: {
        name,
        kpiId: id,
        isOfficial: true,
        schoolId: null,
      },
    })

    res.status(201).json(evidenceItem)
  } catch (error: any) {
    logger.error('Error creating evidence item:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في إنشاء الشاهد' })
  }
})

// PUT /api/admin/evidence/:id - Update evidence item
router.put('/evidence/:id', validate({ 
  params: z.object({ id: uuidSchema }),
  body: updateEvidenceSchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name } = req.body

    // التحقق من وجود الشاهد أولاً
    const evidenceItem = await prisma.evidenceItem.findUnique({
      where: { id },
    })

    if (!evidenceItem) {
      return res.status(404).json({ error: 'الشاهد غير موجود' })
    }

    // التحقق من أن الشاهد رسمي
    if (!evidenceItem.isOfficial || evidenceItem.schoolId) {
      return res.status(403).json({ error: 'لا يمكن تعديل هذا الشاهد' })
    }

    const updateData: any = {}
    if (name) updateData.name = name

    const updatedEvidence = await prisma.evidenceItem.update({
      where: { id },
      data: updateData,
    })

    res.json(updatedEvidence)
  } catch (error: any) {
    logger.error('Error updating evidence item:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تحديث الشاهد' })
  }
})

// DELETE /api/admin/evidence/:id - Delete evidence item
router.delete('/evidence/:id', validate({ 
  params: z.object({ id: uuidSchema }) 
}), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // التحقق من وجود الشاهد أولاً
    const evidenceItem = await prisma.evidenceItem.findUnique({
      where: { id },
    })

    if (!evidenceItem) {
      return res.status(404).json({ error: 'الشاهد غير موجود' })
    }

    // حذف جميع السجلات المرتبطة أولاً
    await prisma.$transaction(async (tx) => {
      // أولاً: حذف EvidenceSubmission المرتبطة بالشاهد
      await tx.evidenceSubmission.deleteMany({
        where: { evidenceId: id },
      })

      // ثانياً: حذف SchoolEvidenceItem المرتبطة (رغم وجود onDelete: Cascade، نتأكد من الحذف الصريح)
      await tx.schoolEvidenceItem.deleteMany({
        where: { evidenceId: id },
      })

      // أخيراً: حذف الشاهد نفسه
      await tx.evidenceItem.delete({
        where: { id },
      })
    }, {
      timeout: 10000, // زيادة timeout للـ transaction
    })

    res.json({ message: 'تم حذف الشاهد بنجاح' })
  } catch (error: any) {
    logger.error('Error deleting evidence item:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في حذف الشاهد' })
  }
})

// Helper function to parse weight/percentage values
// Supports multiple formats:
// - "10%" -> 10 (percentage with % sign, convert to 0-100 range)
// - "10" -> 10 (number without %, treated as 0-100 range)
// - "0.1" -> 10 (decimal, convert to 0-100 range: 0.1 * 100 = 10)
// - 10 (number) -> 10 (already in 0-100 range)
// - 0.1 (number) -> 10 (decimal, convert to 0-100 range)
function parseWeight(weightValue: string | number): number | null {
  // Handle number input directly
  if (typeof weightValue === 'number') {
    // If it's already a number:
    // - If <= 1, assume it's decimal (0.1 -> convert to 10)
    // - If > 1 and <= 100, assume it's already in 0-100 range (10 -> 10)
    if (weightValue <= 1 && weightValue > 0) {
      return weightValue * 100
    } else if (weightValue > 1 && weightValue <= 100) {
      return weightValue
    } else {
      return null
    }
  }
  
  // Handle string input
  if (!weightValue || typeof weightValue !== 'string') {
    return null
  }
  
  const trimmed = String(weightValue).trim()
  if (!trimmed) {
    return null
  }
  
  // Check if it contains percentage sign
  const hasPercent = trimmed.includes('%')
  
  // Remove percentage sign and any whitespace
  const cleaned = trimmed.replace(/%/g, '').trim()
  
  // Try to parse as number
  const num = parseFloat(cleaned)
  if (isNaN(num)) {
    return null
  }
  
  // If it had a percentage sign, it's already in 0-100 range (10% = 10)
  if (hasPercent) {
    return num
  }
  
  // If no percentage sign:
  // - If number is > 1 and <= 100, assume it's in 0-100 range (10 -> 10)
  // - If number is <= 1 and > 0, assume it's decimal (0.1 -> convert to 10)
  if (num > 1 && num <= 100) {
    return num
  } else if (num <= 1 && num > 0) {
    return num * 100
  } else {
    return null
  }
}

// POST /api/admin/job-types/preview-excel - Preview Excel data before import
router.post('/job-types/preview-excel', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'يرجى رفع ملف Excel' })
    }

    // Read Excel file
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    } catch (error: any) {
      logger.error('Error reading Excel file:', error)
      return res.status(400).json({ error: 'ملف Excel غير صالح أو تالف' })
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({ error: 'الملف لا يحتوي على أوراق بيانات' })
    }

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    if (!worksheet) {
      return res.status(400).json({ error: 'ورقة البيانات الأولى فارغة' })
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    if (data.length < 2) {
      return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على بيانات (يجب أن يحتوي على رأس وعمود واحد على الأقل)' })
    }

    // Skip header row and process data
    const rows = data.slice(1).filter(row => row && row.length > 0 && row[0]) // Skip empty rows

    // Group data by job type and KPI
    interface PreviewRowData {
      jobTypeName: string
      kpiName: string
      weight: number
      minAcceptedEvidence: number
      evidence: string
      rowNumber: number
    }

    interface PreviewKPI {
      name: string
      weight: number
      minAcceptedEvidence: number
      evidenceItems: string[]
      rowNumbers: number[]
    }

    interface PreviewJobType {
      name: string
      kpis: PreviewKPI[]
    }

    const processedData = new Map<string, Map<string, PreviewRowData[]>>()
    const errors: string[] = []
    let skippedRows = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // +2 because we skipped header and array is 0-indexed
      
      const jobTypeName = String(row[0] || '').trim()
      const kpiName = String(row[1] || '').trim()
      const weightValue = row[2] // Keep as original type (number or string) from Excel
      const minAcceptedEvidenceStr = String(row[3] || '1').trim()
      const evidence = String(row[4] || '').trim()

      if (!jobTypeName || !kpiName) {
        skippedRows++
        continue // Skip invalid rows
      }

      // Parse weight using helper function (handles both number and string)
      const parsedWeight = parseWeight(weightValue)
      if (parsedWeight === null || parsedWeight < 0 || parsedWeight > 100) {
        const weightDisplay = typeof weightValue === 'number' ? weightValue : String(weightValue || '0').trim()
        errors.push(`الصف ${rowNumber}: الوزن غير صالح (${weightDisplay}) - يجب أن يكون رقم بين 0 و 100`)
        skippedRows++
        continue
      }

      // Validate minAcceptedEvidence
      const minAcceptedEvidence = parseInt(minAcceptedEvidenceStr, 10)
      if (isNaN(minAcceptedEvidence) || minAcceptedEvidence < 1) {
        errors.push(`الصف ${rowNumber}: الحد الأدنى لعدد الشواهد غير صالح (${minAcceptedEvidenceStr}) - يجب أن يكون رقم صحيح أكبر من 0`)
        skippedRows++
        continue
      }

      if (!processedData.has(jobTypeName)) {
        processedData.set(jobTypeName, new Map())
      }

      const jobTypeMap = processedData.get(jobTypeName)!
      if (!jobTypeMap.has(kpiName)) {
        jobTypeMap.set(kpiName, [])
      }

      jobTypeMap.get(kpiName)!.push({
        jobTypeName,
        kpiName,
        weight: parsedWeight,
        minAcceptedEvidence,
        evidence,
        rowNumber,
      })
    }

    // Convert to preview structure
    const previewData: PreviewJobType[] = []
    for (const [jobTypeName, kpiMap] of processedData.entries()) {
      const kpis: PreviewKPI[] = []
      
      for (const [kpiName, rows] of kpiMap.entries()) {
        const firstRow = rows[0]
        const evidenceItems = new Set<string>()
        const rowNumbers: number[] = []
        
        for (const row of rows) {
          rowNumbers.push(row.rowNumber)
          if (row.evidence) {
            // Split by comma or semicolon
            const evidences = row.evidence.split(/[،,;؛]/).map(e => e.trim()).filter(e => e)
            evidences.forEach(e => evidenceItems.add(e))
          }
        }
        
        kpis.push({
          name: kpiName,
          weight: firstRow.weight,
          minAcceptedEvidence: firstRow.minAcceptedEvidence,
          evidenceItems: Array.from(evidenceItems),
          rowNumbers,
        })
      }
      
      previewData.push({
        name: jobTypeName,
        kpis,
      })
    }

    res.json({
      preview: previewData,
      errors: errors.length > 0 ? errors : undefined,
      skippedRows: skippedRows > 0 ? skippedRows : undefined,
      totalJobTypes: previewData.length,
      totalKPIs: previewData.reduce((sum, jt) => sum + jt.kpis.length, 0),
      totalEvidence: previewData.reduce((sum, jt) => 
        sum + jt.kpis.reduce((kpiSum, kpi) => kpiSum + kpi.evidenceItems.length, 0), 0),
    })
  } catch (error: any) {
    logger.error('Error previewing Excel:', error)
    res.status(500).json({ 
      error: error.message || 'حدث خطأ في معاينة الملف',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
})

// POST /api/admin/job-types/import-excel - Import job types, KPIs, and evidence from Excel
router.post('/job-types/import-excel', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'يرجى رفع ملف Excel' })
    }

    // Read Excel file
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    } catch (error: any) {
      logger.error('Error reading Excel file:', error)
      return res.status(400).json({ error: 'ملف Excel غير صالح أو تالف' })
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({ error: 'الملف لا يحتوي على أوراق بيانات' })
    }

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    if (!worksheet) {
      return res.status(400).json({ error: 'ورقة البيانات الأولى فارغة' })
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    if (data.length < 2) {
      return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على بيانات (يجب أن يحتوي على رأس وعمود واحد على الأقل)' })
    }

    // Skip header row and process data
    const rows = data.slice(1).filter(row => row && row.length > 0 && row[0]) // Skip empty rows

    // Group data by job type and KPI
    interface RowData {
      jobTypeName: string
      kpiName: string
      weight: number
      minAcceptedEvidence: number
      evidence: string
    }

    const processedData = new Map<string, Map<string, RowData[]>>() // jobType -> kpi -> rows

    const errors: string[] = []
    let skippedRows = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // +2 because we skipped header and array is 0-indexed
      
      const jobTypeName = String(row[0] || '').trim()
      const kpiName = String(row[1] || '').trim()
      const weightValue = row[2] // Keep as original type (number or string) from Excel
      const minAcceptedEvidenceStr = String(row[3] || '1').trim()
      const evidence = String(row[4] || '').trim()

      if (!jobTypeName || !kpiName) {
        skippedRows++
        continue // Skip invalid rows
      }

      // Parse weight using helper function (handles both number and string)
      const parsedWeight = parseWeight(weightValue)
      if (parsedWeight === null || parsedWeight < 0 || parsedWeight > 100) {
        const weightDisplay = typeof weightValue === 'number' ? weightValue : String(weightValue || '0').trim()
        errors.push(`الصف ${rowNumber}: الوزن غير صالح (${weightDisplay}) - يجب أن يكون رقم بين 0 و 100`)
        skippedRows++
        continue
      }
      const weight = parsedWeight

      // Validate minAcceptedEvidence
      const minAcceptedEvidence = parseInt(minAcceptedEvidenceStr, 10)
      if (isNaN(minAcceptedEvidence) || minAcceptedEvidence < 1) {
        errors.push(`الصف ${rowNumber}: الحد الأدنى لعدد الشواهد غير صالح (${minAcceptedEvidenceStr}) - يجب أن يكون رقم صحيح أكبر من 0`)
        skippedRows++
        continue
      }

      if (!processedData.has(jobTypeName)) {
        processedData.set(jobTypeName, new Map())
      }

      const jobTypeMap = processedData.get(jobTypeName)!
      if (!jobTypeMap.has(kpiName)) {
        jobTypeMap.set(kpiName, [])
      }

      jobTypeMap.get(kpiName)!.push({
        jobTypeName,
        kpiName,
        weight,
        minAcceptedEvidence: isNaN(minAcceptedEvidence) ? 1 : minAcceptedEvidence,
        evidence,
      })
    }

    if (processedData.size === 0) {
      return res.status(400).json({ 
        error: 'لا توجد بيانات صالحة للاستيراد',
        skippedRows,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // Statistics
    let jobTypesCreated = 0
    let jobTypesFound = 0
    let kpisCreated = 0
    let kpisUpdated = 0
    let evidenceCreated = 0

    // Process each job type
    await prisma.$transaction(async (tx) => {
      for (const [jobTypeName, kpiMap] of processedData.entries()) {
        // Find or create job type
        let jobType = await tx.jobType.findFirst({
          where: { name: jobTypeName },
        })

        if (!jobType) {
          jobType = await tx.jobType.create({
            data: {
              name: jobTypeName,
              status: true,
            },
          })
          jobTypesCreated++
        } else {
          jobTypesFound++
        }

        // Process each KPI
        for (const [kpiName, rows] of kpiMap.entries()) {
          // Get weight and minAcceptedEvidence from first row
          const firstRow = rows[0]
          const weight = firstRow.weight
          const minAcceptedEvidence = firstRow.minAcceptedEvidence

          // Collect all evidence items
          const evidenceItems = new Set<string>()
          for (const row of rows) {
            if (row.evidence) {
              // Split by comma or semicolon
              const evidences = row.evidence.split(/[،,;؛]/).map(e => e.trim()).filter(e => e)
              evidences.forEach(e => evidenceItems.add(e))
            }
          }

          // Find or create KPI
          let kpi = await tx.kPI.findFirst({
            where: {
              name: kpiName,
              jobTypeId: jobType.id,
              isOfficial: true,
              schoolId: null,
            },
          })

          if (kpi) {
            // Update existing KPI
            kpi = await tx.kPI.update({
              where: { id: kpi.id },
              data: {
                weight,
                minAcceptedEvidence,
              },
            })
            kpisUpdated++
          } else {
            // Create new KPI
            kpi = await tx.kPI.create({
              data: {
                name: kpiName,
                weight,
                minAcceptedEvidence,
                jobTypeId: jobType.id,
                isOfficial: true,
                schoolId: null,
              },
            })
            kpisCreated++
          }

          // Add evidence items
          for (const evidenceName of evidenceItems) {
            if (!evidenceName || evidenceName.trim() === '') {
              continue
            }

            // Check if evidence already exists
            const existingEvidence = await tx.evidenceItem.findFirst({
              where: {
                name: evidenceName,
                kpiId: kpi.id,
                isOfficial: true,
                schoolId: null,
              },
            })

            if (!existingEvidence) {
              try {
                await tx.evidenceItem.create({
                  data: {
                    name: evidenceName,
                    kpiId: kpi.id,
                    isOfficial: true,
                    schoolId: null,
                  },
                })
                evidenceCreated++
              } catch (error: any) {
                // Log but don't fail the transaction for evidence errors
                logger.warn(`Error creating evidence "${evidenceName}" for KPI "${kpiName}":`, error.message)
              }
            }
          }
        }
      }
    }, {
      timeout: 30000, // 30 seconds timeout for large files
    })

    res.json({
      message: 'تم استيراد البيانات بنجاح',
      jobTypesCreated,
      jobTypesFound,
      kpisCreated,
      kpisUpdated,
      evidenceCreated,
      skippedRows: skippedRows > 0 ? skippedRows : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    logger.error('Error importing Excel:', error)
    
    // If it's a validation error, return 400
    if (error.message && (error.message.includes('validation') || error.message.includes('invalid'))) {
      return res.status(400).json({ 
        error: error.message || 'خطأ في التحقق من صحة البيانات',
        details: error.details || undefined,
      })
    }
    
    res.status(500).json({ 
      error: error.message || 'حدث خطأ في استيراد الملف',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
})

export default router
