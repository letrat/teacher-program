import { z } from 'zod'
import { nameSchema, uuidSchema } from './common'

/**
 * Admin validation schemas
 */

export const createSchoolSchema = z.object({
  name: nameSchema,
  managerUsername: z.string()
    .min(1, 'اسم المستخدم مطلوب')
    .max(100, 'اسم المستخدم طويل جداً')
    .regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام و _ فقط')
    .optional(), // Optional - will use school name if not provided
  managerPassword: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(200, 'كلمة المرور طويلة جداً')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'كلمة المرور يجب أن تحتوي على حرف صغير وكبير ورقم على الأقل'),
  managerName: nameSchema,
  managerPhone: z.string()
    .regex(/^[0-9+\-\s()]+$/, 'رقم الجوال غير صحيح')
    .optional()
    .nullable(),
  managerEmail: z.string()
    .email('البريد الإلكتروني غير صحيح')
    .optional()
    .nullable(),
})

export const updateSchoolSchema = z.object({
  name: nameSchema.optional(),
  status: z.boolean().optional(),
  subscriptionStart: z.union([z.string().datetime(), z.null()]).optional(),
  subscriptionEnd: z.union([z.string().datetime(), z.null()]).optional(),
  managerName: nameSchema.optional(),
  managerUsername: z.string()
    .min(1, 'اسم المستخدم مطلوب')
    .max(100, 'اسم المستخدم طويل جداً')
    .regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام و _ فقط')
    .optional(),
  managerPhone: z.string()
    .regex(/^[0-9+\-\s()]+$/, 'رقم الجوال غير صحيح')
    .optional()
    .nullable(),
  managerEmail: z.string()
    .email('البريد الإلكتروني غير صحيح')
    .optional()
    .nullable(),
}).passthrough() // Allow additional fields

export const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(200, 'كلمة المرور طويلة جداً')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'كلمة المرور يجب أن تحتوي على حرف صغير وكبير ورقم على الأقل'),
})

export const createUserSchema = z.object({
  username: z.string()
    .min(1, 'اسم المستخدم مطلوب')
    .max(100, 'اسم المستخدم طويل جداً')
    .regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام و _ فقط'),
  password: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(200, 'كلمة المرور طويلة جداً')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'كلمة المرور يجب أن تحتوي على حرف صغير وكبير ورقم على الأقل'),
  name: nameSchema,
  role: z.enum(['ADMIN', 'SCHOOL_MANAGER', 'TEACHER'], {
    errorMap: () => ({ message: 'الدور غير صحيح' }),
  }),
  schoolId: uuidSchema.optional().nullable(),
  jobTypeId: uuidSchema.optional().nullable(),
})

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  status: z.boolean().optional(),
  schoolId: uuidSchema.optional().nullable(),
  jobTypeId: uuidSchema.optional().nullable(),
})

export const createJobTypeSchema = z.object({
  name: nameSchema,
})

export const updateJobTypeSchema = z.object({
  name: nameSchema.optional(),
  status: z.boolean().optional(),
})

export const createKPISchema = z.object({
  name: nameSchema,
  weight: z.number()
    .min(0, 'الوزن يجب أن يكون أكبر من أو يساوي 0')
    .max(100, 'الوزن يجب أن يكون أقل من أو يساوي 100'),
  minAcceptedEvidence: z.number()
    .int('الحد الأدنى لعدد الشواهد يجب أن يكون رقماً صحيحاً')
    .min(1, 'الحد الأدنى لعدد الشواهد يجب أن يكون 1 أو أكثر')
    .optional()
    .nullable(),
})

export const updateKPISchema = z.object({
  name: nameSchema.optional(),
  weight: z.number()
    .min(0, 'الوزن يجب أن يكون أكبر من أو يساوي 0')
    .max(100, 'الوزن يجب أن يكون أقل من أو يساوي 100')
    .optional(),
  minAcceptedEvidence: z.number()
    .int('الحد الأدنى لعدد الشواهد يجب أن يكون رقماً صحيحاً')
    .min(1, 'الحد الأدنى لعدد الشواهد يجب أن يكون 1 أو أكثر')
    .optional()
    .nullable(),
})

export const createEvidenceSchema = z.object({
  name: nameSchema,
})

export const updateEvidenceSchema = z.object({
  name: nameSchema.optional(),
})



