'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

interface KPI {
  id: string
  name: string
  weight: number
  _count: {
    evidenceItems: number
  }
}

interface JobType {
  id: string
  name: string
}

export default function KPIsPage() {
  const params = useParams()
  const router = useRouter()
  const jobTypeId = params.id as string

  const [jobType, setJobType] = useState<JobType | null>(null)
  const [kpis, setKpis] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState<string | null>(null)
  const [showEvidenceModal, setShowEvidenceModal] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', weight: 0, minAcceptedEvidence: null as number | null })
  const [editData, setEditData] = useState({ name: '', weight: 0, minAcceptedEvidence: null as number | null })
  const [evidenceName, setEvidenceName] = useState('')
  const [totalWeight, setTotalWeight] = useState(0)

  useEffect(() => {
    fetchData()
  }, [jobTypeId])

  const fetchData = async () => {
    try {
      const [jobTypes, kpisData] = await Promise.all([
        api.admin.jobTypes.list(),
        api.admin.jobTypes.kpis(jobTypeId),
      ])

      const foundJobType = (jobTypes as JobType[]).find((jt: JobType) => jt.id === jobTypeId)
      setJobType(foundJobType || null)
      setKpis(kpisData as KPI[])
      
      // حساب مجموع الأوزان
      const total = (kpisData as KPI[]).reduce((sum: number, kpi: KPI) => sum + kpi.weight, 0)
      setTotalWeight(total)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.admin.jobTypes.createKpi(jobTypeId, formData)
      setShowModal(false)
      setFormData({ name: '', weight: 0, minAcceptedEvidence: null })
      fetchData()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في إضافة المعيار')
    }
  }

  const handleEdit = (kpi: KPI) => {
    setEditData({ name: kpi.name, weight: kpi.weight, minAcceptedEvidence: (kpi as any).minAcceptedEvidence || null })
    setShowEditModal(kpi.id)
  }

  // حساب مجموع الأوزان بدون المعيار الحالي (للتعديل)
  const getTotalWeightExcluding = (excludeId: string) => {
    return kpis
      .filter((kpi) => kpi.id !== excludeId)
      .reduce((sum, kpi) => sum + kpi.weight, 0)
  }

  const handleUpdate = async (kpiId: string) => {
    try {
      await api.admin.kpis.update(kpiId, editData)
      setShowEditModal(null)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في تحديث المعيار')
    }
  }

  const handleAddEvidence = async (kpiId: string) => {
    if (!evidenceName.trim()) {
      alert('يرجى إدخال اسم الشاهد')
      return
    }

    try {
      await api.admin.kpis.createEvidence(kpiId, { name: evidenceName })
      setShowEvidenceModal(null)
      setEvidenceName('')
      fetchData()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في إضافة الشاهد')
    }
  }

  const handleDeleteKPI = async (kpiId: string, kpiName: string) => {
    if (!confirm(`هل أنت متأكد من حذف المعيار "${kpiName}"؟ سيتم حذف جميع الشواهد المرتبطة به أيضاً.`)) {
      return
    }

    try {
      await api.admin.kpis.delete(kpiId)
      alert('تم حذف المعيار وجميع الشواهد المرتبطة به بنجاح')
      fetchData()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في حذف المعيار')
    }
  }

  if (loading) {
    return <div className="p-6">جاري التحميل...</div>
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <nav className="text-sm text-gray-500 mb-4">
          <Link href="/admin/job-types" className="hover:text-gray-700">
            صفات الموظفين
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{jobType?.name}</span>
        </nav>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            معايير: {jobType?.name}
          </h1>
          <div className="mt-2 text-sm text-gray-600">
            مجموع الأوزان: <span className={`font-bold ${totalWeight > 100 ? 'text-red-600' : totalWeight === 100 ? 'text-green-600' : 'text-orange-600'}`}>
              {totalWeight.toFixed(2)}%
            </span>
            {totalWeight > 100 && (
              <span className="mr-2 text-red-600">⚠️ يتجاوز الحد الأقصى!</span>
            )}
            {totalWeight < 100 && totalWeight > 0 && (
              <span className="mr-2 text-orange-600">⚠️ لم يصل للحد الأقصى</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          إضافة معيار جديد
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {kpis.map((kpi) => (
            <li key={kpi.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">⭐</span>
                    </div>
                    <div className="mr-4">
                      <div className="text-sm font-medium text-gray-900">{kpi.name}</div>
                      <div className="text-sm text-gray-500">
                        الوزن: {kpi.weight}% • {kpi._count.evidenceItems} شاهد
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <button
                      onClick={() => handleEdit(kpi)}
                      className="text-sm text-green-600 hover:text-green-800"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => setShowEvidenceModal(kpi.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      إضافة شاهد
                    </button>
                    <Link
                      href={`/admin/kpis/${kpi.id}/evidence`}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      عرض الشواهد →
                    </Link>
                    <button
                      onClick={() => handleDeleteKPI(kpi.id, kpi.name)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">إضافة معيار جديد</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم المعيار
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الوزن (0-100%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                />
                <div className="mt-1 text-xs text-gray-500">
                  المجموع الحالي: {totalWeight}% + {formData.weight}% = <span className={`font-bold ${(totalWeight + formData.weight) > 100 ? 'text-red-600' : 'text-gray-700'}`}>
                    {(totalWeight + formData.weight).toFixed(2)}%
                  </span>
                  {(totalWeight + formData.weight) > 100 && (
                    <span className="mr-1 text-red-600">⚠️ سيتجاوز 100%!</span>
                  )}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الحد الأدنى لعدد الشواهد المقبولة <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.minAcceptedEvidence || ''}
                  onChange={(e) => setFormData({ ...formData, minAcceptedEvidence: e.target.value ? Number(e.target.value) : null })}
                  placeholder="مثال: 3"
                />
                <div className="mt-1 text-xs text-gray-500">
                  عدد الشواهد المقبولة التي يجب أن يرفعها الموظف في هذا المعيار حتى يُعتبر المعيار محققًا. يتم احتساب الشواهد المقبولة فقط، ولا تُحتسب الشواهد المرفوضة أو قيد المراجعة.
                </div>
              </div>
              <div className="flex justify-end space-x-2 space-x-reverse">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">تعديل المعيار</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم المعيار
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الوزن (0-100%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={editData.weight}
                onChange={(e) => setEditData({ ...editData, weight: Number(e.target.value) })}
              />
              {showEditModal && (
                <div className="mt-1 text-xs text-gray-500">
                  المجموع الحالي: {getTotalWeightExcluding(showEditModal).toFixed(2)}% + {editData.weight}% = <span className={`font-bold ${(getTotalWeightExcluding(showEditModal) + editData.weight) > 100 ? 'text-red-600' : 'text-gray-700'}`}>
                    {(getTotalWeightExcluding(showEditModal) + editData.weight).toFixed(2)}%
                  </span>
                  {(getTotalWeightExcluding(showEditModal) + editData.weight) > 100 && (
                    <span className="mr-1 text-red-600">⚠️ سيتجاوز 100%!</span>
                  )}
                </div>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الحد الأدنى لعدد الشواهد المقبولة <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={editData.minAcceptedEvidence || ''}
                onChange={(e) => setEditData({ ...editData, minAcceptedEvidence: e.target.value ? Number(e.target.value) : null })}
                placeholder="مثال: 3"
              />
              <div className="mt-1 text-xs text-gray-500">
                عدد الشواهد المقبولة التي يجب أن يرفعها الموظف في هذا المعيار حتى يُعتبر المعيار محققًا. يتم احتساب الشواهد المقبولة فقط، ولا تُحتسب الشواهد المرفوضة أو قيد المراجعة.
              </div>
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse">
              <button
                type="button"
                onClick={() => setShowEditModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleUpdate(showEditModal)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {showEvidenceModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">إضافة شاهد جديد</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم الشاهد
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={evidenceName}
                onChange={(e) => setEvidenceName(e.target.value)}
                placeholder="أدخل اسم الشاهد"
              />
            </div>
            <div className="flex justify-end space-x-2 space-x-reverse">
              <button
                type="button"
                onClick={() => {
                  setShowEvidenceModal(null)
                  setEvidenceName('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleAddEvidence(showEvidenceModal)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

