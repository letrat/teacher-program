import { prisma } from './db'
import { SubmissionStatus } from '@prisma/client'

/**
 * حساب درجة معيار محدد للمعلم مع معلومات الحد الأدنى
 * @param teacherId - معرف المعلم
 * @param kpiId - معرف المعيار
 * @returns معلومات المعيار: الدرجة، عدد الشواهد المقبولة، الحد الأدنى المطلوب، حالة المعيار
 */
export async function calculateKPIScore(
  teacherId: string,
  kpiId: string
): Promise<{
  score: number
  acceptedCount: number
  minRequired: number | null
  isAchieved: boolean
}> {
  // جلب المعيار للحصول على الحد الأدنى المطلوب
  const kpi = await prisma.kPI.findUnique({
    where: { id: kpiId },
    select: {
      id: true,
      minAcceptedEvidence: true,
    },
  })

  // استخدام القيمة الفعلية من قاعدة البيانات (null إذا لم يتم تحديدها)
  const minRequired = kpi?.minAcceptedEvidence ?? null

  // جلب جميع الشواهد المقبولة فقط
  const acceptedSubmissions = await prisma.evidenceSubmission.findMany({
    where: {
      teacherId,
      kpiId,
      status: SubmissionStatus.ACCEPTED,
      rating: {
        not: null,
      },
    },
    select: {
      rating: true,
    },
  })

  const acceptedCount = acceptedSubmissions.length

  // حساب المتوسط
  let score = 0
  if (acceptedCount > 0) {
    const totalRating = acceptedSubmissions.reduce(
      (sum, submission) => sum + (submission.rating || 0),
      0
    )
    score = totalRating / acceptedCount
    // التأكد من أن النتيجة بين 0 و 5
    score = Math.max(0, Math.min(5, score))
  }

  // تحديد حالة المعيار (متحقق/غير محقق)
  // يجب أن يكون عدد الشواهد المقبولة >= الحد الأدنى (إذا كان محدداً)
  const isAchieved = minRequired === null ? true : acceptedCount >= minRequired

  return {
    score,
    acceptedCount,
    minRequired,
    isAchieved,
  }
}

/**
 * حساب الدرجة النهائية للمعلم
 * @param teacherId - معرف المعلم
 * @param jobTypeId - معرف الصفة الوظيفية
 * @param schoolId - معرف المدرسة
 * @returns { overallScore: number, overallPercentage: number, kpiScores: Array }
 */
export async function calculateOverallScore(
  teacherId: string,
  jobTypeId: string,
  schoolId: string
): Promise<{
  overallScore: number
  overallPercentage: number
  kpiScores: Array<{
    kpiId: string
    kpiName: string
    weight: number
    score: number
    acceptedCount: number
    minRequired: number | null
    isAchieved: boolean
  }>
}> {
  // جلب جميع المعايير (رسمية + خاصة) لصفة معينة
  // ملاحظة: إذا كان العمود minAcceptedEvidence غير موجود، سيتم استخدام 1 كقيمة افتراضية
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
      minAcceptedEvidence: true,
    },
  })

  const schoolKPIs = await prisma.kPI.findMany({
    where: {
      jobTypeId,
      schoolId,
      isOfficial: false,
    },
    select: {
      id: true,
      name: true,
      weight: true,
      minAcceptedEvidence: true,
    },
  })

  const allKPIs = [...officialKPIs, ...schoolKPIs]

  // جلب الأوزان المخصصة من SchoolJobTypeKPI
  let schoolJobTypeKPIs: Array<{ kpiId: string; weight: number; isActive: boolean }> = []
  try {
    schoolJobTypeKPIs = await prisma.schoolJobTypeKPI.findMany({
      where: {
        schoolId,
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
    console.warn('SchoolJobTypeKPI table not found, using default weights:', error.message)
  }

  // إنشاء map للأوزان المخصصة
  const customWeightsMap = new Map(
    schoolJobTypeKPIs.map((sjk) => [sjk.kpiId, { weight: sjk.weight, isActive: sjk.isActive }])
  )

  // استخدام الأوزان المخصصة إذا كانت موجودة، وإلا استخدام الأوزان الافتراضية
  // فقط المعايير النشطة (isActive = true) تدخل في الحساب
  const activeKPIs = allKPIs
    .filter((kpi) => {
      const custom = customWeightsMap.get(kpi.id)
      // إذا كان هناك وزن مخصص، استخدم isActive منه
      // إذا لم يكن هناك وزن مخصص، اعتبر المعيار نشط
      return custom ? custom.isActive : true
    })
    .map((kpi) => {
      const custom = customWeightsMap.get(kpi.id)
      return {
        kpiId: kpi.id,
        kpiName: kpi.name,
        weight: custom?.weight ?? kpi.weight,
      }
    })

  // حساب درجة كل معيار
  const kpiScores = await Promise.all(
    activeKPIs.map(async (kpi) => {
      const kpiData = allKPIs.find((k) => k.id === kpi.kpiId)
      const kpiScoreData = await calculateKPIScore(teacherId, kpi.kpiId)
      // استخدام القيمة الفعلية من قاعدة البيانات
      const minRequired = kpiScoreData.minRequired ?? kpiData?.minAcceptedEvidence ?? null
      return {
        kpiId: kpi.kpiId,
        kpiName: kpi.kpiName,
        weight: kpi.weight,
        score: kpiScoreData.score,
        acceptedCount: kpiScoreData.acceptedCount,
        minRequired: minRequired,
        isAchieved: kpiScoreData.isAchieved,
      }
    })
  )

  // حساب الدرجة النهائية: Σ (kpiScore × (weight / 100))
  const overallScore = kpiScores.reduce((sum, kpi) => {
    return sum + kpi.score * (kpi.weight / 100)
  }, 0)

  // تحويل إلى نسبة مئوية
  const overallPercentage = (overallScore / 5) * 100

  return {
    overallScore: Math.max(0, Math.min(5, overallScore)),
    overallPercentage: Math.max(0, Math.min(100, overallPercentage)),
    kpiScores,
  }
}

