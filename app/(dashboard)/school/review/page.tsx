'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Clock, User, FileText, Calendar, CheckCircle, XCircle, Search, Star, X, Maximize2, AlertCircle } from 'lucide-react'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { SkeletonList } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import api from '@/lib/api'

interface Submission {
  id: string
  fileUrl: string
  description?: string
  createdAt: string
  teacher: {
    id: string
    name: string
    jobType: {
      id: string
      name: string
    } | null
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

export default function ReviewPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [quickRating, setQuickRating] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [filter, setFilter] = useState({
    teacher: '',
    kpi: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const rejectReasonRef = useRef<HTMLTextAreaElement>(null)
  const [jobTypesWeights, setJobTypesWeights] = useState<Array<{
    jobTypeId: string
    jobTypeName: string
    totalWeight: number
    isValid: boolean
  }>>([])

  useEffect(() => {
    fetchSubmissions()
    fetchJobTypesWeights()
  }, [])

  const fetchJobTypesWeights = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const data = await api.school.teachers.scores() as { teachers: any[]; jobTypesWeights?: Array<{
        jobTypeId: string
        jobTypeName: string
        totalWeight: number
        isValid: boolean
      }> }
      if (data.jobTypesWeights) {
        setJobTypesWeights(data.jobTypesWeights)
      }
    } catch (error) {
      // Silently fail - weights info is optional
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!selectedSubmission) return

      // Number keys 1-5 for quick rating
      if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey) {
        const rating = parseInt(e.key)
        handleQuickAccept(rating)
      }

      // Escape to close
      if (e.key === 'Escape') {
        setSelectedSubmission(null)
        setQuickRating(null)
        setRejectReason('')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedSubmission])

  const fetchSubmissions = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const data = await api.school.evidence.pending()
      // Handle pagination response
      const submissionsList = Array.isArray(data) ? data : ((data as any)?.data || [])
      setSubmissions(submissionsList)
    } catch (error) {
      toast.error('حدث خطأ في جلب الشواهد')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAccept = async (rating: number) => {
    if (!selectedSubmission) return

    setSubmitting(true)
    try {
      const api = (await import('@/lib/api')).default
      await api.school.evidence.review(selectedSubmission.id, {
        action: 'accept',
        rating,
      })
      toast.success(`تم قبول الشاهد بتقييم ${rating}/5`)
      setSubmissions(submissions.filter(s => s.id !== selectedSubmission.id))
      setSelectedSubmission(null)
      setQuickRating(null)
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في تقييم الشاهد')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickReject = async () => {
    if (!selectedSubmission || !rejectReason.trim()) {
      toast.error('يرجى كتابة سبب الرفض')
      rejectReasonRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      await api.school.evidence.review(selectedSubmission.id, {
        action: 'reject',
        rejectReason,
      })
      toast.success('تم رفض الشاهد')
      setSubmissions(submissions.filter(s => s.id !== selectedSubmission.id))
      setSelectedSubmission(null)
      setRejectReason('')
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في رفض الشاهد')
    } finally {
      setSubmitting(false)
    }
  }

  const isImage = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() || ''
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
  }

  const filteredSubmissions = submissions.filter((submission) => {
    if (filter.teacher && !submission.teacher.name.toLowerCase().includes(filter.teacher.toLowerCase())) return false
    if (filter.kpi && !submission.kpi.name.toLowerCase().includes(filter.kpi.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة المدرسة', href: '/school' },
          { label: 'مراجعة الشواهد' }
        ]} />
        <SkeletonList />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Breadcrumbs items={[
        { label: 'لوحة المدرسة', href: '/school' },
        { label: 'مراجعة الشواهد' }
      ]} />
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 rounded-2xl p-6 sm:p-8 border border-violet-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-fuchsia-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
              <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-violet-900 to-purple-900 bg-clip-text text-transparent">
                مراجعة الشواهد
              </h1>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent mb-3"></div>
          <p className="text-sm sm:text-base text-gray-700 font-medium leading-relaxed">
            مراجعة وتقييم الشواهد المرفوعة من المعلمين ({filteredSubmissions.length} قيد المراجعة)
          </p>
        </div>
      </div>

      {/* تنبيهات مجموع الأوزان */}
      {jobTypesWeights.filter(jtw => !jtw.isValid).length > 0 && (
        <div className="space-y-3">
          {jobTypesWeights
            .filter(jtw => !jtw.isValid)
            .map((jobTypeWeight) => (
              <div key={jobTypeWeight.jobTypeId} className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 mb-1">تحذير: مجموع الأوزان غير مكتمل</h3>
                  <p className="text-red-700 text-sm">
                    مجموع الأوزان للمعايير النشطة لصفة <span className="font-bold">{jobTypeWeight.jobTypeName}</span> هو{' '}
                    <span className="font-bold">{jobTypeWeight.totalWeight}%</span> ولا يساوي 100%.{' '}
                    <span className="font-semibold">الدرجات النهائية للمعلمين بهذه الصفة قد تكون غير دقيقة.</span>
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={filter.teacher}
              onChange={(e) => setFilter({ ...filter, teacher: e.target.value })}
              placeholder="البحث بالمعلم..."
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={filter.kpi}
              onChange={(e) => setFilter({ ...filter, kpi: e.target.value })}
              placeholder="البحث بالمعيار..."
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: Submissions List */}
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">قائمة الشواهد</h2>
          {filteredSubmissions.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="لا توجد شواهد قيد المراجعة"
              description={filter.teacher || filter.kpi ? 'لا توجد نتائج للبحث' : 'جميع الشواهد تمت مراجعتها'}
            />
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
              {filteredSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  onClick={() => {
                    setSelectedSubmission(submission)
                    setQuickRating(null)
                    setRejectReason('')
                  }}
                  className={`bg-white rounded-xl shadow-md p-3 sm:p-4 cursor-pointer transition-all border-2 ${
                    selectedSubmission?.id === submission.id
                      ? 'border-blue-600 shadow-lg'
                      : 'border-transparent hover:border-gray-300 hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center ml-2 sm:ml-3 flex-shrink-0">
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{submission.teacher.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{submission.teacher.jobType?.name || 'بدون صفة'}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full font-medium flex-shrink-0">
                      قيد المراجعة
                    </span>
                  </div>

                  <div className="space-y-1 text-xs sm:text-sm text-gray-600 mb-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="font-medium flex-shrink-0">المعيار:</span>
                      <span className="truncate">{submission.kpi.name}</span>
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="font-medium flex-shrink-0">الشاهد:</span>
                      <span className="truncate">{submission.evidence.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span>{new Date(submission.createdAt).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </div>

                  {submission.description && (
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded line-clamp-2">
                      {submission.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Submission Details */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:sticky lg:top-6">
          {!selectedSubmission ? (
            <EmptyState
              icon={FileText}
              title="اختر شاهد للمراجعة"
              description="اضغط على أي شاهد من القائمة لبدء المراجعة"
            />
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3 sm:pb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">تفاصيل الشاهد</h2>
                <button
                  onClick={() => {
                    setSelectedSubmission(null)
                    setQuickRating(null)
                    setRejectReason('')
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Teacher Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{selectedSubmission.teacher.name}</div>
                    <div className="text-sm text-gray-600">
                      {selectedSubmission.teacher.jobType?.name || 'بدون صفة'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">المعيار:</span>
                    <span className="mr-2 font-medium">{selectedSubmission.kpi.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">الشاهد:</span>
                    <span className="mr-2 font-medium">{selectedSubmission.evidence.name}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">التاريخ:</span>
                    <span className="mr-2">
                      {new Date(selectedSubmission.createdAt).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {selectedSubmission.description && (
                    <div className="col-span-2">
                      <span className="text-gray-600">الوصف:</span>
                      <p className="mr-2 mt-1">{selectedSubmission.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* File Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">المرفق</label>
                {isImage(selectedSubmission.fileUrl) ? (
                  <div className="relative border border-gray-300 rounded-lg overflow-hidden">
                    <img
                      src={selectedSubmission.fileUrl}
                      alt="Evidence"
                      className="w-full h-auto max-h-96 object-contain cursor-pointer"
                      onClick={() => setImageViewerOpen(true)}
                    />
                    <button
                      onClick={() => setImageViewerOpen(true)}
                      className="absolute top-2 left-2 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
                      title="تكبير"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded-lg p-4">
                    <a
                      href={selectedSubmission.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline flex items-center gap-2"
                    >
                      <FileText className="w-5 h-5" />
                      عرض الملف
                    </a>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    التقييم السريع (اضغط 1-5 على لوحة المفاتيح)
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => handleQuickAccept(rating)}
                        disabled={submitting}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          quickRating === rating
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Star className={`w-6 h-6 ${quickRating === rating ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className="text-sm font-semibold text-gray-900">{rating}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reject Section */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">رفض الشاهد</label>
                  <textarea
                    ref={rejectReasonRef}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="اكتب سبب الرفض..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-3"
                    rows={3}
                  />
                  <button
                    onClick={handleQuickReject}
                    disabled={submitting || !rejectReason.trim()}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    رفض الشاهد
                  </button>
                </div>
              </div>

              {/* Keyboard Shortcuts Hint */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>اختصارات لوحة المفاتيح:</strong>
                <ul className="mt-1 space-y-1 mr-4">
                  <li>• اضغط 1-5 للقبول السريع</li>
                  <li>• اضغط ESC للإغلاق</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {imageViewerOpen && selectedSubmission && isImage(selectedSubmission.fileUrl) && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setImageViewerOpen(false)}
        >
          <button
            onClick={() => setImageViewerOpen(false)}
            className="absolute top-4 left-4 p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedSubmission.fileUrl}
            alt="Evidence"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
