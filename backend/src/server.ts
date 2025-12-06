import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import helmet from 'helmet'
import { prisma } from './lib/db'
import apiRoutes from './routes'
import logger from './lib/logger'
import { addCSRFToken } from './middleware/csrf'

// Load environment variables
// Try to load from backend/.env first, then from root .env
import path from 'path'
import { existsSync } from 'fs'

const backendEnvPath = path.resolve(__dirname, '../.env')
const rootEnvPath = path.resolve(__dirname, '../../.env')

if (existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath })
} else if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath })
} else {
  dotenv.config() // Try default .env in current directory
}

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL is not set!')
  logger.error('Please create a .env file in the backend/ directory with:')
  logger.error('DATABASE_URL="mysql://user:password@localhost:3306/database_name"')
  process.exit(1)
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is not set in production!')
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 5000

// Security middleware - Enhanced Helmet configuration
const helmetConfig: any = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // 'unsafe-inline' needed for Tailwind
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  permittedCrossDomainPolicies: false,
  xssFilter: true,
}

app.use(helmet(helmetConfig))

// Add custom security headers
app.use((req, res, next) => {
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // X-Frame-Options (redundant with helmet but explicit)
  res.setHeader('X-Frame-Options', 'DENY')
  
  // Permissions-Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // Remove X-Powered-By
  res.removeHeader('X-Powered-By')
  
  next()
})

// Middleware
// Allow multiple origins for development (localhost:3000, localhost:3001, etc.)
// Parse CORS_ORIGIN from environment (comma-separated list)
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : []

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  ...corsOrigins,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      // In development, allow any localhost origin
      if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  },
  credentials: true,
  exposedHeaders: ['Set-Cookie', 'X-CSRF-Token'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-csrf-token'],
}))
app.use(cookieParser())
app.use(express.json({ limit: '10mb' })) // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' })) // Limit URL-encoded payload size

// Add CSRF token to responses (after authentication)
app.use(addCSRFToken)

// Health check with database connectivity
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ 
      status: 'ok', 
      message: 'Backend API is running',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('Health check failed:', { error: error.message })
    res.status(503).json({ 
      status: 'error', 
      message: 'Backend API is running but database connection failed',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    })
  }
})

// Middleware to silence logging for ignored paths (before API routes)
app.use((req, res, next) => {
  const ignoredPaths = [
    '/.well-known',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/apple-touch-icon',
    '/manifest.json',
  ]
  
  const shouldIgnore = ignoredPaths.some(path => req.path.startsWith(path))
  
  if (shouldIgnore) {
    // Mark request as ignored to skip logging in 404 handler
    ;(req as any)._ignoreLogging = true
  }
  
  next()
})

// API Routes
app.use('/api', apiRoutes)

// Error handling middleware - Secure error responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Log full error details (but don't expose to client)
  logger.error('Unhandled error:', {
    error: err.message,
    stack: isProduction ? undefined : err.stack, // Don't log stack in production
    path: req.path,
    method: req.method,
    statusCode: err.status || 500,
  })
  
  // Don't expose error details in production
  const errorMessage = isProduction 
    ? 'حدث خطأ في الخادم' 
    : err.message || 'Internal server error'
  
  // Don't expose stack traces
  res.status(err.status || 500).json({
    error: errorMessage,
    // Only include status code, not stack trace
    ...(isProduction ? {} : { statusCode: err.status || 500 }),
  })
})

// 404 handler
app.use((req, res) => {
  // Check if logging should be ignored (set by middleware above)
  const shouldIgnore = (req as any)._ignoreLogging || false
  
  if (!shouldIgnore) {
    // Log 404 only for non-ignored paths
    logger.warn('404 - Route not found', {
      path: req.path,
      method: req.method,
      url: req.url,
    })
    res.status(404).json({ error: 'Route not found', path: req.path })
  } else {
    // Silently return 404 for ignored paths (no logging, minimal response)
    res.status(404).end()
  }
})

// Start server
app.listen(PORT, () => {
  logger.info(`Backend server running on http://localhost:${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    port: PORT,
  })
})

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`)
  try {
    await prisma.$disconnect()
    logger.info('Database connection closed')
  } catch (error: any) {
    logger.error('Error closing database connection:', { error: error.message })
  }
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
