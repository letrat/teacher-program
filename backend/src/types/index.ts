/**
 * Shared Types between Frontend and Backend
 */

import { UserRole, SubmissionStatus, NotificationType } from '@prisma/client'

// User Types
export interface User {
  id: string
  username: string
  name: string
  role: UserRole
  schoolId?: string
  jobTypeId?: string
  status: boolean
  createdAt: Date
  updatedAt: Date
}

// Auth Types
export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: User
  token: string
}

export interface RegisterRequest {
  username: string
  password: string
  name: string
  role: UserRole
  schoolId?: string
  jobTypeId?: string
}

// School Types
export interface School {
  id: string
  name: string
  status: boolean
  createdAt: Date
  updatedAt: Date
}

// Job Type Types
export interface JobType {
  id: string
  name: string
  status: boolean
  createdAt: Date
  updatedAt: Date
}

// KPI Types
export interface KPI {
  id: string
  jobTypeId: string
  name: string
  weight: number
  isOfficial: boolean
  schoolId?: string
  createdAt: Date
  updatedAt: Date
}

export interface KPIWithEvidence extends KPI {
  evidenceItems: EvidenceItem[]
}

// Evidence Types
export interface EvidenceItem {
  id: string
  kpiId: string
  name: string
  isOfficial: boolean
  schoolId?: string
  createdAt: Date
  updatedAt: Date
}

// Submission Types
export interface EvidenceSubmission {
  id: string
  teacherId: string
  kpiId: string
  evidenceId: string
  fileUrl: string
  description?: string
  status: SubmissionStatus
  rating?: number
  rejectReason?: string
  reviewedAt?: Date
  createdAt: Date
  updatedAt: Date
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

// Notification Types
export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: Date
}

// Dashboard Types
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

// Chart Types
export interface ChartData {
  labels: string[]
  data: number[]
}

// API Response Types
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

// Weight Management Types
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

// Report Types
export interface ReportSummary {
  total: number
  accepted: number
  rejected: number
  pending: number
}

export interface TeacherAverage {
  teacherId: string
  teacherName: string
  averageRating: number
  totalSubmissions: number
}

export interface KPIActivity {
  kpiName: string
  total: number
  accepted: number
  rejected: number
  pending: number
}

export interface ReportData {
  summary: ReportSummary
  teacherAverages: TeacherAverage[]
  kpiActivity: KPIActivity[]
}







