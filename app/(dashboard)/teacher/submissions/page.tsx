'use client'

import { useState, useEffect } from 'react'
import { SubmissionStatus } from '@prisma/client'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Clock, CheckCircle, XCircle, FileText, Calendar, Star, Upload, TrendingUp, AlertCircle, Image as ImageIcon } from 'lucide-react'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { SkeletonCard, SkeletonList } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'

interface Submission {
  id: string
  fileUrl: string
  description?: string
  status: SubmissionStatus
  rating?: number
  rejectReason?: string
  reviewedAt?: string
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

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | SubmissionStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [weightsInfo, setWeightsInfo] = useState<{
    totalWeight: number
    isValid: boolean
    jobTypeName: string
  } | null>(null)

  useEffect(() => {
    fetchSubmissions()
    fetchWeightsInfo()
  }, [])

  const fetchWeightsInfo = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const data = await api.teacher.dashboard() as { weightsInfo?: { totalWeight: number; isValid: boolean; jobTypeName: string } }
      if (data.weightsInfo) {
        setWeightsInfo(data.weightsInfo)
      }
    } catch (error) {
      // Silently fail - weights info is optional
    }
  }

  const fetchSubmissions = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const data = await api.teacher.submissions()
      // Handle pagination response
      const submissionsList = Array.isArray(data) ? data : ((data as any)?.data || [])
      setSubmissions(submissionsList)
    } catch (error) {
      toast.error('حدث خطأ في جلب الطلبات')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: SubmissionStatus) => {
    switch (status) {
      case SubmissionStatus.PENDING:
        return (
          <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            قيد المراجعة
          </span>
        )
      case SubmissionStatus.ACCEPTED:
        return (
          <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            مقبول
          </span>
        )
      case SubmissionStatus.REJECTED:
        return (
          <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            مرفوض
          </span>
        )
    }
  }

  const filteredSubmissions = submissions.filter((submission) => {
    if (filter !== 'all' && submission.status !== filter) return false
    if (searchQuery && !submission.kpi.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !submission.evidence.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Statistics
  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === SubmissionStatus.PENDING).length,
    accepted: submissions.filter(s => s.status === SubmissionStatus.ACCEPTED).length,
    rejected: submissions.filter(s => s.status === SubmissionStatus.REJECTED).length,
    averageRating: submissions
      .filter(s => s.status === SubmissionStatus.ACCEPTED && s.rating)
      .reduce((sum, s) => sum + (s.rating || 0), 0) / 
      submissions.filter(s => s.status === SubmissionStatus.ACCEPTED && s.rating).length || 0,
  }

  const isImage = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() || ''
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة التحكم', href: '/teacher' },
          { label: 'طلبات الشواهد' }
        ]} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonList />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'لوحة التحكم', href: '/teacher' },
        { label: 'طلبات الشواهد' }
      ]} />
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 rounded-2xl p-6 sm:p-8 border border-sky-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl shadow-lg">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-sky-900 to-blue-900 bg-clip-text text-transparent">
                  طلبات الشواهد
                </h1>
              </div>
            </div>
            <Link
              href="/teacher/submit"
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <Upload className="w-5 h-5" />
              رفع شاهد جديد
            </Link>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent mb-3"></div>
          <p className="text-sm sm:text-base text-gray-700 font-medium leading-relaxed">
            عرض جميع الشواهد المرفوعة وحالاتها
          </p>
        </div>
      </div>

      {/* تنبيه مجموع الأوزان */}
      {weightsInfo && !weightsInfo.isValid && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-800 mb-1">تحذير: مجموع الأوزان غير مكتمل</h3>
            <p className="text-red-700 text-sm">
              مجموع الأوزان للمعايير النشطة لصفة <span className="font-bold">{weightsInfo.jobTypeName}</span> هو{' '}
              <span className="font-bold">{weightsInfo.totalWeight}%</span> ولا يساوي 100%.{' '}
              <span className="font-semibold">الدرجة النهائية قد تكون غير دقيقة.</span>
            </p>
            <p className="text-red-700 text-sm mt-2 font-medium">
              الرجاء التواصل مع مدير المدرسة لتعديل أوزان المعايير.
            </p>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-10 h-10 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-yellow-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">قيد المراجعة</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">مقبولة</p>
              <p className="text-2xl font-bold text-gray-900">{stats.accepted}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-red-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">مرفوضة</p>
              <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
      </div>

      {/* Average Rating */}
      {stats.averageRating > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">متوسط التقييم</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.averageRating.toFixed(2)} / 5
              </p>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-8 h-8 ${
                    star <= Math.round(stats.averageRating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">البحث</label>
            <div className="relative">
              <FileText className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في المعايير أو الشواهد..."
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب الحالة</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                الكل ({stats.total})
              </button>
              <button
                onClick={() => setFilter(SubmissionStatus.PENDING)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === SubmissionStatus.PENDING
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                قيد المراجعة ({stats.pending})
              </button>
              <button
                onClick={() => setFilter(SubmissionStatus.ACCEPTED)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === SubmissionStatus.ACCEPTED
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                مقبولة ({stats.accepted})
              </button>
              <button
                onClick={() => setFilter(SubmissionStatus.REJECTED)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === SubmissionStatus.REJECTED
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                مرفوضة ({stats.rejected})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Submissions Cards */}
      {filteredSubmissions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="لا توجد طلبات"
          description={searchQuery || filter !== 'all' ? 'لا توجد نتائج للبحث' : 'لم تقم برفع أي شواهد بعد'}
          action={!searchQuery && filter === 'all' ? {
            label: 'رفع شاهد جديد',
            onClick: () => window.location.href = '/teacher/submit',
            variant: 'primary'
          } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubmissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  {getStatusBadge(submission.status)}
                  {submission.status === SubmissionStatus.ACCEPTED && submission.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-semibold text-gray-900">{submission.rating}/5</span>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 text-lg">{submission.kpi.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{submission.evidence.name}</p>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* File Preview */}
                <div className="relative">
                  {isImage(submission.fileUrl) ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={submission.fileUrl}
                        alt="Evidence"
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-white rounded-lg p-1.5 shadow-md">
                        <ImageIcon className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center justify-center">
                      <a
                        href={submission.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <FileText className="w-5 h-5" />
                        عرض الملف
                      </a>
                    </div>
                  )}
                </div>

                {/* Description */}
                {submission.description && (
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg line-clamp-2">
                    {submission.description}
                  </p>
                )}

                {/* Reject Reason */}
                {submission.status === SubmissionStatus.REJECTED && submission.rejectReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-800 mb-1">سبب الرفض:</p>
                        <p className="text-sm text-red-700">{submission.rejectReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-200">
                  <Calendar className="w-4 h-4" />
                  <span>تاريخ الرفع: {new Date(submission.createdAt).toLocaleDateString('ar-SA')}</span>
                  {submission.reviewedAt && (
                    <>
                      <span>•</span>
                      <span>تاريخ المراجعة: {new Date(submission.reviewedAt).toLocaleDateString('ar-SA')}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              {submission.status === SubmissionStatus.REJECTED && (
                <div className="p-4 bg-red-50 border-t border-red-200">
                  <Link
                    href="/teacher/submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    <Upload className="w-4 h-4" />
                    إعادة الرفع
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
