import rateLimit from 'express-rate-limit'

/**
 * Rate limiting configurations for different endpoints
 */

// General API rate limit: 100 requests per minute
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.',
  standardHeaders: true,
  legacyHeaders: false,
})

// Strict rate limit for login: 10 requests per 15 minutes
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
})

// Upload rate limit: 50 requests per minute
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: 'تم تجاوز الحد المسموح من رفع الملفات. يرجى المحاولة لاحقاً.',
  standardHeaders: true,
  legacyHeaders: false,
})

// Admin operations rate limit: 200 requests per minute
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: 'تم تجاوز الحد المسموح من العمليات. يرجى المحاولة لاحقاً.',
  standardHeaders: true,
  legacyHeaders: false,
})







