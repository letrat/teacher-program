import { z } from 'zod'
import { uuidSchema } from './common'

/**
 * Teacher validation schemas
 */

export const submitEvidenceSchema = z.object({
  kpiId: uuidSchema,
  evidenceId: uuidSchema,
  fileUrl: z.string()
    .min(1, 'رابط الملف مطلوب')
    .refine((url) => url.startsWith('/uploads/evidence/'), {
      message: 'رابط الملف يجب أن يكون من مجلد uploads/evidence',
    }),
  description: z.string()
    .max(1000, 'الوصف طويل جداً')
    .optional(),
})



