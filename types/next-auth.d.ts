import { UserRole } from '@prisma/client'
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      name: string
      role: UserRole
      schoolId?: string
      jobTypeId?: string
    }
  }

  interface User {
    id: string
    username: string
    name: string
    role: UserRole
    schoolId?: string
    jobTypeId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    schoolId?: string
    jobTypeId?: string
  }
}

