'use client'

import { useState, useEffect } from 'react'
import { UserRole } from '@prisma/client'

interface User {
  id: string
  username: string
  name: string
  role: UserRole
  schoolId?: string
  jobTypeId?: string
  status: boolean
  school?: {
    id: string
    name: string
  }
  jobType?: {
    id: string
    name: string
  }
}

interface School {
  id: string
  name: string
}

interface JobType {
  id: string
  name: string
  status?: boolean
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'TEACHER' as UserRole,
    schoolId: '',
    jobTypeId: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const [usersData, schoolsData, jobTypesData] = await Promise.all([
        api.admin.users.list(),
        api.admin.schools.list(),
        api.admin.jobTypes.list(),
      ])

      // Handle pagination responses
      const usersList = Array.isArray(usersData) ? usersData : ((usersData as any)?.data || [])
      const schoolsList = Array.isArray(schoolsData) ? schoolsData : ((schoolsData as any)?.data || [])
      const jobTypesList = Array.isArray(jobTypesData) ? jobTypesData : ((jobTypesData as any)?.data || [])

      setUsers(usersList)
      setSchools(schoolsList)
      setJobTypes(jobTypesList.filter((jt: JobType) => jt.status))
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const api = (await import('@/lib/api')).default
      await api.admin.users.create(formData)
      setShowModal(false)
      setFormData({
        username: '',
        password: '',
        name: '',
        role: 'TEACHER',
        schoolId: '',
        jobTypeId: '',
      })
      fetchData()
    } catch (error) {
      alert('حدث خطأ في إضافة المستخدم')
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const api = (await import('@/lib/api')).default
      await api.admin.users.update(id, { status: !currentStatus })
      fetchData()
    } catch (error) {
      alert('حدث خطأ')
    }
  }

  const getRoleName = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'مدير النظام'
      case UserRole.SCHOOL_MANAGER:
        return 'مدير مدرسة'
      case UserRole.TEACHER:
        return 'معلم'
      default:
        return role
    }
  }

  if (loading) {
    return <div className="p-6">جاري التحميل...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">إدارة المستخدمين</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          إضافة مستخدم جديد
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users.map((user) => (
            <li key={user.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">👤</span>
                    </div>
                    <div className="mr-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">
                        {user.username} • {getRoleName(user.role)}
                        {user.school && ` • ${user.school.name}`}
                        {user.jobType && ` • ${user.jobType.name}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        user.status
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.status ? 'نشط' : 'معطل'}
                    </span>
                    <button
                      onClick={() => handleToggleStatus(user.id, user.status)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {user.status ? 'تعطيل' : 'تفعيل'}
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
            <h3 className="text-lg font-bold text-gray-900 mb-4">إضافة مستخدم جديد</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الاسم الكامل
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
                  اسم المستخدم
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  كلمة المرور
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نوع الحساب
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  <option value="ADMIN">مدير النظام</option>
                  <option value="SCHOOL_MANAGER">مدير مدرسة</option>
                  <option value="TEACHER">معلم</option>
                </select>
              </div>
              {formData.role === 'TEACHER' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      المدرسة
                    </label>
                    <select
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.schoolId}
                      onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                    >
                      <option value="">اختر المدرسة</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      صفة الموظف
                    </label>
                    <select
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={formData.jobTypeId}
                      onChange={(e) => setFormData({ ...formData, jobTypeId: e.target.value })}
                    >
                      <option value="">اختر الصفة</option>
                      {jobTypes.map((jt) => (
                        <option key={jt.id} value={jt.id}>
                          {jt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
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





