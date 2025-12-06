'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Settings, CheckCircle, AlertCircle, XCircle, Save, RotateCcw } from 'lucide-react'
import api from '@/lib/api'

interface KPIWeight {
  kpiId: string
  name: string
  weight: number
  isActive: boolean
  isOfficial: boolean
}

export default function WeightsPage() {
  const params = useParams()
  const router = useRouter()
  const jobTypeId = params.jobTypeId as string

  const [jobType, setJobType] = useState<{ id: string; name: string } | null>(null)
  const [kpis, setKpis] = useState<KPIWeight[]>([])
  const [totalWeight, setTotalWeight] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchData()
  }, [jobTypeId])

  const fetchData = async () => {
    try {
      // جلب معلومات الصفة
      const jobTypes = await api.school.jobTypes.list()
      const foundJobType = (jobTypes as { id: string; name: string }[]).find((jt: any) => jt.id === jobTypeId)
      setJobType(foundJobType || null)

      // جلب الأوزان
      const data = await api.school.jobTypes.weights(jobTypeId) as { kpis: KPIWeight[]; totalWeight: number }
      setKpis(data.kpis || [])
      setTotalWeight(data.totalWeight || 0)
    } catch (error: any) {
      setError(error.message || 'حدث خطأ في جلب البيانات')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWeightChange = (kpiId: string, newWeight: number) => {
    setKpis((prev) =>
      prev.map((kpi) =>
        kpi.kpiId === kpiId ? { ...kpi, weight: newWeight } : kpi
      )
    )
    setError('')
    setSuccess('')
  }

  const handleActiveChange = (kpiId: string, isActive: boolean) => {
    setKpis((prev) =>
      prev.map((kpi) =>
        kpi.kpiId === kpiId ? { ...kpi, isActive } : kpi
      )
    )
    setError('')
    setSuccess('')
  }

  useEffect(() => {
    const activeKPIs = kpis.filter((k) => k.isActive)
    const total = activeKPIs.reduce((sum, k) => sum + k.weight, 0)
    setTotalWeight(total)
  }, [kpis])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const weights = kpis.map((kpi) => ({
        kpiId: kpi.kpiId,
        weight: kpi.weight,
        isActive: kpi.isActive,
      }))

      await api.school.jobTypes.updateWeights(jobTypeId, weights)
      setSuccess('تم حفظ الأوزان بنجاح')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError('حدث خطأ في حفظ الأوزان')
      console.error('Error:', error)
    } finally {
      setSaving(false)
    }
  }

  const isValid = Math.abs(totalWeight - 100) < 0.01

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/school/kpis"
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group"
          >
            <ArrowRight className="w-5 h-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">رجوع</span>
          </Link>
          <div className="h-6 w-px bg-gray-300" />
          <div>
            <nav className="text-sm text-gray-500 mb-1 flex items-center gap-2">
              <Link href="/school/kpis" className="hover:text-gray-700 transition-colors">
                المعايير
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{jobType?.name}</span>
            </nav>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-600" />
              إدارة أوزان المعايير
            </h1>
            <p className="text-gray-600 mt-1">الصفة الوظيفية: {jobType?.name}</p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Weight Summary Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-900 block">مجموع الأوزان</span>
              <span className="text-sm text-gray-600">للمعايير النشطة فقط</span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-4xl font-bold block ${
                isValid ? 'text-green-600' : totalWeight > 100 ? 'text-red-600' : 'text-orange-600'
              }`}
            >
              {totalWeight.toFixed(2)}%
            </span>
            <span className="text-sm text-gray-500">من 100%</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-6 mb-4 overflow-hidden shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 ${
              isValid
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : totalWeight > 100
                ? 'bg-gradient-to-r from-red-500 to-red-600'
                : 'bg-gradient-to-r from-orange-500 to-orange-600'
            }`}
            style={{
              width: `${Math.min(100, (totalWeight / 100) * 100)}%`,
            }}
          >
            {totalWeight > 5 && (
              <span className="text-xs font-bold text-white">
                {totalWeight.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Status Message */}
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          isValid
            ? 'bg-green-100 text-green-800'
            : totalWeight > 100
            ? 'bg-red-100 text-red-800'
            : 'bg-orange-100 text-orange-800'
        }`}>
          {isValid ? (
            <>
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">الأوزان متوازنة - جاهز للحفظ</span>
            </>
          ) : totalWeight > 100 ? (
            <>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">
                مجموع الأوزان يتجاوز 100%! الرجاء تقليل الأوزان بمقدار <strong>{(totalWeight - 100).toFixed(2)}%</strong>
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">
                مجموع الأوزان أقل من 100%! الرجاء إضافة <strong>{(100 - totalWeight).toFixed(2)}%</strong> أخرى
              </span>
            </>
          )}
        </div>
      </div>

      {/* KPIs Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  اسم المعيار
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  الوزن (%)
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  النوع
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {kpis.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    لا توجد معايير متاحة لهذه الصفة الوظيفية
                  </td>
                </tr>
              ) : (
                kpis.map((kpi) => (
                  <tr
                    key={kpi.kpiId}
                    className={`hover:bg-gray-50 transition-colors ${
                      !kpi.isActive ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          kpi.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`} />
                        <span className="text-sm font-medium text-gray-900">
                          {kpi.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={kpi.weight}
                          onChange={(e) => {
                            const val = Number(e.target.value)
                            if (val >= 0 && val <= 100) {
                              handleWeightChange(kpi.kpiId, val)
                            }
                          }}
                          className={`w-28 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${
                            !kpi.isActive
                              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                          }`}
                          disabled={!kpi.isActive}
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={kpi.isActive}
                          onChange={(e) =>
                            handleActiveChange(kpi.kpiId, e.target.checked)
                          }
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className={`mr-2 text-sm font-medium ${
                          kpi.isActive ? 'text-green-700' : 'text-gray-500'
                        }`}>
                          {kpi.isActive ? 'نشط' : 'معطل'}
                        </span>
                      </label>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                          kpi.isOfficial
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {kpi.isOfficial ? 'رسمي' : 'خاص'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Link
          href="/school/kpis"
          className="flex items-center gap-2 px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowRight className="w-5 h-5 rotate-180" />
          <span>رجوع إلى المعايير</span>
        </Link>
        
        <button
          onClick={handleSave}
          disabled={saving || !isValid}
          className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all shadow-lg ${
            isValid && !saving
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white hover:shadow-xl transform hover:-translate-y-0.5'
              : 'bg-gray-400 cursor-not-allowed text-white'
          }`}
        >
          {saving ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>جاري الحفظ...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>حفظ الأوزان</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
