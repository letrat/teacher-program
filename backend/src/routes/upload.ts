import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { AuthRequest, authenticate } from '../middleware/auth'
import { csrfProtection, addCSRFToken } from '../middleware/csrf'
import { uploadLimiter } from '../middleware/rateLimit'
import { 
  validateFileContent, 
  sanitizeFilename, 
  validateFileExtension, 
  validateFileSize,
  getMimeTypeFromExtension 
} from '../utils/fileValidation'
import logger from '../lib/logger'

const router = Router()

// All routes require authentication, CSRF protection, and rate limiting
router.use(authenticate)
router.use(addCSRFToken) // Add CSRF token to response before CSRF protection
router.use(csrfProtection)
router.use(uploadLimiter)

// Ensure uploads directory exists
// In backend, we'll store uploads in a relative path that can be served by frontend
const uploadsDir = path.join(process.cwd(), '..', 'public', 'uploads', 'evidence')
// Fallback to backend/uploads if parent public doesn't exist
const fallbackDir = path.join(process.cwd(), 'uploads', 'evidence')
const finalUploadsDir = fs.existsSync(path.join(process.cwd(), '..', 'public')) ? uploadsDir : fallbackDir

if (!fs.existsSync(finalUploadsDir)) {
  fs.mkdirSync(finalUploadsDir, { recursive: true })
}

// Configure multer with secure filename generation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, finalUploadsDir)
  },
  filename: (req, file, cb) => {
    try {
      // Sanitize original filename to prevent path traversal
      const sanitized = sanitizeFilename(file.originalname)
      const ext = path.extname(sanitized)
      
      // Generate unique filename with timestamp and random number
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      const safeFilename = `${uniqueSuffix}${ext}`
      
      cb(null, safeFilename)
    } catch (error: any) {
      cb(new Error(`خطأ في اسم الملف: ${error.message}`), '')
    }
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB max
    files: 1, // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    try {
      // Validate file extension
      if (!validateFileExtension(file.originalname)) {
        return cb(new Error('نوع الملف غير مدعوم. يرجى رفع صورة، PDF، فيديو، Excel، Word، أو PowerPoint'))
      }

      // Validate MIME type
      const expectedMimeType = getMimeTypeFromExtension(file.originalname)
      if (!expectedMimeType || file.mimetype !== expectedMimeType) {
        // Allow some flexibility for MIME types (browsers may send different types)
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm',
        ]
        
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(new Error('نوع الملف غير مدعوم. يرجى رفع صورة، PDF، فيديو، Excel، Word، أو PowerPoint'))
        }
      }

      cb(null, true)
    } catch (error: any) {
      cb(new Error(`خطأ في التحقق من الملف: ${error.message}`))
    }
  },
})

// POST - رفع ملف
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم رفع أي ملف' })
    }

    // Additional security validations after upload
    const filePath = path.join(finalUploadsDir, req.file.filename)
    
    // Validate file size
    if (!validateFileSize(req.file.size)) {
      // Delete uploaded file if validation fails
      fs.unlinkSync(filePath)
      return res.status(400).json({ error: 'حجم الملف كبير جداً. الحد الأقصى 30MB' })
    }

    // Validate file content using magic bytes
    const expectedMimeType = getMimeTypeFromExtension(req.file.originalname) || req.file.mimetype
    if (!validateFileContent(filePath, expectedMimeType)) {
      // Delete uploaded file if content validation fails
      fs.unlinkSync(filePath)
      logger.warn('File content validation failed', {
        filename: req.file.filename,
        expectedMimeType,
        userId: req.user?.id,
      })
      return res.status(400).json({ error: 'محتوى الملف غير صحيح أو تالف' })
    }

    // Sanitize original filename for response
    const sanitizedOriginalName = sanitizeFilename(req.file.originalname)

    const fileUrl = `/uploads/evidence/${req.file.filename}`

    logger.info('File uploaded successfully', {
      filename: req.file.filename,
      size: req.file.size,
      userId: req.user?.id,
    })

    res.json({
      fileUrl,
      filename: req.file.filename,
      originalName: sanitizedOriginalName,
      size: req.file.size,
    })
  } catch (error: any) {
    // Clean up file if error occurred
    if (req.file) {
      try {
        const filePath = path.join(finalUploadsDir, req.file.filename)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (cleanupError) {
        logger.error('Error cleaning up file:', { error: cleanupError })
      }
    }

    logger.error('Upload error:', { error: error.message, stack: error.stack })
    res.status(500).json({ error: error.message || 'حدث خطأ في رفع الملف' })
  }
})

export default router

