import { prisma } from './db'
import { NotificationType } from '@prisma/client'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
}

/**
 * إنشاء تنبيه جديد
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
      },
    })
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

/**
 * إنشاء تنبيهات لجميع مديري المدرسة عند رفع شاهد جديد
 */
export async function notifySchoolManagersOnEvidenceSubmission(
  schoolId: string,
  teacherName: string,
  kpiName: string,
  evidenceName: string,
  submissionId: string
) {
  try {
    const managers = await prisma.user.findMany({
      where: {
        schoolId,
        role: 'SCHOOL_MANAGER',
        status: true,
      },
    })

    const notifications = managers.map((manager) =>
      createNotification({
        userId: manager.id,
        type: NotificationType.EVIDENCE_SUBMITTED,
        title: 'شاهد جديد مرفوع',
        message: `${teacherName} رفع شاهد جديد: ${evidenceName} للمعيار ${kpiName}`,
        link: `/school/review`,
      })
    )

    await Promise.all(notifications)
  } catch (error) {
    console.error('Error notifying school managers:', error)
  }
}

/**
 * إشعار المعلم عند قبول/رفض شاهد
 */
export async function notifyTeacherOnEvidenceReview(
  teacherId: string,
  action: 'accepted' | 'rejected',
  kpiName: string,
  evidenceName: string,
  rating?: number,
  rejectReason?: string
) {
  try {
    const type =
      action === 'accepted'
        ? NotificationType.EVIDENCE_ACCEPTED
        : NotificationType.EVIDENCE_REJECTED

    const title =
      action === 'accepted' ? 'تم قبول الشاهد' : 'تم رفض الشاهد'

    const message =
      action === 'accepted'
        ? `تم قبول شاهد "${evidenceName}" للمعيار "${kpiName}" بتقييم ${rating}/5`
        : `تم رفض شاهد "${evidenceName}" للمعيار "${kpiName}". السبب: ${rejectReason}`

    await createNotification({
      userId: teacherId,
      type,
      title,
      message,
      link: '/teacher/submissions',
    })
  } catch (error) {
    console.error('Error notifying teacher:', error)
  }
}

/**
 * إشعار مدير المدرسة عند إضافة معلم جديد
 */
export async function notifySchoolManagerOnTeacherAdded(
  schoolId: string,
  teacherName: string
) {
  try {
    const managers = await prisma.user.findMany({
      where: {
        schoolId,
        role: 'SCHOOL_MANAGER',
        status: true,
      },
    })

    const notifications = managers.map((manager) =>
      createNotification({
        userId: manager.id,
        type: NotificationType.TEACHER_ADDED,
        title: 'معلم جديد',
        message: `تم إضافة المعلم "${teacherName}" إلى المدرسة`,
        link: '/school/teachers',
      })
    )

    await Promise.all(notifications)
  } catch (error) {
    console.error('Error notifying school managers:', error)
  }
}

/**
 * إشعار مدير المدرسة عند إضافة معيار جديد
 */
export async function notifySchoolManagerOnKPIAdded(
  schoolId: string,
  kpiName: string
) {
  try {
    const managers = await prisma.user.findMany({
      where: {
        schoolId,
        role: 'SCHOOL_MANAGER',
        status: true,
      },
    })

    const notifications = managers.map((manager) =>
      createNotification({
        userId: manager.id,
        type: NotificationType.KPI_ADDED,
        title: 'معيار جديد',
        message: `تم إضافة المعيار "${kpiName}"`,
        link: '/school/kpis',
      })
    )

    await Promise.all(notifications)
  } catch (error) {
    console.error('Error notifying school managers:', error)
  }
}

