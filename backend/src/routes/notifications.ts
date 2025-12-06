import { Router, Response } from 'express'
import { prisma } from '../lib/db'
import { AuthRequest, authenticate } from '../middleware/auth'
import logger from '../lib/logger'

const router = Router()

// All routes require authentication
router.use(authenticate)

// GET - جلب التنبيهات للمستخدم الحالي
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true'
    const limit = parseInt(req.query.limit as string || '50')

    const where: any = {
      userId: req.user!.id,
    }

    if (unreadOnly) {
      where.read = false
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user!.id,
        read: false,
      },
    })

    res.json({
      notifications,
      unreadCount,
    })
  } catch (error: any) {
    logger.error('Error fetching notifications:', { error: error.message, stack: error.stack, userId: req.user!.id })
    // If table doesn't exist (P2021), return empty
    if (error.code === 'P2021') {
      return res.json({
        notifications: [],
        unreadCount: 0,
      })
    }
    res.status(500).json({ error: 'حدث خطأ في جلب التنبيهات' })
  }
})

// PUT - تحديد التنبيه كمقروء
router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const notification = await prisma.notification.update({
      where: {
        id: req.params.id,
        userId: req.user!.id, // التأكد من أن التنبيه يخص المستخدم
      },
      data: {
        read: true,
      },
    })

    res.json(notification)
  } catch (error: any) {
    logger.error('Error marking notification as read:', { error: error.message, stack: error.stack, notificationId: req.params.id, userId: req.user!.id })
    res.status(500).json({ error: 'حدث خطأ في تحديث التنبيه' })
  }
})

// PUT - تحديد جميع التنبيهات كمقروءة
router.put('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        read: false,
      },
      data: {
        read: true,
      },
    })

    res.json({ message: 'تم تحديد جميع التنبيهات كمقروءة' })
  } catch (error: any) {
    logger.error('Error marking all notifications as read:', { error: error.message, stack: error.stack, userId: req.user!.id })
    res.status(500).json({ error: 'حدث خطأ في تحديث التنبيهات' })
  }
})

export default router

