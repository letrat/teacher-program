'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/dashboard/Card'
import Chart from '@/components/dashboard/Chart'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { Clock, CheckCircle, XCircle, TrendingUp, Award, AlertCircle } from 'lucide-react'
import { chartColors } from '@/lib/chart-config'
import Link from 'next/link'

interface DashboardData {
  stats: {
    pending: number
    accepted: number
    rejected: number
  }
  overallScore: {
    score: number
    percentage: number
  }
  kpiScores: Array<{
    kpiName: string
    score: number
    weight: number
  }>
  weightsInfo?: {
    totalWeight: number
    isValid: boolean
    jobTypeName: string
  }
}

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const dashboardData = await api.teacher.dashboard()
      setData(dashboardData as DashboardData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
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

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">لا توجد بيانات</div>
      </div>
    )
  }

  // إعداد بيانات الرسم البياني
  const kpiScoresChartData = {
    labels: data.kpiScores.map((k) => k.kpiName),
    datasets: [
      {
        label: 'الدرجة',
        data: data.kpiScores.map((k) => k.score),
        backgroundColor: chartColors.primary,
        borderRadius: 8,
      },
    ],
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'لوحة التحكم' }
      ]} />
      {/* العنوان */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl p-6 sm:p-8 border border-emerald-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <Award className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-emerald-900 to-teal-900 bg-clip-text text-transparent">
                لوحة تحكم المعلم
              </h1>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent mb-3"></div>
          <p className="text-sm sm:text-base text-gray-700 font-medium leading-relaxed">
            نظرة شاملة على أدائك والشواهد المرفوعة
          </p>
        </div>
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
            <p className="text-red-700 text-sm mt-2 font-medium">
              الرجاء التواصل مع مدير المدرسة لتعديل أوزان المعايير.
            </p>
          </div>
        </div>
      )}

      {/* الدرجة النهائية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="الدرجة النهائية"
          value={`${data.overallScore.score.toFixed(2)} / 5`}
          icon={Award}
          iconColor="text-blue-600"
        >
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">النسبة المئوية</span>
              <span className="font-semibold text-gray-900">
                {data.overallScore.percentage.toFixed(2)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  data.overallScore.percentage >= 80
                    ? 'bg-green-600'
                    : data.overallScore.percentage >= 60
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
                }`}
                style={{ width: `${data.overallScore.percentage}%` }}
              />
            </div>
          </div>
        </Card>

        {/* بطاقات سريعة */}
        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/teacher/submit"
            className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">رفع شاهد جديد</h3>
                <p className="text-sm text-gray-600 mt-1">إضافة شاهد جديد للمعايير</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </Link>
          <Link
            href="/teacher/submissions"
            className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">طلباتي</h3>
                <p className="text-sm text-gray-600 mt-1">عرض جميع الشواهد المرفوعة</p>
              </div>
              <Award className="w-8 h-8 text-green-600" />
            </div>
          </Link>
        </div>
      </div>

      {/* البطاقات الإحصائية */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card
          title="قيد المراجعة"
          value={data.stats.pending}
          icon={Clock}
          iconColor="text-yellow-600"
        />
        <Card
          title="مقبولة"
          value={data.stats.accepted}
          icon={CheckCircle}
          iconColor="text-green-600"
        />
        <Card
          title="مرفوضة"
          value={data.stats.rejected}
          icon={XCircle}
          iconColor="text-red-600"
        />
      </div>

      {/* الرسم البياني */}
      {data.kpiScores.length > 0 && (
        <Chart
          type="bar"
          data={kpiScoresChartData}
          height={300}
          options={{
            plugins: {
              title: {
                display: true,
                text: 'أداء المعايير',
                font: { size: 18, weight: 'bold' },
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
      )}
    </div>
  )
}


