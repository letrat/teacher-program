import { z } from 'zod'
import { nameSchema, uuidSchema } from './common'

/**
 * School-related validation schemas
 */

export const createSchoolSchema = z.object({
  name: nameSchema,
  managerUsername: z.string()
    .min(1, 'اسم المستخدم مطلوب')
    .max(100, 'اسم المستخدم طويل جداً')
    .regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام و _ فقط'),
  managerPassword: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(200, 'كلمة المرور طويلة جداً')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'كلمة المرور يجب أن تحتوي على حرف صغير وكبير ورقم على الأقل'),
  managerName: nameSchema,
  subscriptionStart: z.string().datetime().optional().nullable(),
  subscriptionEnd: z.string().datetime().optional().nullable(),
})

export const updateSchoolSchema = z.object({
  name: nameSchema.optional(),
  status: z.boolean().optional(),
  subscriptionStart: z.string().datetime().optional().nullable(),
  subscriptionEnd: z.string().datetime().optional().nullable(),
})

export const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(200, 'كلمة المرور طويلة جداً')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'كلمة المرور يجب أن تحتوي على حرف صغير وكبير ورقم على الأقل'),
})

export const createTeacherSchema = z.object({
  name: nameSchema,
  username: z.string()
    .min(1, 'اسم المستخدم مطلوب')
    .max(100, 'اسم المستخدم طويل جداً')
    .regex(/^[a-zA-Z0-9_]+$/, 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام و _ فقط'),
  password: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(200, 'كلمة المرور طويلة جداً')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'كلمة المرور يجب أن تحتوي على حرف صغير وكبير ورقم على الأقل'),
  jobTypeId: uuidSchema,
})

export const updateTeacherSchema = z.object({
  name: nameSchema.optional(),
  jobTypeId: uuidSchema.optional(),
  status: z.boolean().optional(),
})

