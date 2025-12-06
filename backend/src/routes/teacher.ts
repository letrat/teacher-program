import { Router, Response } from 'express'
import { z } from 'zod'
import { AuthRequest, authenticate, requireTeacher } from '../middleware/auth'
import { csrfProtection } from '../middleware/csrf'
import { verifyTeacherOwnership, verifyResourceId } from '../middleware/resourceOwnership'
import { validate } from '../middleware/validation'
import { sanitize } from '../middleware/validation'
import { submitEvidenceSchema } from '../schemas/teacher'
import { uuidSchema } from '../schemas/common'
import { prisma } from '../lib/db'
import { SubmissionStatus } from '@prisma/client'
import { notifySchoolManagersOnEvidenceSubmission } from '../lib/notifications'
import { calculateOverallScore } from '../lib/calculations'
import { parsePagination, createPaginationResponse } from '../middleware/pagination'
import { apiLimiter } from '../middleware/rateLimit'
import logger from '../lib/logger'

const router = Router()

// Apply authentication and security middleware to all teacher routes
router.use(authenticate)
router.use(requireTeacher)
router.use(verifyTeacherOwnership) // IDOR protection
router.use(verifyResourceId) // Validate UUID format
router.use(sanitize) // XSS protection
router.use(csrfProtection) // CSRF protection for state-changing methods
router.use(apiLimiter)

// ==================== Dashboard ====================

// GET /api/teacher/dashboard - Get teacher dashboard data
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!

    // جلب بيانات المعلم من قاعدة البيانات
    const teacher = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        jobTypeId: true,
        schoolId: true,
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!teacher || !teacher.jobTypeId || !teacher.schoolId) {
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
          score: kpiScore.score,
          approvedEvidenceCount: approvedCount,
          pendingEvidenceCount: pendingCount,
          rejectedEvidenceCount: rejectedCount,
        }
      })
    )

    // جلب إحصائيات الشواهد
    const [pendingCount, acceptedCount, rejectedCount] = await Promise.all([
      prisma.evidenceSubmission.count({
        where: {
          teacherId: teacher.id,
          status: SubmissionStatus.PENDING,
        },
      }),
      prisma.evidenceSubmission.count({
        where: {
          teacherId: teacher.id,
          status: SubmissionStatus.ACCEPTED,
        },
      }),
      prisma.evidenceSubmission.count({
        where: {
          teacherId: teacher.id,
          status: SubmissionStatus.REJECTED,
        },
      }),
    ])

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
      logger.warn('Failed to fetch weights info for teacher dashboard:', error.message)
    }

    res.json({
      stats: {
        pending: pendingCount,
        accepted: acceptedCount,
        rejected: rejectedCount,
      },
      overallScore: {
        score: Math.round(overallScore * 100) / 100,
        percentage: Math.round(overallPercentage * 100) / 100,
      },
      kpiScores: kpisDetails.map((k) => ({
        kpiName: k.name,
        score: Math.round(k.score * 100) / 100,
        weight: k.weight,
      })),
      weightsInfo,
    })
  } catch (error: any) {
    logger.error('Dashboard error:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب بيانات Dashboard' })
  }
})

// ==================== Job Types ====================

// GET /api/teacher/job-types - Get teacher's job type
router.get('/job-types', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!

    // Get teacher's job type from database (not from session, as it might not be updated)
    const teacherUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { jobTypeId: true },
    })

    if (!teacherUser?.jobTypeId) {
      return res.json([])
    }

    const jobType = await prisma.jobType.findUnique({
      where: { id: teacherUser.jobTypeId },
    })

    res.json(jobType ? [jobType] : [])
  } catch (error: any) {
    logger.error('Error in job-types API:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب صفة الموظف' })
  }
})

// ==================== KPIs ====================

// GET /api/teacher/kpis - Get KPIs for teacher
router.get('/kpis', validate({ 
  query: z.object({ 
    jobTypeId: uuidSchema.optional() 
  }).optional() 
}), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const jobTypeId = req.query.jobTypeId as string | undefined

    let teacherJobTypeId = jobTypeId

    // If jobTypeId not provided, get from user's account
    if (!teacherJobTypeId) {
      const teacherUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { jobTypeId: true, schoolId: true },
      })
      teacherJobTypeId = teacherUser?.jobTypeId || undefined
    }

    if (!teacherJobTypeId) {
      return res.status(400).json({ error: 'لم يتم تحديد صفة الموظف' })
    }

    // Get user's schoolId from database (do it once)
    const teacherUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { schoolId: true },
    })

    const schoolId = teacherUser?.schoolId || user.schoolId

    // Get official KPIs (from admin, no schoolId)
    const officialKPIs = await prisma.kPI.findMany({
      where: {
        jobTypeId: teacherJobTypeId,
        isOfficial: true,
        schoolId: null,
      },
      orderBy: { name: 'asc' },
    })

    // Get school-specific KPIs (if schoolId exists)
    let schoolKPIs: any[] = []
    if (schoolId) {
      schoolKPIs = await prisma.kPI.findMany({
        where: {
          jobTypeId: teacherJobTypeId,
          schoolId: schoolId,
          isOfficial: false,
        },
        orderBy: { name: 'asc' },
      })
    }

    const allKPIs = [...officialKPIs, ...schoolKPIs]

    // جلب الأوزان المخصصة من SchoolJobTypeKPI (فقط إذا كان schoolId موجود)
    let customWeightsMap = new Map<string, number>()
    if (schoolId) {
      try {
        const schoolJobTypeKPIs = await prisma.schoolJobTypeKPI.findMany({
          where: {
            schoolId: schoolId,
            jobTypeId: teacherJobTypeId,
            isActive: true,
          },
          select: {
            kpiId: true,
            weight: true,
          },
        })

        // إنشاء map للأوزان المخصصة
        customWeightsMap = new Map(
          schoolJobTypeKPIs.map((sjk) => [sjk.kpiId, sjk.weight])
        )
      } catch (error: any) {
        // إذا كان الجدول غير موجود (P2021)، استخدم الأوزان الافتراضية
        if (error.code === 'P2021') {
          console.warn('SchoolJobTypeKPI table not found, using default weights')
        } else {
          logger.error('Error fetching custom weights:', error)
        }
        // Continue with default weights if custom weights fetch fails
      }
    }

    // دمج البيانات مع الأوزان المخصصة
    const kpisWithWeights = allKPIs.map((kpi) => ({
      ...kpi,
      weight: customWeightsMap.get(kpi.id) ?? kpi.weight,
    }))

    logger.debug(`Found ${kpisWithWeights.length} KPIs for jobTypeId: ${teacherJobTypeId}, schoolId: ${schoolId}`)
    logger.debug(`Official: ${officialKPIs.length}, School: ${schoolKPIs.length}`)

    res.json(kpisWithWeights)
  } catch (error: any) {
    logger.error('Error fetching KPIs:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب المعايير' })
  }
})

// ==================== Evidence ====================

// GET /api/teacher/evidence - Get evidence items for a KPI
router.get('/evidence', validate({ 
  query: z.object({ 
    kpiId: uuidSchema 
  }) 
}), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const kpiId = req.query.kpiId as string

    // Get user's schoolId from database
    const teacherUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { schoolId: true },
    })

    const schoolId = teacherUser?.schoolId || user.schoolId

    // Get evidence items (official + school-specific)
    const evidenceItems = await prisma.evidenceItem.findMany({
      where: {
        kpiId,
        OR: [
          { isOfficial: true, schoolId: null }, // Official evidence
          ...(schoolId ? [{ schoolId, isOfficial: false }] : []), // School-specific evidence
        ],
      },
      orderBy: { name: 'asc' },
    })

    res.json(evidenceItems)
  } catch (error: any) {
    logger.error('Error fetching evidence items:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب الشواهد' })
  }
})

// POST /api/teacher/evidence/submit - Submit evidence
router.post('/evidence/submit', validate({ body: submitEvidenceSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!
    const { kpiId, evidenceId, fileUrl, description } = req.body

    // Get user's jobTypeId and schoolId from database
    const teacherUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { jobTypeId: true, schoolId: true },
    })

    if (!teacherUser?.jobTypeId) {
      return res.status(400).json({ error: 'لم يتم تحديد صفة الموظف' })
    }

    // Verify KPI and Evidence belong to teacher's job type and school
    const kpi = await prisma.kPI.findFirst({
      where: {
        id: kpiId,
        jobTypeId: teacherUser.jobTypeId,
        OR: [
          { isOfficial: true, schoolId: null },
          { schoolId: teacherUser.schoolId, isOfficial: false },
        ],
      },
    })

    if (!kpi) {
      return res.status(404).json({ error: 'المعيار غير موجود' })
    }

    const evidence = await prisma.evidenceItem.findFirst({
      where: {
        id: evidenceId,
        kpiId,
        OR: [
          { isOfficial: true, schoolId: null },
          { schoolId: teacherUser.schoolId, isOfficial: false },
        ],
      },
    })

    if (!evidence) {
      return res.status(404).json({ error: 'الشاهد غير موجود' })
    }

    const submission = await prisma.evidenceSubmission.create({
      data: {
        teacherId: user.id,
        kpiId,
        evidenceId,
        fileUrl,
        description: description || null,
        status: SubmissionStatus.PENDING,
      },
      include: {
        teacher: {
          select: { name: true, schoolId: true },
        },
        kpi: {
          select: { name: true },
        },
        evidence: {
          select: { name: true },
        },
      },
    })

    // إشعار مديري المدرسة
    if (submission.teacher.schoolId) {
      await notifySchoolManagersOnEvidenceSubmission(
        submission.teacher.schoolId,
        submission.teacher.name,
        submission.kpi.name,
        submission.evidence.name,
        submission.id
      )
    }

    res.status(201).json(submission)
  } catch (error: any) {
    logger.error('Error submitting evidence:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في رفع الشاهد' })
  }
})

// ==================== Submissions ====================

// GET /api/teacher/submissions - Get teacher's submissions with pagination
router.get('/submissions', async (req: AuthRequest, res: Response) => {
  const user = req.user!
  try {
    const { page, limit, skip } = parsePagination(req)

    const [submissions, total] = await Promise.all([
      prisma.evidenceSubmission.findMany({
        where: {
          teacherId: user.id,
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
        skip,
        take: limit,
      }),
      prisma.evidenceSubmission.count({
        where: {
          teacherId: user.id,
        },
      }),
    ])

    res.json(createPaginationResponse(submissions, total, page, limit))
  } catch (error: any) {
    logger.error('Error fetching submissions:', { error: error.message, stack: error.stack, userId: user.id })
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب الطلبات' })
  }
})

// ==================== Progress ====================

// GET /api/teacher/progress - Get teacher's KPI progress
router.get('/progress', async (req: AuthRequest, res: Response) => {
  try {
    logger.debug('📥 GET /api/teacher/progress - Request received')
    const user = req.user!

    // جلب بيانات المعلم من قاعدة البيانات
    const teacher = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        jobTypeId: true,
        schoolId: true,
        jobType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!teacher || !teacher.jobTypeId || !teacher.schoolId) {
      return res.status(400).json({ error: 'بيانات المعلم غير مكتملة' })
    }

    // حساب الدرجة النهائية للحصول على kpiScores مع minRequired و isAchieved
    const { kpiScores } = await calculateOverallScore(
      teacher.id,
      teacher.jobTypeId,
      teacher.schoolId
    )

    // جلب تفاصيل كل معيار مع عدد الشواهد
    const kpisProgress = await Promise.all(
      kpiScores.map(async (kpiScore) => {
        // جلب معلومات المعيار
        // ملاحظة: إذا كان العمود minAcceptedEvidence غير موجود، سيتم استخدام 1 كقيمة افتراضية
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

        // استخدام القيمة الفعلية من قاعدة البيانات
        const minRequired = kpi?.minAcceptedEvidence ?? kpiScore.minRequired ?? null
        const remainingCount = minRequired !== null ? Math.max(0, minRequired - approvedCount) : 0

        return {
          kpiId: kpiScore.kpiId,
          name: kpi?.name || kpiScore.kpiName,
          weight: kpiScore.weight,
          score: Math.round(kpiScore.score * 100) / 100,
          minAcceptedEvidence: minRequired,
          acceptedCount: approvedCount,
          pendingCount: pendingCount,
          rejectedCount: rejectedCount,
          remainingCount: remainingCount,
          isAchieved: kpiScore.isAchieved,
        }
      })
    )

    res.json({
      kpis: kpisProgress,
    })
  } catch (error: any) {
    logger.error('Progress API error:', error)
    res.status(500).json({ error: error.message || 'حدث خطأ في جلب بيانات التقدّم' })
  }
})

export default router

