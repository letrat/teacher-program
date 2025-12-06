/**
 * Password strength validation and utilities
 */

export interface PasswordStrength {
  isValid: boolean
  score: number // 0-4 (0 = very weak, 4 = very strong)
  feedback: string[]
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  // Minimum length check
  if (password.length < 8) {
    feedback.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    return { isValid: false, score: 0, feedback }
  }

  // Length scoring
  if (password.length >= 8) score++
  if (password.length >= 12) score++

  // Character variety checks
  const hasLowercase = /[a-z]/.test(password)
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

  if (hasLowercase) score++
  if (hasUppercase) score++
  if (hasNumbers) score++
  if (hasSpecialChars) score++

  // Minimum requirements
  if (!hasLowercase) {
    feedback.push('يجب أن تحتوي على حرف صغير على الأقل')
  }
  if (!hasUppercase) {
    feedback.push('يجب أن تحتوي على حرف كبير على الأقل')
  }
  if (!hasNumbers) {
    feedback.push('يجب أن تحتوي على رقم على الأقل')
  }

  const isValid = hasLowercase && hasUppercase && hasNumbers && password.length >= 8

  return {
    isValid,
    score: Math.min(score, 4),
    feedback: feedback.length > 0 ? feedback : ['كلمة المرور قوية'],
  }
}

/**
 * Check if password is in common passwords list
 */
export function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password',
    '12345678',
    'password123',
    'admin123',
    'qwerty123',
    '123456789',
    'welcome123',
  ]

  return commonPasswords.some(common => 
    password.toLowerCase().includes(common.toLowerCase())
  )
}

