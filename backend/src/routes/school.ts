import { Router, Response } from 'express'
import { z } from 'zod'
import { AuthRequest, authenticate, requireSchoolManager } from '../middleware/auth'
import { csrfProtection } from '../middleware/csrf'
import { verifySchoolOwnership, verifyResourceId } from '../middleware/resourceOwnership'
import { validate } from '../middleware/validation'
import { sanitize } from '../middleware/validation'
import { createTeacherSchema, updateTeacherSchema } from '../schemas/school'
import { prisma } from '../lib/db'
import bcrypt from 'bcryptjs'
import { UserRole, SubmissionStatus } from '@prisma/client'
import { notifySchoolManagerOnTeacherAdded, notifySchoolManagerOnKPIAdded, notifyTeacherOnEvidenceReview } from '../lib/notifications'
import { calculateOverallScore } from '../lib/calculations'
import { parsePagination, createPaginationResponse } from '../middleware/pagination'
import { apiLimiter } from '../middleware/rateLimit'
import { getCache, setCache, CacheKeys } from '../lib/cache'
import logger from '../lib/logger'

const router = Router()

// Apply authentication and security middleware to all school routes
router.use(authenticate)
router.use(requireSchoolManager)
router.use(verifySchoolOwnership) // IDOR protection
router.use(verifyResourceId) // Validate UUID format

// Apply sanitize middleware to all routes EXCEPT the weights update route
// (we'll apply it manually to that route with special handling)
router.use((req, res, next) => {
  if (req.method === 'PUT' && req.path.includes('/job-types/') && req.path.includes('/kpis/weights')) {
    // Skip sanitize for weights route - we'll handle it manually
    return next()
  }
  sanitize(req, res, next)
})

router.use(csrfProtection) // CSRF protection for state-changing methods
router.use(apiLimiter)

// ==================== Dashboard ====================

// GET /api/school/dashboard/stats - Get dashboard statistics (cached)
router.get('/dashboard/stats', async (req: AuthRequest, res: Response) => {
    const user = req.user!
  try {
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // Check cache first
    const cacheKey = CacheKeys.DASHBOARD_STATS(user.schoolId)
    const cached = getCache(cacheKey)
    if (cached) {
      return res.json(cached)
    }

    // جلب الإحصائيات الأساسية
    const [teachersCount, pendingCount, acceptedCount, rejectedCount] = await prisma.$transaction([
      prisma.user.count({
        where: {
          schoolId: user.schoolId,
          role: UserRole.TEACHER,
          status: true,
        },
      }),
      prisma.evidenceSubmission.count({
        where: {
          teacher: {
            schoolId: user.schoolId,
          },
          status: SubmissionStatus.PENDING,
        },
      }),
      prisma.evidenceSubmission.count({
        where: {
          teacher: {
            schoolId: user.schoolId,
          },
          status: SubmissionStatus.ACCEPTED,
        },
      }),
      prisma.evidenceSubmission.count({
        where: {
          teacher: {
            schoolId: user.schoolId,
          },
          status: SubmissionStatus.REJECTED,
        },
      }),
    ])

    // جلب جميع المعلمين مع حساب درجاتهم
    const teachers = await prisma.user.findMany({
      where: {
        schoolId: user.schoolId,
        role: UserRole.TEACHER,
        status: true,
      },
      include: {
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // حساب الدرجات لكل معلم
    const teachersWithScores = await Promise.all(
      teachers.map(async (teacher) => {
        if (!teacher.jobTypeId || !teacher.schoolId) {
          return {
            id: teacher.id,
            name: teacher.name,
            jobType: teacher.jobType?.name || 'بدون صفة',
            overallScore: 0,
            overallPercentage: 0,
          }
        }

        try {
          const { overallScore, overallPercentage } = await calculateOverallScore(
            teacher.id,
            teacher.jobTypeId,
            teacher.schoolId
          )

          return {
            id: teacher.id,
            name: teacher.name,
            jobType: teacher.jobType?.name || 'بدون صفة',
            overallScore: Math.round(overallScore * 100) / 100,
            overallPercentage: Math.round(overallPercentage * 100) / 100,
          }
        } catch (error) {
          return {
            id: teacher.id,
            name: teacher.name,
            jobType: teacher.jobType?.name || 'بدون صفة',
            overallScore: 0,
            overallPercentage: 0,
          }
        }
      })
    )

    // حساب متوسط الدرجة النهائية
    const validScores = teachersWithScores.filter((t) => t.overallScore > 0)
    const averageScore = validScores.length > 0
      ? validScores.reduce((sum, t) => sum + t.overallScore, 0) / validScores.length
      : 0

    // أفضل 3 معلمين
    const topTeachers = [...teachersWithScores]
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 3)
      .filter((t) => t.overallScore > 0)

    // المعلمين الأقل أداءً (أقل 3)
    const bottomTeachers = [...teachersWithScores]
      .sort((a, b) => a.overallScore - b.overallScore)
      .slice(0, 3)
      .filter((t) => t.overallScore > 0)

    const response = {
      stats: {
        teachersCount,
        pendingCount,
        acceptedCount,
        rejectedCount,
        averageScore: Math.round(averageScore * 100) / 100,
        averagePercentage: Math.round((averageScore / 5) * 100 * 100) / 100,
      },
      topTeachers,
      bottomTeachers,
    }

    // Cache for 5 minutes
    setCache(cacheKey, response, 300)

    res.json(response)
  } catch (error: any) {
    logger.error('Dashboard stats error:', { error: error.message, stack: error.stack, schoolId: user.schoolId })
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب الإحصائيات' })
  }
})

// GET /api/school/dashboard/charts - Get charts data
router.get('/dashboard/charts', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // بيانات الرسم البياني الدائري لحالات الشواهد
    const [pending, accepted, rejected] = await prisma.$transaction([
      prisma.evidenceSubmission.count({
        where: {
          teacher: { schoolId: user.schoolId },
          status: SubmissionStatus.PENDING,
        },
      }),
      prisma.evidenceSubmission.count({
        where: {
          teacher: { schoolId: user.schoolId },
          status: SubmissionStatus.ACCEPTED,
        },
      }),
      prisma.evidenceSubmission.count({
        where: {
          teacher: { schoolId: user.schoolId },
          status: SubmissionStatus.REJECTED,
        },
      }),
    ])

    // بيانات الرسم البياني العمودي لتوزيع الدرجات
    const teachers = await prisma.user.findMany({
      where: {
        schoolId: user.schoolId,
        role: 'TEACHER',
        status: true,
      },
      select: {
        id: true,
        jobTypeId: true,
      },
    })

    // تجميع الدرجات في فئات (0-1, 1-2, 2-3, 3-4, 4-5)
    const scoreRanges = [0, 0, 0, 0, 0] // 0-1, 1-2, 2-3, 3-4, 4-5

    for (const teacher of teachers) {
      if (!teacher.jobTypeId) continue
      
      try {
        const { overallScore } = await calculateOverallScore(
          teacher.id,
          teacher.jobTypeId,
          user.schoolId
        )

        if (overallScore >= 0 && overallScore < 1) scoreRanges[0]++
        else if (overallScore >= 1 && overallScore < 2) scoreRanges[1]++
        else if (overallScore >= 2 && overallScore < 3) scoreRanges[2]++
        else if (overallScore >= 3 && overallScore < 4) scoreRanges[3]++
        else if (overallScore >= 4 && overallScore <= 5) scoreRanges[4]++
      } catch (error) {
        // تجاهل الأخطاء
      }
    }

    res.json({
      evidenceStatus: {
        labels: ['قيد المراجعة', 'مقبولة', 'مرفوضة'],
        data: [pending, accepted, rejected],
      },
      scoreDistribution: {
        labels: ['0-1', '1-2', '2-3', '3-4', '4-5'],
        data: scoreRanges,
      },
    })
  } catch (error: any) {
    logger.error('Charts data error:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب بيانات الرسوم البيانية' })
  }
})

// ==================== Teachers ====================

// GET /api/school/teachers - Get all teachers
router.get('/teachers', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    const { page, limit, skip } = parsePagination(req)

    const [teachers, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          schoolId: user.schoolId,
          role: UserRole.TEACHER,
          status: true,
        },
        include: {
          jobType: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: {
          schoolId: user.schoolId,
          role: UserRole.TEACHER,
          status: true,
        },
      }),
    ])

    res.json(createPaginationResponse(teachers, total, page, limit))
  } catch (error: any) {
    logger.error('Error fetching teachers:', { error: error.message, stack: error.stack })
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب المعلمين' })
  }
})

// POST /api/school/teachers - Create teacher
router.post('/teachers', validate({ body: createTeacherSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    const { name, username, password, jobTypeId } = req.body

    if (!name || !username || !password || !jobTypeId) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة (بما في ذلك صفة الموظف)' })
    }

    // Verify jobType exists and is active
    const jobType = await prisma.jobType.findFirst({
      where: {
        id: jobTypeId,
        status: true,
      },
    })

    if (!jobType) {
      return res.status(400).json({ error: 'صفة الموظف المحددة غير موجودة أو غير نشطة' })
    }

    // Check if username exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    const teacher = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: UserRole.TEACHER,
        schoolId: user.schoolId,
        jobTypeId,
      },
    })

    // إشعار مديري المدرسة الآخرين (إن وجدوا)
    await notifySchoolManagerOnTeacherAdded(user.schoolId, teacher.name)

    res.status(201).json(teacher)
  } catch (error: any) {
    logger.error('Error creating teacher:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في إنشاء المعلم' })
  }
})

// PUT /api/school/teachers/:teacherId - Update teacher
router.put('/teachers/:teacherId', validate({ 
  params: z.object({ teacherId: z.string().uuid() }),
  body: updateTeacherSchema 
}), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { teacherId } = req.params
    const { name, jobTypeId, status } = req.body

    // Verify teacher belongs to school
    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherId,
        schoolId: user.schoolId,
        role: UserRole.TEACHER,
      },
    })

    if (!teacher) {
      return res.status(404).json({ error: 'المعلم غير موجود' })
    }

    const updateData: any = {}
    if (name) updateData.name = name
    if (jobTypeId) updateData.jobTypeId = jobTypeId
    if (status !== undefined) updateData.status = status

    const updatedTeacher = await prisma.user.update({
      where: { id: teacherId },
      data: updateData,
    })

    res.json(updatedTeacher)
  } catch (error: any) {
    logger.error('Error updating teacher:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تحديث المعلم' })
  }
})

// DELETE /api/school/teachers/:teacherId - Delete teacher
router.delete('/teachers/:teacherId', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { teacherId } = req.params

    // Verify teacher belongs to school
    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherId,
        schoolId: user.schoolId,
        role: UserRole.TEACHER,
      },
    })

    if (!teacher) {
      return res.status(404).json({ error: 'المعلم غير موجود' })
    }

    await prisma.user.delete({
      where: { id: teacherId },
    })

    res.json({ message: 'تم حذف المعلم بنجاح' })
  } catch (error: any) {
    logger.error('Error deleting teacher:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في حذف المعلم' })
  }
})

// GET /api/school/teachers/:teacherId/submissions - Get all submissions for a teacher
// NOTE: This must come BEFORE /teachers/:teacherId/score to avoid route conflicts
router.get('/teachers/:teacherId/submissions', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { teacherId } = req.params

    logger.debug('📥 Fetching submissions for teacher:', teacherId)

    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // التحقق من أن المعلم ينتمي لنفس المدرسة
    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherId,
        schoolId: user.schoolId,
        role: 'TEACHER',
      },
    })

    if (!teacher) {
      logger.debug('❌ Teacher not found:', teacherId)
      return res.status(404).json({ error: 'المعلم غير موجود أو لا ينتمي لهذه المدرسة' })
    }

    logger.debug('✅ Teacher found:', teacher.name)

    // جلب جميع الشواهد المرفوعة من المعلم
    const submissions = await prisma.evidenceSubmission.findMany({
      where: {
        teacherId: teacher.id,
      },
      include: {
        kpi: {
          select: {
            id: true,
            name: true,
          },
        },
        evidence: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    logger.debug('📊 Found submissions:', submissions.length)
    logger.debug('📋 Submissions:', submissions.map(s => ({
      id: s.id,
      evidence: s.evidence.name,
      kpi: s.kpi.name,
      status: s.status
    })))

    res.json(submissions)
  } catch (error: any) {
    logger.error('❌ Error fetching teacher submissions:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب الشواهد' })
  }
})

// GET /api/school/teachers/scores - Get all teachers scores
router.get('/teachers/scores', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // جلب جميع المعلمين في المدرسة
    const teachers = await prisma.user.findMany({
      where: {
        schoolId: user.schoolId,
        role: 'TEACHER',
        status: true,
      },
      include: {
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // حساب الدرجات لكل معلم
    const teachersWithScores = await Promise.all(
      teachers.map(async (teacher) => {
        if (!teacher.jobTypeId || !teacher.schoolId) {
          return {
            id: teacher.id,
            name: teacher.name,
            jobType: teacher.jobType?.name || 'غير محدد',
            overallScore: 0,
            overallPercentage: 0,
            error: 'بيانات غير مكتملة',
          }
        }

        try {
          const { overallScore, overallPercentage, kpiScores } =
            await calculateOverallScore(
              teacher.id,
              teacher.jobTypeId,
              teacher.schoolId
            )

          return {
            id: teacher.id,
            name: teacher.name,
            jobType: teacher.jobType?.name || 'غير محدد',
            overallScore: Math.round(overallScore * 100) / 100,
            overallPercentage: Math.round(overallPercentage * 100) / 100,
            kpis: kpiScores.map((kpi) => ({
              kpiId: kpi.kpiId,
              kpiName: kpi.kpiName,
              weight: kpi.weight,
              score: Math.round(kpi.score * 100) / 100,
              acceptedCount: kpi.acceptedCount,
              minRequired: kpi.minRequired,
              isAchieved: kpi.isAchieved,
            })),
          }
        } catch (error: any) {
          logger.error(`Error calculating score for teacher ${teacher.id}:`, error)
          return {
            id: teacher.id,
            name: teacher.name,
            jobType: teacher.jobType?.name || 'غير محدد',
            overallScore: 0,
            overallPercentage: 0,
            error: error.message || 'خطأ في الحساب',
          }
        }
      })
    )

    // جمع جميع الصفات الوظيفية الفريدة
    const uniqueJobTypes = Array.from(
      new Map(
        teachers
          .filter(t => t.jobTypeId)
          .map(t => [t.jobTypeId!, { id: t.jobTypeId!, name: t.jobType?.name || 'غير محدد' }])
      ).values()
    )

    // جلب معلومات الأوزان لكل صفة وظيفية
    const jobTypesWeights = await Promise.all(
      uniqueJobTypes.map(async (jobType) => {
        try {
          const schoolJobTypeKPIs = await prisma.schoolJobTypeKPI.findMany({
            where: {
              schoolId: user.schoolId,
              jobTypeId: jobType.id,
            },
            select: {
              weight: true,
              isActive: true,
            },
          })
          
          let totalWeight = 0
          
          // إذا كانت هناك أوزان مخصصة في SchoolJobTypeKPI، استخدمها
          if (schoolJobTypeKPIs.length > 0) {
            totalWeight = schoolJobTypeKPIs
            .filter((sjk) => sjk.isActive)
            .reduce((sum, sjk) => sum + sjk.weight, 0)
          } else {
            // إذا لم تكن هناك أوزان مخصصة، احسب من المعايير الرسمية
            const officialKPIs = await prisma.kPI.findMany({
              where: {
                jobTypeId: jobType.id,
                isOfficial: true,
                schoolId: null,
              },
              select: {
                weight: true,
              },
            })
            
            totalWeight = officialKPIs.reduce((sum, kpi) => sum + kpi.weight, 0)
          }
          
          return {
            jobTypeId: jobType.id,
            jobTypeName: jobType.name,
            totalWeight: Math.round(totalWeight * 100) / 100,
            isValid: Math.abs(totalWeight - 100) < 0.01,
          }
        } catch (error: any) {
          logger.warn(`Failed to fetch weights for job type ${jobType.id}:`, error.message)
          return {
            jobTypeId: jobType.id,
            jobTypeName: jobType.name,
            totalWeight: 100,
            isValid: true,
          }
        }
      })
    )

    res.json({
      teachers: teachersWithScores,
      jobTypesWeights,
    })
  } catch (error: any) {
    logger.error('Scores API error:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب درجات المعلمين' })
  }
})

// GET /api/school/teachers/:teacherId/score - Get teacher score details
router.get('/teachers/:teacherId/score', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { teacherId } = req.params

    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // التحقق من أن المعلم ينتمي لنفس المدرسة
    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherId,
        schoolId: user.schoolId,
        role: 'TEACHER',
      },
      include: {
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!teacher) {
      return res.status(404).json({ error: 'المعلم غير موجود أو لا ينتمي لهذه المدرسة' })
    }

    if (!teacher.jobTypeId || !teacher.schoolId) {
      return res.status(400).json({ error: 'بيانات المعلم غير مكتملة' })
    }

    // حساب الدرجة النهائية
    const { overallScore, overallPercentage, kpiScores } =
      await calculateOverallScore(
        teacher.id,
        teacher.jobTypeId,
        teacher.schoolId
      )

    // جلب تفاصيل كل معيار مع عدد الشواهد
    const kpisDetails = await Promise.all(
      kpiScores.map(async (kpiScore) => {
        // جلب معلومات المعيار
        const kpi = await prisma.kPI.findUnique({
          where: { id: kpiScore.kpiId },
          select: {
            name: true,
            minAcceptedEvidence: true,
          },
        })

        // جلب عدد الشواهد لكل حالة
        const [approvedCount, pendingCount, rejectedCount] = await Promise.all([
          prisma.evidenceSubmission.count({
            where: {
              teacherId: teacher.id,
              kpiId: kpiScore.kpiId,
              status: SubmissionStatus.ACCEPTED,
            },
          }),
          prisma.evidenceSubmission.count({
            where: {
              teacherId: teacher.id,
              kpiId: kpiScore.kpiId,
              status: SubmissionStatus.PENDING,
            },
          }),
          prisma.evidenceSubmission.count({
            where: {
              teacherId: teacher.id,
              kpiId: kpiScore.kpiId,
              status: SubmissionStatus.REJECTED,
            },
          }),
        ])

        return {
          kpiId: kpiScore.kpiId,
          name: kpi?.name || kpiScore.kpiName,
          weight: kpiScore.weight,
          score: Math.round(kpiScore.score * 100) / 100,
          approvedEvidenceCount: approvedCount,
          pendingEvidenceCount: pendingCount,
          rejectedEvidenceCount: rejectedCount,
          minAcceptedEvidence: kpi?.minAcceptedEvidence ?? kpiScore.minRequired ?? null,
          isAchieved: kpiScore.isAchieved,
        }
      })
    )

    // جلب معلومات الأوزان للصفة الوظيفية
    let weightsInfo = {
      totalWeight: 100,
      isValid: true,
      jobTypeName: teacher.jobType?.name || '',
    }
    
    try {
      if (teacher.jobTypeId) {
        // جلب الأوزان من SchoolJobTypeKPI أولاً
        const schoolJobTypeKPIs = await prisma.schoolJobTypeKPI.findMany({
          where: {
            schoolId: teacher.schoolId,
            jobTypeId: teacher.jobTypeId,
          },
          select: {
            weight: true,
            isActive: true,
          },
        })
        
        let totalWeight = 0
        
        // إذا كانت هناك أوزان مخصصة في SchoolJobTypeKPI، استخدمها
        if (schoolJobTypeKPIs.length > 0) {
          totalWeight = schoolJobTypeKPIs
          .filter((sjk) => sjk.isActive)
          .reduce((sum, sjk) => sum + sjk.weight, 0)
        } else {
          // إذا لم تكن هناك أوزان مخصصة، احسب من المعايير الرسمية
          const officialKPIs = await prisma.kPI.findMany({
            where: {
              jobTypeId: teacher.jobTypeId,
              isOfficial: true,
              schoolId: null,
            },
            select: {
              weight: true,
            },
          })
          
          totalWeight = officialKPIs.reduce((sum, kpi) => sum + kpi.weight, 0)
        }
        
        weightsInfo = {
          totalWeight: Math.round(totalWeight * 100) / 100,
          isValid: Math.abs(totalWeight - 100) < 0.01,
          jobTypeName: teacher.jobType?.name || '',
        }
      }
    } catch (error: any) {
      // إذا فشل جلب الأوزان، استخدم القيم الافتراضية
      logger.warn('Failed to fetch weights info for teacher score:', error.message)
    }

    res.json({
      teacherId: teacher.id,
      teacherName: teacher.name,
      jobType: teacher.jobType?.name || '',
      overallScore: Math.round(overallScore * 100) / 100,
      overallPercentage: Math.round(overallPercentage * 100) / 100,
      kpis: kpisDetails,
      weightsInfo,
    })
  } catch (error: any) {
    logger.error('Teacher score API error:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب درجة المعلم' })
  }
})

// ==================== KPIs ====================

// GET /api/school/kpis - Get all KPIs (official + school-specific)
router.get('/kpis', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // Get official KPIs (from admin)
    const officialKPIs = await prisma.kPI.findMany({
      where: {
        isOfficial: true,
        schoolId: null,
      },
      include: {
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
        evidenceItems: {
          where: {
            OR: [
              { isOfficial: true, schoolId: null }, // Official evidence
              { schoolId: user.schoolId, isOfficial: false }, // School-specific evidence
            ],
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get school-specific KPIs
    const schoolKPIs = await prisma.kPI.findMany({
      where: {
        schoolId: user.schoolId,
        isOfficial: false,
      },
      include: {
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
        evidenceItems: {
          where: {
            schoolId: user.schoolId,
            isOfficial: false,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      official: officialKPIs,
      school: schoolKPIs,
    })
  } catch (error: any) {
    logger.error('Error fetching KPIs:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب المعايير' })
  }
})

// POST /api/school/kpis - Create school-specific KPI
router.post('/kpis', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    const { name, weight, jobTypeId, minAcceptedEvidence } = req.body

    if (!name || weight === undefined || !jobTypeId) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' })
    }

    if (weight < 0 || weight > 100) {
      return res.status(400).json({ error: 'الوزن يجب أن يكون بين 0 و 100' })
    }

    // التحقق من الحد الأدنى لعدد الشواهد المقبولة
    if (minAcceptedEvidence !== undefined && minAcceptedEvidence !== null) {
      if (!Number.isInteger(minAcceptedEvidence) || minAcceptedEvidence < 1) {
        return res.status(400).json({ error: 'الحد الأدنى لعدد الشواهد المقبولة يجب أن يكون رقماً صحيحاً موجباً (1 أو أكثر)' })
      }
    }

    const kpi = await prisma.kPI.create({
      data: {
        name,
        weight,
        minAcceptedEvidence: minAcceptedEvidence || null,
        jobTypeId,
        isOfficial: false,
        schoolId: user.schoolId,
      },
    })

    // إشعار مديري المدرسة الآخرين (إن وجدوا)
    await notifySchoolManagerOnKPIAdded(user.schoolId, kpi.name)

    res.status(201).json(kpi)
  } catch (error: any) {
    logger.error('Error creating KPI:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في إنشاء المعيار' })
  }
})

// PUT /api/school/kpis/:id - Update KPI (if official, create school-specific copy and disable official)
// Note: This route must come BEFORE /kpis/:id/evidence to avoid route conflicts
router.put('/kpis/:id', async (req: AuthRequest, res: Response) => {
  try {
    logger.info('PUT /kpis/:id route hit', {
      path: req.path,
      method: req.method,
      params: req.params,
      body: req.body,
    })

    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    const { id } = req.params
    const { name, weight, minAcceptedEvidence } = req.body

    logger.info('Updating KPI', {
      kpiId: id,
      schoolId: user.schoolId,
      data: { name, weight, minAcceptedEvidence },
    })

    // جلب المعيار الحالي
    const currentKPI = await prisma.kPI.findUnique({
      where: { id },
      include: {
        jobType: true,
        evidenceItems: {
          where: {
            OR: [
              { isOfficial: true, schoolId: null },
              { schoolId: user.schoolId, isOfficial: false },
            ],
          },
        },
      },
    })

    if (!currentKPI) {
      return res.status(404).json({ error: 'المعيار غير موجود' })
    }

    // التحقق من صحة البيانات
    if (weight !== undefined && (weight < 0 || weight > 100)) {
      return res.status(400).json({ error: 'الوزن يجب أن يكون بين 0 و 100' })
    }

    if (minAcceptedEvidence !== undefined && minAcceptedEvidence !== null) {
      if (!Number.isInteger(minAcceptedEvidence) || minAcceptedEvidence < 1) {
        return res.status(400).json({ error: 'الحد الأدنى لعدد الشواهد المقبولة يجب أن يكون رقماً صحيحاً موجباً (1 أو أكثر)' })
      }
    }

    // إذا كان المعيار رسمي، إنشاء نسخة خاصة وتعطيل الرسمي
    if (currentKPI.isOfficial && currentKPI.schoolId === null) {
      // البحث عن معيار خاص موجود مرتبط بنفس المعيار الرسمي (عن طريق البحث بالاسم الأصلي أو الاسم الجديد)
      // أولاً: البحث عن معيار خاص موجود بنفس الاسم الأصلي
      let schoolKPI = await prisma.kPI.findFirst({
        where: {
          schoolId: user.schoolId,
          isOfficial: false,
          jobTypeId: currentKPI.jobTypeId,
          name: currentKPI.name, // البحث بالاسم الأصلي أولاً
        },
      })

      // إذا لم يوجد، ابحث بالاسم الجديد
      if (!schoolKPI && name && name !== currentKPI.name) {
        schoolKPI = await prisma.kPI.findFirst({
          where: {
            schoolId: user.schoolId,
            isOfficial: false,
            jobTypeId: currentKPI.jobTypeId,
            name: name,
          },
        })
      }

      if (schoolKPI) {
        // تحديث المعيار الخاص الموجود
        schoolKPI = await prisma.kPI.update({
          where: { id: schoolKPI.id },
          data: {
            name: name || currentKPI.name,
            weight: weight !== undefined ? weight : currentKPI.weight,
            minAcceptedEvidence: minAcceptedEvidence !== undefined ? minAcceptedEvidence : currentKPI.minAcceptedEvidence,
          },
          include: {
            jobType: true,
            evidenceItems: true,
          },
        })
      } else {
        // إنشاء معيار خاص جديد
        schoolKPI = await prisma.kPI.create({
          data: {
            name: name || currentKPI.name,
            weight: weight !== undefined ? weight : currentKPI.weight,
            minAcceptedEvidence: minAcceptedEvidence !== undefined ? minAcceptedEvidence : currentKPI.minAcceptedEvidence,
            jobTypeId: currentKPI.jobTypeId,
            isOfficial: false,
            schoolId: user.schoolId,
          },
          include: {
            jobType: true,
            evidenceItems: true,
          },
        })

        // نسخ الشواهد الرسمية إلى الشواهد الخاصة
        const officialEvidences = currentKPI.evidenceItems.filter(e => e.isOfficial)
        if (officialEvidences.length > 0) {
          await Promise.all(
            officialEvidences.map(evidence =>
              prisma.evidenceItem.create({
                data: {
                  name: evidence.name,
                  kpiId: schoolKPI!.id,
                  isOfficial: false,
                  schoolId: user.schoolId,
                },
              })
            )
          )
        }
      }

      // تعطيل المعيار الرسمي في SchoolJobTypeKPI
      // إنشاء أو تحديث السجل لضمان تعطيل المعيار الرسمي
      try {
        await prisma.schoolJobTypeKPI.upsert({
          where: {
            schoolId_jobTypeId_kpiId: {
              schoolId: user.schoolId,
              jobTypeId: currentKPI.jobTypeId,
              kpiId: id,
            },
          },
          update: {
            isActive: false,
          },
          create: {
            schoolId: user.schoolId,
            jobTypeId: currentKPI.jobTypeId,
            kpiId: id,
            weight: currentKPI.weight,
            isActive: false, // تعطيل المعيار الرسمي
          },
        })
        logger.info('Disabled official KPI in SchoolJobTypeKPI', {
          kpiId: id,
          schoolId: user.schoolId,
          jobTypeId: currentKPI.jobTypeId,
        })
      } catch (error) {
        logger.error('Could not disable official KPI in SchoolJobTypeKPI:', error)
        // لا نوقف العملية إذا فشل التعطيل، لكن نسجل الخطأ
      }

      // إضافة المعيار الخاص إلى SchoolJobTypeKPI إذا لم يكن موجود
      try {
        await prisma.schoolJobTypeKPI.upsert({
          where: {
            schoolId_jobTypeId_kpiId: {
              schoolId: user.schoolId,
              jobTypeId: currentKPI.jobTypeId,
              kpiId: schoolKPI.id,
            },
          },
          update: {
            weight: schoolKPI.weight,
            isActive: true,
          },
          create: {
            schoolId: user.schoolId,
            jobTypeId: currentKPI.jobTypeId,
            kpiId: schoolKPI.id,
            weight: schoolKPI.weight,
            isActive: true,
          },
        })
      } catch (error) {
        logger.warn('Could not upsert SchoolJobTypeKPI:', error)
      }

      logger.info('Created school-specific KPI from official KPI', {
        originalKPIId: id,
        newKPIId: schoolKPI.id,
        schoolId: user.schoolId,
      })

      res.json({
        ...schoolKPI,
        message: 'تم إنشاء نسخة خاصة من المعيار وتعطيل المعيار الرسمي',
        originalKPIId: id,
      })
    } else {
      // إذا كان المعيار خاص، تحديثه مباشرة
      if (currentKPI.schoolId !== user.schoolId) {
        return res.status(403).json({ error: 'غير مصرح بتعديل هذا المعيار' })
      }

      const updateData: any = {}
      if (name !== undefined && name !== null && name !== '') {
        updateData.name = name
      }
      if (weight !== undefined && weight !== null) {
        updateData.weight = weight
      }
      if (minAcceptedEvidence !== undefined && minAcceptedEvidence !== null) {
        updateData.minAcceptedEvidence = minAcceptedEvidence
      }

      const updatedKPI = await prisma.kPI.update({
        where: { id },
        data: updateData,
        include: {
          jobType: true,
          evidenceItems: {
            where: {
              schoolId: user.schoolId,
              isOfficial: false,
            },
          },
        },
      })

      // تحديث الوزن في SchoolJobTypeKPI إذا كان موجود
      try {
        await prisma.schoolJobTypeKPI.updateMany({
          where: {
            schoolId: user.schoolId,
            jobTypeId: updatedKPI.jobTypeId,
            kpiId: id,
          },
          data: {
            weight: updatedKPI.weight,
          },
        })
      } catch (error) {
        logger.warn('Could not update SchoolJobTypeKPI weight:', error)
      }

      res.json(updatedKPI)
    }
  } catch (error: any) {
    logger.error('Error updating KPI:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تحديث المعيار' })
  }
})

// DELETE /api/school/kpis/:id - Delete school-specific KPI
router.delete('/kpis/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { id } = req.params

    // Verify KPI belongs to school
    const kpi = await prisma.kPI.findFirst({
      where: {
        id,
        schoolId: user.schoolId,
        isOfficial: false, // Only allow deleting school-specific KPIs
      },
    })

    if (!kpi) {
      return res.status(404).json({ error: 'المعيار غير موجود أو لا يمكن حذفه' })
    }

    // Delete all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Get all evidence items for this KPI first
      const evidenceItems = await tx.evidenceItem.findMany({
        where: { kpiId: id },
        select: { id: true },
      })

      // Delete EvidenceSubmission related to evidence items FIRST (before deleting evidence items)
      if (evidenceItems.length > 0) {
        const evidenceIds = evidenceItems.map((e) => e.id)
        await tx.evidenceSubmission.deleteMany({
          where: { evidenceId: { in: evidenceIds } },
        })
      }

      // Delete EvidenceSubmission related to the KPI
      await tx.evidenceSubmission.deleteMany({
        where: { kpiId: id },
      })

      // Delete SchoolJobTypeKPI related to this KPI
      await tx.schoolJobTypeKPI.deleteMany({
        where: { kpiId: id },
      })

      // Delete SchoolKPI related to this KPI
      await tx.schoolKPI.deleteMany({
        where: { kpiId: id },
      })

      // Delete SchoolEvidenceItem related to evidence items (before deleting evidence items)
      if (evidenceItems.length > 0) {
        const evidenceIds = evidenceItems.map((e) => e.id)
        await tx.schoolEvidenceItem.deleteMany({
          where: { evidenceId: { in: evidenceIds } },
        })
      }

      // Delete evidence items manually (before deleting KPI to avoid cascade issues)
      if (evidenceItems.length > 0) {
        const evidenceIds = evidenceItems.map((e) => e.id)
        await tx.evidenceItem.deleteMany({
          where: { id: { in: evidenceIds } },
        })
      }

      // Delete KPI (now safe to delete since all related records are gone)
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

// POST /api/school/kpis/:id/evidence - Add evidence to KPI
router.post('/kpis/:id/evidence', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { id } = req.params
    const { name } = req.body

    if (!name) {
      return res.status(400).json({ error: 'اسم الشاهد مطلوب' })
    }

    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // Check if KPI exists (official or school-specific)
    const kpi = await prisma.kPI.findFirst({
      where: {
        id,
        OR: [
          { isOfficial: true, schoolId: null }, // Official KPI
          { schoolId: user.schoolId }, // School-specific KPI
        ],
      },
    })

    if (!kpi) {
      return res.status(404).json({ error: 'المعيار غير موجود' })
    }

    // If it's an official KPI, create a school-specific evidence item
    // If it's a school KPI, create a school-specific evidence item
    const evidenceItem = await prisma.evidenceItem.create({
      data: {
        name,
        kpiId: id,
        isOfficial: false, // Always school-specific
        schoolId: user.schoolId,
      },
    })

    res.status(201).json(evidenceItem)
  } catch (error: any) {
    logger.error('Error creating evidence item:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في إنشاء الشاهد' })
  }
})

// PUT /api/school/kpis/:id/evidence - Update evidence item
router.put('/kpis/:id/evidence', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { id } = req.params
    const { evidenceId, name } = req.body

    if (!evidenceId || !name) {
      return res.status(400).json({ error: 'معرف الشاهد واسمه مطلوبان' })
    }

    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // Verify evidence belongs to school
    const evidence = await prisma.evidenceItem.findFirst({
      where: {
        id: evidenceId,
        kpiId: id,
        schoolId: user.schoolId,
        isOfficial: false,
      },
    })

    if (!evidence) {
      return res.status(404).json({ error: 'الشاهد غير موجود أو لا يمكن تعديله' })
    }

    const updatedEvidence = await prisma.evidenceItem.update({
      where: { id: evidenceId },
      data: { name },
    })

    res.json(updatedEvidence)
  } catch (error: any) {
    logger.error('Error updating evidence item:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تعديل الشاهد' })
  }
})

// DELETE /api/school/kpis/:id/evidence - Delete evidence item
router.delete('/kpis/:id/evidence', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { id } = req.params
    const { evidenceId } = req.body

    if (!evidenceId) {
      return res.status(400).json({ error: 'معرف الشاهد مطلوب' })
    }

    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // Verify evidence belongs to school
    const evidence = await prisma.evidenceItem.findFirst({
      where: {
        id: evidenceId,
        kpiId: id,
        schoolId: user.schoolId,
        isOfficial: false,
      },
    })

    if (!evidence) {
      return res.status(404).json({ error: 'الشاهد غير موجود أو لا يمكن حذفه' })
    }

    await prisma.evidenceItem.delete({
      where: { id: evidenceId },
    })

    res.json({ message: 'تم حذف الشاهد بنجاح' })
  } catch (error: any) {
    logger.error('Error deleting evidence item:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في حذف الشاهد' })
  }
})

// ==================== Evidence Review ====================

// GET /api/school/evidence/pending - Get pending submissions
router.get('/evidence/pending', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    const submissions = await prisma.evidenceSubmission.findMany({
      where: {
        teacher: {
          schoolId: user.schoolId,
        },
        status: SubmissionStatus.PENDING,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            jobType: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        kpi: {
          select: {
            id: true,
            name: true,
          },
        },
        evidence: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(submissions)
  } catch (error: any) {
    logger.error('Error fetching pending submissions:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب الشواهد المعلقة' })
  }
})

// POST /api/school/evidence/:id/review - Review evidence submission
router.post('/evidence/:id/review', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { id } = req.params
    const { action, rating, rejectReason } = req.body

    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    if (action !== 'accept' && action !== 'reject') {
      return res.status(400).json({ error: 'الإجراء غير صحيح' })
    }

    // Verify submission belongs to school
    const submission = await prisma.evidenceSubmission.findFirst({
      where: {
        id,
        teacher: {
          schoolId: user.schoolId,
        },
      },
      include: {
        teacher: {
          select: { id: true },
        },
        kpi: {
          select: { name: true },
        },
        evidence: {
          select: { name: true },
        },
      },
    })

    if (!submission) {
      return res.status(404).json({ error: 'الطلب غير موجود' })
    }

    if (action === 'accept') {
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5' })
      }

      await prisma.evidenceSubmission.update({
        where: { id },
        data: {
          status: SubmissionStatus.ACCEPTED,
          rating,
          reviewedAt: new Date(),
        },
      })

      // إشعار المعلم
      await notifyTeacherOnEvidenceReview(
        submission.teacher.id,
        'accepted',
        submission.kpi.name,
        submission.evidence.name,
        rating
      )
    } else {
      if (!rejectReason) {
        return res.status(400).json({ error: 'سبب الرفض مطلوب' })
      }

      await prisma.evidenceSubmission.update({
        where: { id },
        data: {
          status: SubmissionStatus.REJECTED,
          rejectReason,
          reviewedAt: new Date(),
        },
      })

      // إشعار المعلم
      await notifyTeacherOnEvidenceReview(
        submission.teacher.id,
        'rejected',
        submission.kpi.name,
        submission.evidence.name,
        undefined,
        rejectReason
      )
    }

    res.json({ message: 'تم التقييم بنجاح' })
  } catch (error: any) {
    logger.error('Error reviewing evidence:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في تقييم الشاهد' })
  }
})

// ==================== Job Types ====================

// GET /api/school/job-types - Get all job types
router.get('/job-types', async (req: AuthRequest, res: Response) => {
  try {
    const jobTypes = await prisma.jobType.findMany({
      where: { status: true },
      orderBy: { name: 'asc' },
    })

    res.json(jobTypes)
  } catch (error: any) {
    logger.error('Error fetching job types:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب صفات الموظفين' })
  }
})

// GET /api/school/job-types/:jobTypeId/kpis/weights - Get KPI weights for job type
router.get('/job-types/:jobTypeId/kpis/weights', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { jobTypeId } = req.params

    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // جلب جميع المعايير (رسمية + خاصة) لصفة معينة
    const officialKPIs = await prisma.kPI.findMany({
      where: {
        jobTypeId,
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

    const schoolKPIs = await prisma.kPI.findMany({
      where: {
        jobTypeId,
        schoolId: user.schoolId,
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

    // جلب الأوزان المخصصة من SchoolJobTypeKPI
    let schoolJobTypeKPIs: Array<{ kpiId: string; weight: number; isActive: boolean }> = []
    try {
      schoolJobTypeKPIs = await prisma.schoolJobTypeKPI.findMany({
        where: {
          schoolId: user.schoolId,
          jobTypeId,
        },
        select: {
          kpiId: true,
          weight: true,
          isActive: true,
        },
      })
    } catch (error: any) {
      // إذا كان الجدول غير موجود، استخدم الأوزان الافتراضية
      logger.warn('SchoolJobTypeKPI table not found, using default weights')
    }

    // إنشاء map للأوزان المخصصة
    const customWeightsMap = new Map(
      schoolJobTypeKPIs.map((sjk) => [sjk.kpiId, { weight: sjk.weight, isActive: sjk.isActive }])
    )

    // إنشاء set للمعايير الرسمية للتحقق السريع
    const officialKPIsSet = new Set(officialKPIs.map((k) => k.id))

    // دمج البيانات
    const kpisWithWeights = allKPIs.map((kpi) => {
      const custom = customWeightsMap.get(kpi.id)
      return {
        kpiId: kpi.id,
        name: kpi.name,
        weight: custom?.weight ?? kpi.weight,
        isActive: custom?.isActive ?? true,
        isOfficial: officialKPIsSet.has(kpi.id),
      }
    })

    // حساب مجموع الأوزان للمعايير النشطة
    const totalWeight = kpisWithWeights
      .filter((k) => k.isActive)
      .reduce((sum, k) => sum + k.weight, 0)

    res.json({
      kpis: kpisWithWeights,
      totalWeight,
      isValid: Math.abs(totalWeight - 100) < 0.01, // السماح بخطأ صغير بسبب Float
    })
  } catch (error: any) {
    logger.error('Error fetching weights:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب الأوزان' })
  }
})

// PUT /api/school/job-types/:jobTypeId/kpis/weights - Update KPI weights
router.put('/job-types/:jobTypeId/kpis/weights', (req: AuthRequest, res: Response, next: any) => {
  // Debug middleware - log raw body before any processing
  console.log('🔍 DEBUG Middleware - Raw body check:', {
    method: req.method,
    path: req.path,
    body: req.body,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body || {}),
    hasWeights: 'weights' in (req.body || {}),
    weights: req.body?.weights,
    weightsType: typeof req.body?.weights,
    weightsIsArray: Array.isArray(req.body?.weights),
    contentType: req.headers['content-type'],
    rawBodyString: JSON.stringify(req.body),
  })
  next()
}, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { jobTypeId } = req.params
    // Don't destructure weights yet - we'll validate it first
    const body = req.body || {}

    // Debug logging - BEFORE any processing
    console.log('📥 Backend - Received request (BEFORE processing):', {
      jobTypeId,
      body: req.body,
      bodyType: typeof req.body,
      bodyIsNull: req.body === null,
      bodyIsUndefined: req.body === undefined,
      bodyKeys: Object.keys(req.body || {}),
      bodyStringified: JSON.stringify(req.body),
      contentType: req.headers['content-type'],
      hasWeights: 'weights' in (req.body || {}),
      weights: req.body?.weights,
      weightsType: typeof req.body?.weights,
      weightsIsArray: Array.isArray(req.body?.weights),
      weightsLength: req.body?.weights?.length,
    })
    
    logger.debug('📥 Backend - Received request:', {
      jobTypeId,
      body: req.body,
      bodyType: typeof req.body,
      weights: body.weights,
      weightsType: typeof body.weights,
      weightsIsArray: Array.isArray(body.weights),
      weightsLength: body.weights?.length,
      bodyKeys: Object.keys(req.body || {}),
    })
    
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // Log raw body for debugging
    console.log('📥 Backend - Raw request:', {
      method: req.method,
      url: req.url,
      contentType: req.headers['content-type'],
      body: req.body,
      bodyType: typeof req.body,
      bodyIsNull: req.body === null,
      bodyIsUndefined: req.body === undefined,
      bodyKeys: Object.keys(req.body || {}),
      weights: body.weights,
      weightsType: typeof body.weights,
      weightsIsArray: Array.isArray(body.weights),
    })
    
    // Check if body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ Backend - req.body is empty!')
      return res.status(400).json({ error: 'يجب إرسال بيانات في body الطلب' })
    }
    
    // Handle different possible body structures
    let weightsArray: any[] | null = null
    
    // Case 1: weights is directly in body as an array
    if (Array.isArray(req.body.weights)) {
      weightsArray = req.body.weights
      console.log('✅ Backend - weights is already an array:', weightsArray?.length)
    }
    // Case 2: weights is an object (common issue - express.json() converts arrays to objects)
    // Convert it to an array
    else if (req.body.weights && typeof req.body.weights === 'object') {
      console.log('🔧 Backend - Entering object conversion block')
      const weightsObj = req.body.weights
      const keys = Object.keys(weightsObj)
      
      console.log('🔧 Backend - Converting weights object to array:', {
        keys: keys,
        keysCount: keys.length,
        firstKey: keys[0],
        firstKeyType: typeof keys[0],
        weightsObj: weightsObj,
      })
      
      // ALWAYS convert object to array - don't check if keys are numeric
      // Just sort all keys and convert to array
      const sortedKeys = keys.sort((a, b) => {
        const numA = parseInt(a, 10)
        const numB = parseInt(b, 10)
        // If both are numeric, sort numerically
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB
        }
        // Otherwise keep original order
        return 0
      })
      
      // Convert to array
      weightsArray = sortedKeys.map(key => weightsObj[key]).filter(item => item !== null && item !== undefined)
      
      console.log('✅ Backend - Successfully converted object to array:', {
        originalKeys: keys,
        sortedKeys: sortedKeys,
        arrayLength: weightsArray?.length,
        firstItem: weightsArray?.[0],
      })
    }
    // Case 3: body itself is the array (shouldn't happen but handle it)
    else if (Array.isArray(req.body)) {
      weightsArray = req.body
      console.log('✅ Backend - body is array:', weightsArray?.length)
    }
    // Case 4: weights might be nested
    else if (req.body.data && Array.isArray(req.body.data.weights)) {
      weightsArray = req.body.data.weights
      console.log('✅ Backend - weights in data:', weightsArray?.length)
    }
    // Case 5: weights doesn't exist or is invalid
    else {
      console.error('❌ Backend - weights is invalid:', {
        weights: req.body.weights,
        weightsType: typeof req.body.weights,
        weightsIsArray: Array.isArray(req.body.weights),
        weightsIsObject: typeof req.body.weights === 'object',
        bodyKeys: Object.keys(req.body || {}),
      })
      return res.status(400).json({ 
        error: 'يجب إرسال مصفوفة من الأوزان',
        received: typeof req.body.weights,
        bodyKeys: Object.keys(req.body || {}),
      })
    }
    
    // If we still don't have a valid array, return error
    if (!weightsArray || !Array.isArray(weightsArray)) {
      logger.error('❌ Backend - weights is not an array:', {
        weights: body.weights,
        weightsType: typeof body.weights,
        body: req.body,
        bodyKeys: Object.keys(req.body || {}),
        bodyString: JSON.stringify(req.body),
      })
      console.error('❌ Backend - Full error details:', {
        weights: body.weights,
        weightsType: typeof body.weights,
        body: req.body,
        bodyKeys: Object.keys(req.body || {}),
        bodyString: JSON.stringify(req.body),
      })
      return res.status(400).json({ 
        error: 'يجب إرسال مصفوفة من الأوزان',
        received: typeof req.body.weights,
        bodyKeys: Object.keys(req.body || {}),
        debug: {
          bodyType: typeof req.body,
          bodyIsArray: Array.isArray(req.body),
          hasWeights: 'weights' in (req.body || {}),
          weightsType: typeof req.body.weights,
        }
      })
    }
    
    // Use the validated weights array
    const validatedWeights = weightsArray

    // التحقق من أن مجموع الأوزان للمعايير النشطة = 100%
    // ملاحظة: نسمح بالتعطيل حتى لو كان المجموع أقل من 100%، لكن نمنع التفعيل إذا كان المجموع سيتجاوز 100%
    const activeWeights = validatedWeights.filter((w: any) => w.isActive !== false)
    const totalWeight = activeWeights.reduce(
      (sum: number, w: any) => sum + (w.weight || 0),
      0
    )

    logger.debug('📊 Backend - حساب مجموع الأوزان:', {
      totalKPIs: validatedWeights.length,
      activeKPIs: activeWeights.length,
      totalWeight: totalWeight.toFixed(2),
      activeWeightsDetails: activeWeights.map((w: any) => ({
        kpiId: w.kpiId,
        weight: w.weight,
        isActive: w.isActive
      }))
    })

    // السماح بالتعطيل (المجموع أقل من 100%)، لكن نمنع إذا كان المجموع يتجاوز 100%
    // نمنع فقط إذا كان المجموع يتجاوز 100% (لأن هذا يعني أن هناك خطأ في الحساب)
    // نسمح بالحفظ حتى لو كان المجموع أقل من 100% (لأن هذا يعني أن هناك معايير معطلة)
    if (totalWeight > 100.01) {
      return res.status(400).json({
        error: `مجموع أوزان المعايير النشطة يتجاوز 100%. المجموع الحالي: ${totalWeight.toFixed(2)}%`,
        totalWeight,
      })
    }
    
    // السماح بالحفظ حتى لو كان المجموع أقل من 100% (لأن هذا يعني أن هناك معايير معطلة)
    // لا نرفض الطلب إذا كان المجموع أقل من 100% - هذا طبيعي عند تعطيل معايير
    // التحقق الكامل من 100% يتم في صفحة إدارة الأوزان فقط

    // التحقق من صحة البيانات
    for (const weightData of validatedWeights) {
      if (!weightData.kpiId) {
        return res.status(400).json({ error: 'يجب تحديد kpiId لكل معيار' })
      }
      if (weightData.weight < 0 || weightData.weight > 100) {
        return res.status(400).json({ error: `الوزن يجب أن يكون بين 0 و 100 للمعيار ${weightData.kpiId}` })
      }
    }

    // استخدام transaction لحفظ جميع التغييرات
    let result
    try {
      result = await prisma.$transaction(async (tx) => {
        // حذف الأوزان القديمة لهذه الصفة
        await tx.schoolJobTypeKPI.deleteMany({
          where: {
            schoolId: user.schoolId,
            jobTypeId,
          },
        })

        // إضافة الأوزان الجديدة
        if (!user.schoolId) {
          throw new Error('المدرسة غير محددة')
        }
        const created = await Promise.all(
          validatedWeights.map((w: any) =>
            tx.schoolJobTypeKPI.create({
              data: {
                schoolId: user.schoolId!,
                jobTypeId,
                kpiId: w.kpiId,
                weight: w.weight,
                isActive: w.isActive !== false,
              },
            })
          )
        )

        return created
      })
    } catch (error: any) {
      if (error.code === 'P2021') {
        return res.status(500).json({
          error: 'جدول الأوزان غير موجود في قاعدة البيانات. يرجى تشغيل: npm run db:push',
        })
      }
      throw error
    }

    res.json({
      message: 'تم حفظ الأوزان بنجاح',
      weights: result,
    })
  } catch (error: any) {
    if (error.code === 'P2021') {
      return res.status(500).json({
        error: 'جدول الأوزان غير موجود في قاعدة البيانات. يرجى تشغيل: npm run db:push',
      })
    }
    logger.error('Error updating weights:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في حفظ الأوزان' })
  }
})

// GET /api/school/job-types/:jobTypeId/kpis/weights/validate - Validate weights
router.get('/job-types/:jobTypeId/kpis/weights/validate', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { jobTypeId } = req.params

    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    let schoolJobTypeKPIs: Array<{ weight: number; isActive: boolean }> = []
    try {
      schoolJobTypeKPIs = await prisma.schoolJobTypeKPI.findMany({
        where: {
          schoolId: user.schoolId,
          jobTypeId,
        },
        select: {
          weight: true,
          isActive: true,
        },
      })
    } catch (error: any) {
      if (error.code === 'P2021') {
        return res.json({ isValid: false, totalWeight: 0, error: 'جدول الأوزان غير موجود' })
      }
      throw error
    }

    let totalWeight = 0
    
    // إذا كانت هناك أوزان مخصصة في SchoolJobTypeKPI، استخدمها
    if (schoolJobTypeKPIs.length > 0) {
      totalWeight = schoolJobTypeKPIs
      .filter((sjk) => sjk.isActive)
      .reduce((sum, sjk) => sum + sjk.weight, 0)
    } else {
      // إذا لم تكن هناك أوزان مخصصة، احسب من المعايير الرسمية
      const officialKPIs = await prisma.kPI.findMany({
        where: {
          jobTypeId,
          isOfficial: true,
          schoolId: null,
        },
        select: {
          weight: true,
        },
      })
      
      totalWeight = officialKPIs.reduce((sum, kpi) => sum + kpi.weight, 0)
    }

    res.json({
      isValid: Math.abs(totalWeight - 100) < 0.01,
      totalWeight,
    })
  } catch (error: any) {
    logger.error('Error validating weights:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في التحقق من الأوزان' })
  }
})

// ==================== Reports ====================

// GET /api/school/reports - Get reports
router.get('/reports', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    if (!user.schoolId) {
      return res.status(400).json({ error: 'المدرسة غير محددة' })
    }

    // Get all submissions for school
    const submissions = await prisma.evidenceSubmission.findMany({
      where: {
        teacher: {
          schoolId: user.schoolId,
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
          },
        },
        kpi: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Calculate statistics
    const totalSubmissions = submissions.length
    const acceptedCount = submissions.filter(s => s.status === SubmissionStatus.ACCEPTED).length
    const rejectedCount = submissions.filter(s => s.status === SubmissionStatus.REJECTED).length
    const pendingCount = submissions.filter(s => s.status === SubmissionStatus.PENDING).length

    // Average rating per teacher
    const teacherStats = await prisma.user.findMany({
      where: {
        schoolId: user.schoolId,
        role: UserRole.TEACHER,
      },
      include: {
        submissions: {
          where: {
            status: SubmissionStatus.ACCEPTED,
            rating: { not: null },
          },
        },
      },
    })

    const teacherAverages = teacherStats.map(teacher => {
      const ratings = teacher.submissions
        .map(s => s.rating)
        .filter((r): r is number => r !== null)
      
      const average = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0

      return {
        teacherId: teacher.id,
        teacherName: teacher.name,
        averageRating: Math.round(average * 10) / 10,
        totalSubmissions: teacher.submissions.length,
      }
    })

    // Activity by KPI
    const kpiActivity = submissions.reduce((acc, submission) => {
      const kpiName = submission.kpi.name
      if (!acc[kpiName]) {
        acc[kpiName] = {
          kpiName,
          total: 0,
          accepted: 0,
          rejected: 0,
          pending: 0,
        }
      }
      acc[kpiName].total++
      if (submission.status === SubmissionStatus.ACCEPTED) acc[kpiName].accepted++
      if (submission.status === SubmissionStatus.REJECTED) acc[kpiName].rejected++
      if (submission.status === SubmissionStatus.PENDING) acc[kpiName].pending++
      return acc
    }, {} as Record<string, { kpiName: string; total: number; accepted: number; rejected: number; pending: number }>)

    res.json({
      summary: {
        total: totalSubmissions,
        accepted: acceptedCount,
        rejected: rejectedCount,
        pending: pendingCount,
      },
      teacherAverages,
      kpiActivity: Object.values(kpiActivity),
    })
  } catch (error: any) {
    logger.error('Error fetching reports:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب التقارير' })
  }
})

export default router

