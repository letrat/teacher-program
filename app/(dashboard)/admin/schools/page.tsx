'use client'

import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { UserRole } from '@prisma/client'
import { SchoolCard } from '@/components/admin/SchoolCard'
import { SchoolDetailsDrawer } from '@/components/admin/SchoolDetailsDrawer'
import { Plus, Search, Filter } from 'lucide-react'

interface School {
  id: string
  name: string
  status: boolean
  users: Array<{
    id: string
    username: string
    name: string
    status: boolean
    role: UserRole
  }>
  _count: {
    users: number
  }
}

// Reusing types from component files for consistency in this file
interface User {
  id: string
  username: string
  name: string
  role: UserRole
  schoolId?: string
  jobTypeId?: string
  status: boolean
  jobType?: {
    id: string
    name: string
  }
}

interface JobType {
  id: string
  name: string
}

export default function SchoolsAndUsersPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [filteredSchools, setFilteredSchools] = useState<School[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null)
  const [schoolDetails, setSchoolDetails] = useState<any | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [showSchoolModal, setShowSchoolModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  
  const [schoolFormData, setSchoolFormData] = useState({
    name: '',
    managerUsername: '',
    managerPassword: '',
    managerName: '',
    managerPhone: '',
    managerEmail: '',
    subscriptionStart: '',
    subscriptionEnd: '',
  })
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'TEACHER' as UserRole,
    jobTypeId: '',
  })
  
  const [jobTypes, setJobTypes] = useState<JobType[]>([])

  useEffect(() => {
    fetchSchools()
    fetchJobTypes()
  }, [])

  useEffect(() => {
    let result = schools
    
    if (searchTerm) {
      result = result.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    }
    
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active'
      result = result.filter(s => s.status === isActive)
    }
    
    setFilteredSchools(result)
  }, [schools, searchTerm, statusFilter])

  useEffect(() => {
    if (selectedSchoolId) {
      fetchSchoolDetails(selectedSchoolId)
    } else {
      setSchoolDetails(null)
    }
  }, [selectedSchoolId])

  const fetchSchools = async () => {
    try {
      setError(null)
      const data = await api.admin.schools.list()
      const schoolsList = Array.isArray(data) ? data : ((data as any)?.data || [])
      setSchools(schoolsList)
      setFilteredSchools(schoolsList)
    } catch (error: any) {
      console.error('❌ Error fetching schools:', error)
      setError('حدث خطأ في جلب المدارس')
    } finally {
      setLoading(false)
    }
  }

  const fetchJobTypes = async () => {
    try {
      const data = await api.admin.jobTypes.list()
      const jobTypesList = Array.isArray(data) ? data : ((data as any)?.data || [])
      setJobTypes(jobTypesList) // Removed .filter(jt => jt.status) to show all potentially
    } catch (error) {
      console.error('Error fetching job types:', error)
    }
  }

  const fetchSchoolDetails = async (schoolId: string) => {
    setDetailsLoading(true)
    try {
      const details = await api.admin.schools.details(schoolId)
      setSchoolDetails(details)
    } catch (error: any) {
      console.error('❌ Error fetching school details:', error)
      // Don't clear selectedSchoolId so drawer stays open with error
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload: any = {
        name: schoolFormData.name,
        managerUsername: schoolFormData.managerUsername,
        managerPassword: schoolFormData.managerPassword,
        managerName: schoolFormData.managerName,
        managerPhone: schoolFormData.managerPhone || null,
        managerEmail: schoolFormData.managerEmail || null,
      }
      
      // Add subscription dates if provided
      if (schoolFormData.subscriptionStart) {
        payload.subscriptionStart = new Date(schoolFormData.subscriptionStart).toISOString()
      }
      if (schoolFormData.subscriptionEnd) {
        payload.subscriptionEnd = new Date(schoolFormData.subscriptionEnd).toISOString()
      }
      
      await api.admin.schools.create(payload)
      setShowSchoolModal(false)
      setSchoolFormData({
        name: '',
        managerUsername: '',
        managerPassword: '',
        managerName: '',
        managerPhone: '',
        managerEmail: '',
        subscriptionStart: '',
        subscriptionEnd: '',
      })
      await fetchSchools()
    } catch (error: any) {
      const errorMessage = error.message || 'حدث خطأ في إضافة المدرسة'
      alert(errorMessage)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSchoolId) return

    try {
      await api.admin.users.create({
        ...userFormData,
        schoolId: selectedSchoolId,
      })
      setShowUserModal(false)
      setUserFormData({
        username: '',
        password: '',
        name: '',
        role: 'TEACHER',
        jobTypeId: '',
      })
      // Refresh details
      await fetchSchoolDetails(selectedSchoolId)
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في إضافة المستخدم')
    }
  }

  const handleToggleSchoolStatus = async (id: string, currentStatus: boolean) => {
    const school = schools.find(s => s.id === id)
    const schoolName = school?.name || 'هذه المدرسة'
    
    if (currentStatus) {
      // Confirmation before disabling
      const confirmed = window.confirm(
        `هل أنت متأكد من تعطيل المدرسة "${schoolName}"؟\n\nسيتم تعطيل جميع حسابات المستخدمين التابعين لهذه المدرسة (مدير المدرسة والمعلمين).`
      )
      if (!confirmed) {
        return
      }
    }
    
    try {
      await api.admin.schools.update(id, { status: !currentStatus })
      await fetchSchools()
      if (selectedSchoolId === id) {
        await fetchSchoolDetails(id)
      }
    } catch (error: any) {
      alert(error.message || 'حدث خطأ')
    }
  }

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.admin.users.update(userId, { status: !currentStatus })
      if (selectedSchoolId) {
        await fetchSchoolDetails(selectedSchoolId)
      }
    } catch (error) {
      alert('حدث خطأ')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-sans">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المدارس</h1>
          <p className="text-gray-500 mt-1">عرض وإدارة المدارس والمستخدمين والمعايير</p>
        </div>
        <button
          onClick={() => setShowSchoolModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 font-medium w-full md:w-auto"
        >
          <Plus className="w-5 h-5" />
          مدرسة جديدة
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="بحث عن مدرسة..."
            className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 min-w-[200px]">
          <Filter className="text-gray-400 w-5 h-5" />
          <select
            className="flex-1 py-2 px-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none bg-transparent"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">معطل</option>
          </select>
        </div>
      </div>

      {/* Schools Grid */}
      {filteredSchools.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200 border-dashed">
          <div className="text-6xl mb-4">🏫</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">لا توجد مدارس</h3>
          <p className="text-gray-500">لم يتم العثور على مدارس تطابق بحثك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSchools.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              onViewDetails={(s) => setSelectedSchoolId(s.id)}
              onToggleStatus={handleToggleSchoolStatus}
            />
          ))}
        </div>
      )}

      {/* School Details Drawer */}
      <SchoolDetailsDrawer
        isOpen={!!selectedSchoolId}
        onClose={() => setSelectedSchoolId(null)}
        details={schoolDetails}
        loading={detailsLoading}
        onAddUser={() => setShowUserModal(true)}
        onToggleUserStatus={handleToggleUserStatus}
        onSchoolUpdate={async () => {
          if (selectedSchoolId) {
            await fetchSchoolDetails(selectedSchoolId)
            await fetchSchools()
          }
        }}
      />

      {/* Add School Modal */}
      {showSchoolModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">إضافة مدرسة جديدة</h3>
            </div>
            <form onSubmit={handleCreateSchool} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المدرسة</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={schoolFormData.name}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المدير</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={schoolFormData.managerName}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, managerName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم جوال المدير (اختياري)</label>
                <input
                  type="tel"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={schoolFormData.managerPhone}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, managerPhone: e.target.value })}
                  placeholder="05xxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">إيميل المدير (اختياري)</label>
                <input
                  type="email"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={schoolFormData.managerEmail}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, managerEmail: e.target.value })}
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستخدم</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={schoolFormData.managerUsername}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, managerUsername: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={schoolFormData.managerPassword}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, managerPassword: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ بداية الاشتراك (اختياري)</label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={schoolFormData.subscriptionStart}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, subscriptionStart: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ نهاية الاشتراك (اختياري)</label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={schoolFormData.subscriptionEnd}
                  onChange={(e) => setSchoolFormData({ ...schoolFormData, subscriptionEnd: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">بعد انتهاء التاريخ سيتم تعطيل المدرسة تلقائياً</p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSchoolModal(false)}
                  className="px-5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm transition-colors"
                >
                  إضافة المدرسة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">إضافة مستخدم جديد</h3>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستخدم</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع الحساب</label>
                <select
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole, jobTypeId: '' })}
                >
                  <option value="SCHOOL_MANAGER">مدير مدرسة</option>
                  <option value="TEACHER">معلم</option>
                </select>
              </div>
              {userFormData.role === 'TEACHER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الصفة الوظيفية</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                    value={userFormData.jobTypeId}
                    onChange={(e) => setUserFormData({ ...userFormData, jobTypeId: e.target.value })}
                  >
                    <option value="">اختر الصفة</option>
                    {jobTypes.map((jt) => (
                      <option key={jt.id} value={jt.id}>
                        {jt.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-5 py-2.5 rounded-xl text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm transition-colors"
                >
                  إضافة المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
