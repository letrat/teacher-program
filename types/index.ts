// Define UserRole enum locally to avoid Prisma client issues during build/prerendering
export enum UserRole {
  ADMIN = 'ADMIN',
  SCHOOL_MANAGER = 'SCHOOL_MANAGER',
  TEACHER = 'TEACHER'
}

// Re-export other Prisma types
export { SubmissionStatus, NotificationType } from '@prisma/client'

export interface User {
  id: string
  username: string
  name: string
  role: string
  schoolId?: string
  jobTypeId?: string
  status: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface School {
  id: string
  name: string
  status: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface JobType {
  id: string
  name: string
  status: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface KPI {
  id: string
  jobTypeId: string
  name: string
  weight: number
  isOfficial: boolean
  schoolId?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface KPIWithEvidence extends KPI {
  evidenceItems: EvidenceItem[]
}

export interface EvidenceItem {
  id: string
  kpiId: string
  name: string
  isOfficial: boolean
  schoolId?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface EvidenceSubmission {
  id: string
  teacherId: string
  kpiId: string
  evidenceId: string
  fileUrl: string
  description?: string
  status: string
  rating?: number
  rejectReason?: string
  reviewedAt?: Date
  createdAt: Date
  updatedAt?: Date
}

export interface EvidenceSubmissionWithDetails extends EvidenceSubmission {
  teacher: {
    id: string
    name: string
    jobType?: {
      id: string
      name: string
    }
  }
  kpi: {
    id: string
    name: string
  }
  evidence: {
    id: string
    name: string
  }
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: Date
}

export interface DashboardStats {
  teachersCount: number
  pendingCount: number
  acceptedCount: number
  rejectedCount: number
  averageScore: number
  averagePercentage: number
}

export interface TeacherScore {
  id: string
  name: string
  jobType: string
  overallScore: number
  overallPercentage: number
}

export interface KPIScore {
  kpiId: string
  kpiName: string
  weight: number
  score: number
}

export interface TeacherScoreDetails extends TeacherScore {
  kpis: Array<KPIScore & {
    approvedEvidenceCount: number
    pendingEvidenceCount: number
    rejectedEvidenceCount: number
  }>
}

export interface ChartData {
  labels: string[]
  data: number[]
}

export interface KPIWeight {
  kpiId: string
  name: string
  weight: number
  isActive: boolean
  isOfficial: boolean
}

export interface WeightsResponse {
  kpis: KPIWeight[]
  totalWeight: number
  isValid: boolean
}





