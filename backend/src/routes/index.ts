import { Router } from 'express'
import authRoutes from './auth'
import notificationRoutes from './notifications'
import uploadRoutes from './upload'
import adminRoutes from './admin'
import schoolRoutes from './school'
import teacherRoutes from './teacher'

const router = Router()

// Root API endpoint - handle /api/ requests
router.get('/', (req, res) => {
  res.json({
    message: 'Teacher Program API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      school: '/api/school',
      teacher: '/api/teacher',
      notifications: '/api/notifications',
      upload: '/api/upload',
    },
    health: '/health',
  })
})

router.use('/auth', authRoutes)
router.use('/notifications', notificationRoutes)
router.use('/upload', uploadRoutes)
router.use('/admin', adminRoutes)
router.use('/school', schoolRoutes)
router.use('/teacher', teacherRoutes)

export default router

