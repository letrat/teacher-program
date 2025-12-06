import fs from 'fs'
import path from 'path'
import logger from '../lib/logger'

/**
 * Magic bytes (file signatures) for common file types
 */
const MAGIC_BYTES: Record<string, string[]> = {
  'image/jpeg': ['FFD8FF'],
  'image/png': ['89504E47'],
  'image/gif': ['474946'],
  'application/pdf': ['255044462D'],
  'application/msword': ['D0CF11E0', '504B0304'], // .doc (old format) or .docx (new format)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504B0304'], // .docx
  'application/vnd.ms-excel': ['D0CF11E0', '504B0304'], // .xls (old format) or .xlsx (new format)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['504B0304'], // .xlsx
  'application/vnd.ms-powerpoint': ['D0CF11E0', '504B0304'], // .ppt (old format) or .pptx (new format)
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['504B0304'], // .pptx
  'video/mp4': ['00000018667479704D503432', '00000020667479704D503432'], // MP4
  'video/mpeg': ['000001BA', '000001B3'], // MPEG
  'video/quicktime': ['000000206674797071742020'], // MOV
  'video/x-msvideo': ['52494646'], // AVI
  'video/webm': ['1A45DFA3'], // WebM
}

/**
 * Allowed file extensions
 */
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp4', '.mpeg', '.mov', '.avi', '.webm'
]

/**
 * Dangerous file extensions that should never be allowed
 */
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.sh', '.ps1', '.dll', '.app', '.deb', '.rpm', '.msi', '.dmg',
]

/**
 * Validate file by checking magic bytes
 */
export function validateFileContent(filePath: string, expectedMimeType: string): boolean {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    // Read more bytes for video files (they need more bytes for signature)
    const bytesToRead = expectedMimeType.startsWith('video/') ? 12 : 4
    const hexSignature = fileBuffer.slice(0, bytesToRead).toString('hex').toUpperCase()

    // Get expected magic bytes for this MIME type
    const expectedSignatures = MAGIC_BYTES[expectedMimeType] || []
    
    if (expectedSignatures.length === 0) {
      // For video files and Office files, we'll be more lenient with validation
      // since magic bytes can vary. We'll trust the extension validation.
      if (expectedMimeType.startsWith('video/') || 
          expectedMimeType.includes('excel') || 
          expectedMimeType.includes('powerpoint') ||
          expectedMimeType.includes('wordprocessing')) {
        logger.debug('No magic bytes defined for MIME type, allowing based on extension', { mimeType: expectedMimeType })
        return true
      }
      logger.warn('No magic bytes defined for MIME type', { mimeType: expectedMimeType })
      return false
    }

    // Check if file signature matches any expected signature
    const matches = expectedSignatures.some(sig => hexSignature.startsWith(sig))
    
    if (!matches) {
      logger.warn('File signature mismatch', {
        expected: expectedSignatures,
        actual: hexSignature,
        mimeType: expectedMimeType,
      })
      // For Office files (.xlsx, .pptx, .docx), they all start with ZIP signature
      // So we'll be more lenient
      if (expectedMimeType.includes('openxmlformats') && hexSignature.startsWith('504B0304')) {
        return true
      }
    }

    return matches
  } catch (error: any) {
    logger.error('Error validating file content:', { error: error.message, filePath })
    return false
  }
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  let sanitized = filename
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[<>:"|?*]/g, '') // Remove dangerous characters
    .trim()

  // Get extension
  const ext = path.extname(sanitized).toLowerCase()
  const nameWithoutExt = path.basename(sanitized, ext)

  // Ensure extension is allowed
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`امتداد الملف غير مسموح: ${ext}`)
  }

  // Check for dangerous extensions
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    throw new Error(`نوع الملف خطير وغير مسموح: ${ext}`)
  }

  // Return sanitized filename (without path)
  return `${nameWithoutExt}${ext}`
}

/**
 * Validate file extension
 */
export function validateFileExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext) && !DANGEROUS_EXTENSIONS.includes(ext)
}

/**
 * Validate file size (in bytes)
 */
export function validateFileSize(size: number, maxSize: number = 30 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase()
  
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.mp4': 'video/mp4',
    '.mpeg': 'video/mpeg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
  }

  return mimeMap[ext] || null
}

