'use client'

import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import api from '@/lib/api'

interface KPIDetail {
  kpiId: string
  name: string
  weight: number
  score: number
  approvedEvidenceCount: number
  pendingEvidenceCount: number
  rejectedEvidenceCount: number
}

interface DashboardData {
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

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const data = await api.teacher.dashboard()
      setData(data as DashboardData)
    } catch (error: any) {
      setError(error.message || 'حدث خطأ في جلب البيانات')
      console.error('Error:', error)
    } finally {
      setLoading(false)
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
      </div>
    )
  }

  if (!data) {
    return <div className="p-6">لا توجد بيانات</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">لوحة التحكم</h1>

      {/* تنبيه مجموع الأوزان */}
      {data.weightsInfo && !data.weightsInfo.isValid && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3 mb-6">
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
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm text-gray-500 mb-2">الدرجة النهائية</div>
          <div className="text-3xl font-bold text-blue-600">
            {data.overallScore.toFixed(2)} / 5
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm text-gray-500 mb-2">النسبة المئوية</div>
          <div className="text-3xl font-bold text-green-600">
            {data.overallPercentage.toFixed(2)}%
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm text-gray-500 mb-2">الصفة الوظيفية</div>
          <div className="text-xl font-semibold text-gray-900">
            {data.jobType}
          </div>
        </div>
      </div>

      {/* تفاصيل المعايير */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">تفاصيل المعايير</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  المعيار
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  الوزن
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  الدرجة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  الشواهد المقبولة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  قيد المراجعة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  المرفوضة
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.kpis.map((kpi) => (
                <tr key={kpi.kpiId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {kpi.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {kpi.weight}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-semibold text-gray-900">
                        {kpi.score.toFixed(2)} / 5
                      </span>
                      <div className="mr-2 w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(kpi.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                    {kpi.approvedEvidenceCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                    {kpi.pendingEvidenceCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    {kpi.rejectedEvidenceCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}





