import { z } from 'zod'

/**
 * Common validation schemas
 */

export const uuidSchema = z.string().uuid('المعرف غير صحيح')

export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  orderBy: z.string().optional(),
  sortBy: z.enum(['asc', 'desc']).optional(),
})

export const nameSchema = z.string()
  .min(1, 'الاسم مطلوب')
  .max(200, 'الاسم طويل جداً')
  .trim()
  .refine((val) => val.length > 0, 'الاسم مطلوب')
  .refine((val) => /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9\s\-_.()]+$/.test(val), {
    message: 'الاسم يحتوي على أحرف غير مسموحة. يسمح بالحروف العربية والإنجليزية والأرقام والمسافات و - _ . ( )'
  })

export const descriptionSchema = z.string()
  .max(1000, 'الوصف طويل جداً')
  .optional()

