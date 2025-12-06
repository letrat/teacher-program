import { Router } from 'express'
import authRoutes from './auth'
import notificationRoutes from './notifications'
import uploadRoutes from './upload'
import adminRoutes from './admin'
import schoolRoutes from './school'
import teacherRoutes from './teacher'

const router = Router()

router.use('/auth', authRoutes)
router.use('/notifications', notificationRoutes)
router.use('/upload', uploadRoutes)
router.use('/admin', adminRoutes)
router.use('/school', schoolRoutes)
router.use('/teacher', teacherRoutes)

export default router

