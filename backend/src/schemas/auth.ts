import { z } from 'zod'

/**
 * Authentication validation schemas
 */

export const loginSchema = z.object({
  username: z.string()
    .min(1, 'اسم المستخدم مطلوب')
    .max(100, 'اسم المستخدم طويل جداً')
    .regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام و _ فقط'),
  password: z.string()
    .min(1, 'كلمة المرور مطلوبة')
    .max(200, 'كلمة المرور طويلة جداً'),
})

export const registerSchema = z.object({
  username: z.string()
    .min(1, 'اسم المستخدم مطلوب')
    .max(100, 'اسم المستخدم طويل جداً')
    .regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام و _ فقط'),
  password: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(200, 'كلمة المرور طويلة جداً')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'كلمة المرور يجب أن تحتوي على حرف صغير وكبير ورقم على الأقل'),
  name: z.string()
    .min(1, 'الاسم مطلوب')
    .max(200, 'الاسم طويل جداً'),
  role: z.enum(['ADMIN', 'SCHOOL_MANAGER', 'TEACHER'], {
    errorMap: () => ({ message: 'الدور غير صحيح' }),
  }),
  schoolId: z.string().uuid('معرف المدرسة غير صحيح').optional().nullable(),
  jobTypeId: z.string().uuid('معرف صفة الموظف غير صحيح').optional().nullable(),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token مطلوب'),
})

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z.string()
    .min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
    .max(200, 'كلمة المرور طويلة جداً')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'كلمة المرور يجب أن تحتوي على حرف صغير وكبير ورقم على الأقل'),
})

