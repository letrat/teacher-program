'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertCircle, Users } from 'lucide-react'
import Modal from '@/components/ui/Modal'

interface JobType {
  id: string
  name: string
}

interface Teacher {
  id: string
  name: string
  username: string
  status: boolean
  jobType: {
    id: string
    name: string
  } | null
  _count: {
    submissions: number
  }
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    jobTypeId: '',
  })
  const [jobTypesWeights, setJobTypesWeights] = useState<Array<{
    jobTypeId: string
    jobTypeName: string
    totalWeight: number
    isValid: boolean
  }>>([])
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    fetchData()
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

  const fetchData = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const [teachersData, jobTypesData] = await Promise.all([
        api.school.teachers.list(),
        api.school.jobTypes.list(),
      ])

      // Handle pagination response
      const teachersList = Array.isArray(teachersData) 
        ? teachersData 
        : ((teachersData as any)?.data || [])
      
      setTeachers(teachersList)

      if (Array.isArray(jobTypesData)) {
        // Filter out temporary IDs if any
        const validJobTypes = jobTypesData.filter((jt: any) => jt.id && !jt.id.startsWith('temp'))
        setJobTypes(validJobTypes)
        if (validJobTypes.length === 0) {
          console.warn('No job types found. Please run SEED_JOB_TYPES.bat or add them from Admin panel')
        }
      } else {
        console.error('Invalid job types data:', jobTypesData)
        setJobTypes([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    
    setSubmitting(true)
    try {
      const api = (await import('@/lib/api')).default
      await api.school.teachers.create(formData)
      setShowModal(false)
      setFormData({
        name: '',
        username: '',
        password: '',
        jobTypeId: '',
      })
      fetchData()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في إضافة المعلم')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const api = (await import('@/lib/api')).default
      await api.school.teachers.update(id, { status: !currentStatus })
      fetchData()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ')
    }
  }

  if (loading) {
    return <div className="p-6">جاري التحميل...</div>
  }

  return (
    <div className="p-6">
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-indigo-100 shadow-sm mb-4 sm:mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                <Users className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-blue-900 bg-clip-text text-transparent">
                  إدارة المعلمين
                </h1>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors shadow-md whitespace-nowrap"
            >
              إضافة معلم جديد
            </button>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent"></div>
        </div>
      </div>

      {/* تنبيهات مجموع الأوزان */}
      {jobTypesWeights.filter(jtw => !jtw.isValid).length > 0 && (
        <div className="space-y-3 mb-6">
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

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {teachers.map((teacher) => (
            <li key={teacher.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">👨‍🏫</span>
                    </div>
                    <div className="mr-4">
                      <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                      <div className="text-sm text-gray-500">
                        {teacher.username} • {teacher.jobType?.name || 'بدون صفة'} • {teacher._count.submissions} طلب
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        teacher.status
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {teacher.status ? 'نشط' : 'معطل'}
                    </span>
                    <button
                      onClick={() => handleToggleStatus(teacher.id, teacher.status)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {teacher.status ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="إضافة معلم جديد"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              اسم المعلم
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              اسم المستخدم
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              required
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              صفة الموظف
            </label>
            <select
              required
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formData.jobTypeId}
              onChange={(e) => setFormData({ ...formData, jobTypeId: e.target.value })}
            >
              <option value="">اختر الصفة</option>
              {jobTypes.length > 0 ? (
                jobTypes.map((jt) => (
                  <option key={jt.id} value={jt.id}>
                    {jt.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>لا توجد صفات متاحة - يرجى إضافتها من لوحة الأدمن</option>
              )}
            </select>
            {jobTypes.length === 0 && (
              <p className="mt-2 text-xs text-orange-600">
                ⚠️ لا توجد صفات موظفين. يرجى إضافتها من: لوحة الأدمن → صفات الموظفين
                <br />
                أو شغّل: SEED_JOB_TYPES.bat
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              إضافة
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

