'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

interface EvidenceItem {
  id: string
  name: string
}

interface JobType {
  id: string
  name: string
}

interface KPI {
  id: string
  name: string
  jobType: {
    id: string
    name: string
  }
}

export default function EvidenceItemsPage() {
  const params = useParams()
  const kpiId = params.id as string

  const [kpi, setKpi] = useState<KPI | null>(null)
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '' })

  useEffect(() => {
    fetchData()
  }, [kpiId])

  const fetchData = async () => {
    try {
      // Find KPI from all job types
      const jobTypes = await api.admin.jobTypes.list()
      let foundKPI: KPI | null = null
      for (const jt of jobTypes as JobType[]) {
        const kpis = await api.admin.jobTypes.kpis(jt.id)
        const k = (kpis as KPI[]).find((k: KPI) => k.id === kpiId)
        if (k) {
          foundKPI = { ...k, jobType: { id: jt.id, name: jt.name } }
          break
        }
      }
      setKpi(foundKPI)

      const evidenceData = await api.admin.kpis.evidence(kpiId)
      setEvidenceItems(evidenceData as EvidenceItem[])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.admin.kpis.createEvidence(kpiId, formData)
      setShowModal(false)
      setFormData({ name: '' })
      fetchData()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في إضافة الشاهد')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الشاهد؟')) return

    try {
      await api.admin.evidence.delete(id)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في حذف الشاهد')
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
          <Link
            href={`/admin/job-types/${kpi?.jobType.id}/kpis`}
            className="hover:text-gray-700"
          >
            {kpi?.jobType.name}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{kpi?.name}</span>
        </nav>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          شواهد: {kpi?.name}
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          إضافة شاهد جديد
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {evidenceItems.map((item) => (
            <li key={item.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">📄</span>
                    </div>
                    <div className="mr-4">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">إضافة شاهد جديد</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم الشاهد
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
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
    </div>
  )
}





