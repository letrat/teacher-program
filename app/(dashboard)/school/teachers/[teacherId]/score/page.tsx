'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { ArrowRight, CheckCircle, XCircle, Clock, FileText, Award, TrendingUp, AlertCircle, Download as DownloadIcon, Eye, User } from 'lucide-react'
import Chart from '@/components/dashboard/Chart'

interface KPIDetail {
  kpiId: string
  name: string
  weight: number
  score: number
  approvedEvidenceCount: number
  pendingEvidenceCount: number
  rejectedEvidenceCount: number
  minAcceptedEvidence: number | null
  isAchieved: boolean
}

interface TeacherScoreData {
  teacherId: string
  teacherName: string
  jobType: string
  overallScore: number
  overallPercentage: number
  kpis: KPIDetail[]
  weightsInfo?: {
    totalWeight: number
    isValid: boolean
    jobTypeName: string
  }
}

interface EvidenceSubmission {
  id: string
  kpiId: string
  evidenceId: string
  fileUrl: string
  description: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  rating: number | null
  rejectReason: string | null
  reviewedAt: string | null
  createdAt: string
  kpi: {
    id: string
    name: string
  }
  evidence: {
    id: string
    name: string
  }
}

export default function TeacherScorePage() {
  const params = useParams()
  const teacherId = params.teacherId as string

  const [data, setData] = useState<TeacherScoreData | null>(null)
  const [submissions, setSubmissions] = useState<EvidenceSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [submissionsLoading, setSubmissionsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchScore()
    fetchSubmissions()
  }, [teacherId])

  const fetchScore = async () => {
    try {
      const data = await api.school.teachers.score(teacherId)
      setData(data as TeacherScoreData)
    } catch (error: any) {
      setError(error.message || 'حدث خطأ في جلب الدرجة')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSubmissions = async () => {
    try {
      setSubmissionsLoading(true)
      console.log('🔍 Fetching submissions for teacher:', teacherId)
      const response = await api.school.teachers.submissions(teacherId)
      console.log('📥 Submissions response:', response)
      console.log('📥 Response type:', typeof response)
      console.log('📥 Is array:', Array.isArray(response))
      
      // Handle different response formats
      let submissionsData = response
      if (response && typeof response === 'object' && 'submissions' in response) {
        submissionsData = (response as any).submissions
      } else if (Array.isArray(response)) {
        submissionsData = response
      } else {
        submissionsData = []
      }
      
      console.log('📊 Processed submissions:', submissionsData)
      console.log('📊 Submissions count:', Array.isArray(submissionsData) ? submissionsData.length : 0)
      
      setSubmissions(Array.isArray(submissionsData) ? submissionsData : [])
    } catch (error: any) {
      console.error('❌ Error fetching submissions:', error)
      console.error('❌ Error details:', error.message)
      console.error('❌ Error stack:', error.stack)
      setSubmissions([])
    } finally {
      setSubmissionsLoading(false)
    }
  }

  if (loading) {
    return <div className="p-6">جاري التحميل...</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <Link
          href="/school/teachers/scores"
          className="mt-4 inline-block text-blue-600 hover:text-blue-800"
        >
          ← العودة لقائمة المعلمين
        </Link>
      </div>
    )
  }

  if (!data) {
    return <div className="p-6">لا توجد بيانات</div>
  }

  // Prepare chart data for KPIs
  let kpiChartData: any = null
  if (data.kpis && data.kpis.length > 0) {
    kpiChartData = {
      labels: data.kpis.map(k => k.name),
      datasets: [
        {
          label: 'الدرجة (من 5)',
          data: data.kpis.map(k => k.score),
          backgroundColor: data.kpis.map(k => 
            k.isAchieved ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
          ),
          borderRadius: 8,
        },
      ],
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Breadcrumbs items={[
        { label: 'لوحة المدرسة', href: '/school' },
        { label: 'أداء المعلمين', href: '/school/teachers/scores' },
        { label: `تفاصيل: ${data.teacherName}` }
      ]} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            تفاصيل أداء المعلم
          </h1>
          <p className="text-gray-600 text-lg">{data.teacherName}</p>
        </div>
        <Link
          href="/school/teachers/scores"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لقائمة المعلمين
        </Link>
      </div>

      {/* تنبيه مجموع الأوزان */}
      {data.weightsInfo && !data.weightsInfo.isValid && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-800 mb-1">تحذير: مجموع الأوزان غير مكتمل</h3>
            <p className="text-red-700 text-sm">
              مجموع الأوزان للمعايير النشطة لصفة <span className="font-bold">{data.weightsInfo.jobTypeName}</span> هو{' '}
              <span className="font-bold">{data.weightsInfo.totalWeight}%</span> ولا يساوي 100%.{' '}
              <span className="font-semibold">الدرجة النهائية قد تكون غير دقيقة.</span>
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Award className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-sm opacity-90 mb-1">الدرجة النهائية</div>
              <div className="text-3xl font-bold">
                {data.overallScore.toFixed(2)}
              </div>
              <div className="text-sm opacity-80 mt-1">من 5</div>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <div className="text-right">
              <div className="text-sm opacity-90 mb-1">النسبة المئوية</div>
              <div className="text-3xl font-bold">
                {data.overallPercentage.toFixed(1)}%
              </div>
              <div className="text-sm opacity-80 mt-1">
                {data.overallPercentage >= 80 ? 'ممتاز' : data.overallPercentage >= 60 ? 'جيد' : 'يحتاج تحسين'}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <User className="w-8 h-8 text-purple-600" />
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">الصفة الوظيفية</div>
              <div className="text-xl font-bold text-gray-900">
                {data.jobType}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-indigo-500">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-8 h-8 text-indigo-600" />
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">عدد المعايير</div>
              <div className="text-xl font-bold text-gray-900">
                {data.kpis.length}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.kpis.filter(k => k.isAchieved).length} محقق
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Performance Chart */}
      {kpiChartData && data.kpis && data.kpis.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            أداء المعايير
          </h2>
          <Chart
            type="bar"
            data={kpiChartData}
            height={300}
            options={{
              plugins: {
                legend: {
                  display: false,
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 5,
                  ticks: {
                    stepSize: 1,
                  },
                },
              },
            }}
          />
        </div>
      )}

      {/* تفاصيل المعايير - Cards View */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            تفاصيل المعايير ({data.kpis.length})
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.kpis.map((kpi) => {
              const minRequired = kpi.minAcceptedEvidence
              const hasMinRequirement = minRequired !== null && minRequired > 0
              const isAchieved = kpi.isAchieved
              const needsWarning = hasMinRequirement && !isAchieved
              const scorePercentage = (kpi.score / 5) * 100
              
              return (
                <div
                  key={kpi.kpiId}
                  className={`border-2 rounded-xl p-6 transition-all hover:shadow-lg ${
                    needsWarning 
                      ? 'border-red-300 bg-red-50' 
                      : isAchieved 
                        ? 'border-green-300 bg-green-50' 
                        : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* KPI Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {kpi.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>الوزن: {kpi.weight}%</span>
                        <span>•</span>
                        <span>الدرجة: {kpi.score.toFixed(2)} / 5</span>
                      </div>
                    </div>
                    {isAchieved ? (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">التقدم</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {scorePercentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          scorePercentage >= 80 
                            ? 'bg-green-500' 
                            : scorePercentage >= 60 
                              ? 'bg-yellow-500' 
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${scorePercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Evidence Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-2xl font-bold text-green-600">
                        {kpi.approvedEvidenceCount}
                      </div>
                      <div className="text-xs text-green-700 mt-1">مقبول</div>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="text-2xl font-bold text-yellow-600">
                        {kpi.pendingEvidenceCount}
                      </div>
                      <div className="text-xs text-yellow-700 mt-1">قيد المراجعة</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-2xl font-bold text-red-600">
                        {kpi.rejectedEvidenceCount}
                      </div>
                      <div className="text-xs text-red-700 mt-1">مرفوض</div>
                    </div>
                  </div>

                  {/* Status and Warning */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">الحد الأدنى المطلوب:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {minRequired !== null ? minRequired : 'غير محدد'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">حالة المعيار:</span>
                      {isAchieved ? (
                        <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          محقق
                        </span>
                      ) : (
                        <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          غير محقق
                        </span>
                      )}
                    </div>
                    {needsWarning && (
                      <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-700">
                            لم يتحقق الحد الأدنى لعدد الشواهد المقبولة ({kpi.approvedEvidenceCount} من {minRequired} مطلوب)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* تفاصيل الشواهد */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              الشواهد المرفوعة ({submissions.length})
            </h2>
            {submissions.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                  مقبول: {submissions.filter(s => s.status === 'ACCEPTED').length}
                </span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                  قيد المراجعة: {submissions.filter(s => s.status === 'PENDING').length}
                </span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                  مرفوض: {submissions.filter(s => s.status === 'REJECTED').length}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="p-6">
          {submissionsLoading ? (
            <div className="text-center py-8 text-gray-500">
              جاري تحميل الشواهد...
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              لا توجد شواهد مرفوعة
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => {
                const statusColors = {
                  PENDING: 'bg-yellow-50 border-yellow-300 text-yellow-800',
                  ACCEPTED: 'bg-green-50 border-green-300 text-green-800',
                  REJECTED: 'bg-red-50 border-red-300 text-red-800',
                }
                const statusLabels = {
                  PENDING: 'قيد المراجعة',
                  ACCEPTED: 'مقبول',
                  REJECTED: 'مرفوض',
                }
                const statusIcons = {
                  PENDING: Clock,
                  ACCEPTED: CheckCircle,
                  REJECTED: XCircle,
                }
                const StatusIcon = statusIcons[submission.status]
                
                return (
                  <div
                    key={submission.id}
                    className={`border-2 rounded-xl p-5 hover:shadow-lg transition-all ${statusColors[submission.status]}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-lg ${statusColors[submission.status].replace('50', '100')}`}>
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                              {submission.evidence.name}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white border-2">
                                {statusLabels[submission.status]}
                              </span>
                              {submission.rating && (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                  <Award className="w-3 h-3" />
                                  {submission.rating}/5
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600"><span className="font-medium">المعيار:</span> {submission.kpi.name}</span>
                          </div>
                          {submission.description && (
                            <div className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                              <span className="font-medium text-gray-600">الوصف:</span> {submission.description}
                            </div>
                          )}
                          {submission.rejectReason && (
                            <div className="text-sm bg-red-100 border-2 border-red-300 text-red-800 p-3 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="font-medium">سبب الرفض:</span>
                                  <p className="mt-1">{submission.rejectReason}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-200">
                            <span>
                              <span className="font-medium">تاريخ الرفع:</span>{' '}
                              {new Date(submission.createdAt).toLocaleDateString('ar-SA', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {submission.reviewedAt && (
                              <span>
                                <span className="font-medium">تاريخ المراجعة:</span>{' '}
                                {new Date(submission.reviewedAt).toLocaleDateString('ar-SA', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <a
                          href={submission.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-md"
                        >
                          <Eye className="w-4 h-4" />
                          عرض الملف
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}





