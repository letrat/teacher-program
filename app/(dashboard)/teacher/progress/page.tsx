'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { TrendingUp, CheckCircle, XCircle, Clock, AlertCircle, Upload, Target, Award } from 'lucide-react'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { SkeletonCard, SkeletonList } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import api from '@/lib/api'

interface KPIProgress {
  kpiId: string
  name: string
  weight: number
  score: number
  minAcceptedEvidence: number | null
  acceptedCount: number
  pendingCount: number
  rejectedCount: number
  remainingCount: number
  isAchieved: boolean
}

export default function ProgressPage() {
  const router = useRouter()
  const [kpis, setKpis] = useState<KPIProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [weightsInfo, setWeightsInfo] = useState<{
    totalWeight: number
    isValid: boolean
    jobTypeName: string
  } | null>(null)

  useEffect(() => {
    fetchProgress()
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

  const fetchProgress = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await api.teacher.progress() as { kpis?: KPIProgress[] }
      setKpis(data.kpis || [])
    } catch (error: any) {
      console.error('Error fetching progress:', error)
      const errorMessage = error.message || 'حدث خطأ في جلب بيانات التقدّم'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitEvidence = (kpiId: string) => {
    router.push(`/teacher/submit?kpiId=${kpiId}`)
  }

  // إحصائيات
  const stats = {
    total: kpis.length,
    achieved: kpis.filter(k => k.isAchieved).length,
    notAchieved: kpis.filter(k => !k.isAchieved).length,
    totalAccepted: kpis.reduce((sum, k) => sum + k.acceptedCount, 0),
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة التحكم', href: '/teacher' },
          { label: 'تقدّم المعايير' }
        ]} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonList />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة التحكم', href: '/teacher' },
          { label: 'تقدّم المعايير' }
        ]} />
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">{error}</p>
              {error.includes('Route not found') && (
                <p className="text-sm mt-2">
                  يرجى التأكد من أن Backend يعمل وإعادة تشغيله إذا لزم الأمر.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'لوحة التحكم', href: '/teacher' },
        { label: 'تقدّم المعايير' }
      ]} />
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 rounded-2xl p-6 sm:p-8 border border-rose-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-fuchsia-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-rose-900 to-pink-900 bg-clip-text text-transparent">
                  تقدّم المعايير
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
          <div className="h-px bg-gradient-to-r from-transparent via-rose-300 to-transparent mb-3"></div>
          <p className="text-sm sm:text-base text-gray-700 font-medium leading-relaxed">
            متابعة إنجازك في كل معيار والشواهد المتبقية
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
              <p className="text-sm text-gray-600 mb-1">إجمالي المعايير</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Target className="w-10 h-10 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">المعايير المحققة</p>
              <p className="text-2xl font-bold text-green-600">{stats.achieved}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-red-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">المعايير غير المحققة</p>
              <p className="text-2xl font-bold text-red-600">{stats.notAchieved}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">إجمالي الشواهد المقبولة</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalAccepted}</p>
            </div>
            <Award className="w-10 h-10 text-purple-600" />
          </div>
        </div>
      </div>

      {/* KPIs Progress Cards */}
      {kpis.length === 0 ? (
        <EmptyState
          icon={Target}
          title="لا توجد معايير"
          description="لا توجد معايير مرتبطة بصفتك الوظيفية حالياً"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {kpis.map((kpi) => {
            const minRequired = kpi.minAcceptedEvidence
            const hasMinRequirement = minRequired !== null && minRequired > 0
            const progressPercentage = hasMinRequirement 
              ? Math.min(100, (kpi.acceptedCount / minRequired) * 100)
              : kpi.acceptedCount > 0 ? 100 : 0

            return (
              <div
                key={kpi.kpiId}
                className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${
                  kpi.isAchieved 
                    ? 'border-green-200' 
                    : 'border-red-200'
                }`}
              >
                {/* Card Header */}
                <div className={`p-4 ${
                  kpi.isAchieved 
                    ? 'bg-green-50 border-b border-green-200' 
                    : 'bg-red-50 border-b border-red-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{kpi.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        {kpi.isAchieved ? (
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
                        <span className="text-xs text-gray-600">الوزن: {kpi.weight}%</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-2xl font-bold text-gray-900">
                        {kpi.score.toFixed(2)} / 5
                      </div>
                      <div className="text-xs text-gray-500">الدرجة الحالية</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {hasMinRequirement && (
                  <div className="px-4 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">تقدّم الإنجاز</span>
                      <span className="text-sm text-gray-600">
                        {kpi.acceptedCount} / {minRequired}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          kpi.isAchieved ? 'bg-green-600' : 'bg-orange-500'
                        }`}
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Evidence Counts */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-medium text-green-800">مقبولة</span>
                      </div>
                      <div className="text-xl font-bold text-green-700">{kpi.acceptedCount}</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-xs font-medium text-yellow-800">قيد المراجعة</span>
                      </div>
                      <div className="text-xl font-bold text-yellow-700">{kpi.pendingCount}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-medium text-red-800">مرفوضة</span>
                      </div>
                      <div className="text-xl font-bold text-red-700">{kpi.rejectedCount}</div>
                    </div>
                  </div>

                  {/* Minimum Requirement */}
                  {hasMinRequirement && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">الحد الأدنى المطلوب:</span>
                        <span className="text-sm font-bold text-gray-900">{minRequired} شاهد</span>
                      </div>
                      {kpi.remainingCount > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                          <span className="text-sm text-orange-700">
                            متبقي: <span className="font-bold">{kpi.remainingCount}</span> شاهد
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Warning Message */}
                  {!kpi.isAchieved && hasMinRequirement && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-red-800 mb-1">
                            لم يتحقق الحد الأدنى لعدد الشواهد المقبولة
                          </p>
                          <p className="text-xs text-red-700">
                            {kpi.remainingCount > 0 
                              ? `يرجى رفع ${kpi.remainingCount} شاهد${kpi.remainingCount > 1 ? 'ات' : ''} إضافي${kpi.remainingCount > 1 ? 'ة' : ''} لتحقيق هذا المعيار.`
                              : 'يرجى رفع شواهد إضافية لتحقيق هذا المعيار.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  {!kpi.isAchieved && (
                    <button
                      onClick={() => handleSubmitEvidence(kpi.kpiId)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Upload className="w-4 h-4" />
                      رفع شاهد جديد لهذا المعيار
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

