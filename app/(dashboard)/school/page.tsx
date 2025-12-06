'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Card from '@/components/dashboard/Card'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { Users, Clock, CheckCircle, XCircle, TrendingUp, TrendingDown, Award, AlertCircle } from 'lucide-react'
import { chartColors } from '@/lib/chart-config'

const Chart = dynamic(() => import('@/components/dashboard/Chart'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full flex items-center justify-center bg-gray-50 rounded-xl">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
})

interface DashboardStats {
  stats: {
    teachersCount: number
    pendingCount: number
    acceptedCount: number
    rejectedCount: number
    averageScore: number
    averagePercentage: number
  }
  topTeachers: Array<{
    id: string
    name: string
    jobType: string
    overallScore: number
    overallPercentage: number
  }>
  bottomTeachers: Array<{
    id: string
    name: string
    jobType: string
    overallScore: number
    overallPercentage: number
  }>
}

interface ChartsData {
  evidenceStatus: {
    labels: string[]
    data: number[]
  }
  scoreDistribution: {
    labels: string[]
    data: number[]
  }
}

export default function SchoolDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartsData, setChartsData] = useState<ChartsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobTypesWeights, setJobTypesWeights] = useState<Array<{
    jobTypeId: string
    jobTypeName: string
    totalWeight: number
    isValid: boolean
  }>>([])

  useEffect(() => {
    fetchDashboardData()
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

  const fetchDashboardData = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const [statsData, chartsData] = await Promise.all([
        api.school.dashboard.stats(),
        api.school.dashboard.charts(),
      ])

      setStats(statsData as DashboardStats)
      setChartsData(chartsData as ChartsData)
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error)
      // If it's an auth error, the api.ts will handle redirect
      // Otherwise, show error message
      if (!error.message?.includes('انتهت صلاحية')) {
        // Error will be shown in the UI
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">جاري التحميل...</div>
      </div>
    )
  }

  if (!stats || !chartsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">حدث خطأ في تحميل البيانات</div>
      </div>
    )
  }

  // إعداد بيانات الرسم البياني الدائري
  const evidenceStatusChartData = {
    labels: chartsData.evidenceStatus.labels,
    datasets: [
      {
        data: chartsData.evidenceStatus.data,
        backgroundColor: [
          chartColors.warning,
          chartColors.success,
          chartColors.danger,
        ],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  }

  // إعداد بيانات الرسم البياني العمودي
  const scoreDistributionChartData = {
    labels: chartsData.scoreDistribution.labels,
    datasets: [
      {
        label: 'عدد المعلمين',
        data: chartsData.scoreDistribution.data,
        backgroundColor: chartColors.primary,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <Breadcrumbs items={[
        { label: 'لوحة المدرسة' }
      ]} />
      {/* العنوان */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-blue-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                لوحة المدرسة
              </h1>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent mb-3"></div>
          <p className="text-xs sm:text-sm md:text-base text-gray-700 font-medium leading-relaxed">
            نظرة شاملة على أداء المدرسة والمعلمين
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

      {/* البطاقات الإحصائية */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="المعلمين النشطين"
          value={stats.stats.teachersCount}
          icon={Users}
          iconColor="text-blue-600"
        />
        <Card
          title="شواهد قيد المراجعة"
          value={stats.stats.pendingCount}
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <Card
          title="شواهد مقبولة"
          value={stats.stats.acceptedCount}
          icon={CheckCircle}
          iconColor="text-green-600"
        />
        <Card
          title="شواهد مرفوضة"
          value={stats.stats.rejectedCount}
          icon={XCircle}
          iconColor="text-red-600"
        />
      </div>

      {/* بطاقة متوسط الدرجة */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-2">
        <Card
          title="متوسط الدرجة النهائية"
          value={`${stats.stats.averageScore.toFixed(2)} / 5`}
          icon={TrendingUp}
          iconColor="text-blue-600"
        >
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">النسبة المئوية</span>
              <span className="font-semibold text-gray-900">
                {stats.stats.averagePercentage.toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${stats.stats.averagePercentage}%` }}
              />
            </div>
          </div>
        </Card>

        {/* بطاقات سريعة */}
        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/school/review"
            className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">مراجعة الشواهد</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {stats.stats.pendingCount} شاهد قيد المراجعة
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </Link>
          <Link
            href="/school/teachers/scores"
            className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">أداء المعلمين</h3>
                <p className="text-sm text-gray-600 mt-1">عرض جميع الدرجات</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </Link>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-2">
        <Chart
          type="doughnut"
          data={evidenceStatusChartData}
          height={300}
          options={{
            plugins: {
              title: {
                display: true,
                text: 'توزيع حالات الشواهد',
                font: { size: 16, weight: 'bold' },
              },
            },
          }}
        />
        <Chart
          type="bar"
          data={scoreDistributionChartData}
          height={300}
          options={{
            plugins: {
              title: {
                display: true,
                text: 'توزيع الدرجات',
                font: { size: 16, weight: 'bold' },
              },
            },
          }}
        />
      </div>

      {/* أفضل المعلمين والمعلمين الأقل أداءً */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-2">
        {/* أفضل المعلمين */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">أفضل المعلمين</h2>
            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
          </div>
          {stats.topTeachers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              لا توجد بيانات كافية
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topTeachers.map((teacher, index) => (
                <Link
                  key={teacher.id}
                  href={`/school/teachers/${teacher.id}/score`}
                  className="flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold ml-2 sm:ml-3 flex-shrink-0 text-sm sm:text-base">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 truncate text-sm sm:text-base">{teacher.name}</div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate">{teacher.jobType}</div>
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0 mr-2 sm:mr-0">
                    <div className="font-semibold text-gray-900 text-sm sm:text-base">
                      {teacher.overallScore.toFixed(2)} / 5
                    </div>
                    <div className="text-xs sm:text-sm text-green-600">
                      {teacher.overallPercentage.toFixed(1)}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* المعلمين الأقل أداءً */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">المعلمين الأقل أداءً</h2>
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
          </div>
          {stats.bottomTeachers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              لا توجد بيانات كافية
            </div>
          ) : (
            <div className="space-y-3">
              {stats.bottomTeachers.map((teacher, index) => (
                <Link
                  key={teacher.id}
                  href={`/school/teachers/${teacher.id}/score`}
                  className="flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold ml-2 sm:ml-3 flex-shrink-0 text-sm sm:text-base">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 truncate text-sm sm:text-base">{teacher.name}</div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate">{teacher.jobType}</div>
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0 mr-2 sm:mr-0">
                    <div className="font-semibold text-gray-900 text-sm sm:text-base">
                      {teacher.overallScore.toFixed(2)} / 5
                    </div>
                    <div className="text-xs sm:text-sm text-orange-600">
                      {teacher.overallPercentage.toFixed(1)}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
