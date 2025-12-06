import React from 'react'
import { X, Users, FileText, BarChart3, Shield, AlertCircle, CheckCircle } from 'lucide-react'
import { UserRole } from '@prisma/client'

// Types reused from page (should ideally be in a types file)
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

interface SchoolDetails {
  school: {
    id: string
    name: string
    status: boolean
    createdAt: string
    subscriptionStart?: string | null
    subscriptionEnd?: string | null
    managerName?: string | null
    managerUsername?: string | null
    managerPhone?: string | null
    managerEmail?: string | null
  }
  users: User[]
  jobTypesWithKPIs: Array<{
    jobType: {
      id: string
      name: string
    }
    kpis: Array<{
      kpiId: string
      name: string
      weight: number
      isActive: boolean
      isOfficial: boolean
      evidenceItems: Array<{
        id: string
        name: string
        isOfficial: boolean
      }>
    }>
    totalWeight: number
    isValid: boolean
    activeCount: number
    totalCount: number
    schoolSpecificCount: number
    activeSchoolSpecificCount: number
  }>
  stats: {
    totalUsers: number
    teachers: number
    activeUsers: number
  }
}

interface SchoolDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
  details: SchoolDetails | null
  loading: boolean
  onAddUser: () => void
  onToggleUserStatus: (userId: string, currentStatus: boolean) => void
  onSchoolUpdate?: () => void
  onRefreshDetails?: () => void
}

export const SchoolDetailsDrawer: React.FC<SchoolDetailsDrawerProps> = ({
  isOpen,
  onClose,
  details,
  loading,
  onAddUser,
  onToggleUserStatus,
  onSchoolUpdate,
  onRefreshDetails
}) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'kpis' | 'users' | 'settings'>('overview')
  const [isEditingSchool, setIsEditingSchool] = React.useState(false)
  const [schoolEditData, setSchoolEditData] = React.useState({
    name: '',
    subscriptionStart: '',
    subscriptionEnd: '',
    managerName: '',
    managerPhone: '',
    managerEmail: '',
  })
  const [savingSchool, setSavingSchool] = React.useState(false)

  React.useEffect(() => {
    if (details?.school) {
      setSchoolEditData({
        name: details.school.name,
        subscriptionStart: details.school.subscriptionStart 
          ? new Date(details.school.subscriptionStart).toISOString().slice(0, 16)
          : '',
        subscriptionEnd: details.school.subscriptionEnd 
          ? new Date(details.school.subscriptionEnd).toISOString().slice(0, 16)
          : '',
        managerName: details.school.managerName || '',
        managerPhone: details.school.managerPhone || '',
        managerEmail: details.school.managerEmail || '',
      })
    }
  }, [details])

  const handleSaveSchool = async () => {
    if (!details?.school) return
    
    setSavingSchool(true)
    try {
      const api = (await import('@/lib/api')).default
      const payload: any = {
        name: schoolEditData.name,
      }
      
      // Always include subscription dates, even if empty (to allow clearing them)
      if (schoolEditData.subscriptionStart) {
        // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO string
        const startDate = new Date(schoolEditData.subscriptionStart)
        payload.subscriptionStart = startDate.toISOString()
      } else {
        payload.subscriptionStart = null
      }
      
      if (schoolEditData.subscriptionEnd) {
        // Convert datetime-local format (YYYY-MM-DDTHH:mm) to ISO string
        const endDate = new Date(schoolEditData.subscriptionEnd)
        payload.subscriptionEnd = endDate.toISOString()
      } else {
        payload.subscriptionEnd = null
      }
      
      // Add manager info
      // Note: username never changes after creation - it's only set during school creation
      // Always send manager name if it exists in form data
      if (schoolEditData.managerName !== undefined) {
        payload.managerName = schoolEditData.managerName
      }
      payload.managerPhone = schoolEditData.managerPhone || null
      payload.managerEmail = schoolEditData.managerEmail || null
      
      console.log('📤 Sending payload:', payload)
      
      await api.admin.schools.update(details.school.id, payload)
      
      console.log('✅ School updated successfully')
      
      setIsEditingSchool(false)
      
      // Wait a bit before refreshing to ensure backend has processed
      setTimeout(async () => {
      if (onSchoolUpdate) {
          await onSchoolUpdate()
        }
        if (onRefreshDetails) {
          await onRefreshDetails()
      }
      }, 500)
    } catch (error: any) {
      console.error('❌ Error updating school:', error)
      alert(error.message || 'حدث خطأ في تحديث المدرسة')
    } finally {
      setSavingSchool(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed inset-y-0 left-0 w-full md:max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              {loading ? 'جاري التحميل...' : details?.school.name}
            </h2>
            {!loading && details && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${details.school.status ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-500">
                  {details.school.status ? 'نشط' : 'معطل'}
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p>جاري جلب التفاصيل...</p>
            </div>
          ) : details ? (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="text-gray-500 text-xs mb-1">المستخدمين</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900">{details.stats.totalUsers}</div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="text-gray-500 text-xs mb-1">المعلمين</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-600">{details.stats.teachers}</div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="text-gray-500 text-xs mb-1">المعايير الخاصة</div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-600">
                    {details.jobTypesWithKPIs.reduce((acc, jt) => acc + jt.schoolSpecificCount, 0)}
                  </div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="text-gray-500 text-xs mb-1">المعايير الرسمية</div>
                  <div className="text-xl sm:text-2xl font-bold text-indigo-600">
                    {details.jobTypesWithKPIs.reduce((acc, jt) => acc + (jt.activeCount - jt.activeSchoolSpecificCount), 0)}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-100 overflow-x-auto">
                  {[
                    { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
                    { id: 'kpis', label: 'المعايير', icon: FileText },
                    { id: 'users', label: 'المستخدمين', icon: Users },
                    { id: 'settings', label: 'الإعدادات', icon: Shield },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 min-w-[120px] py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap
                        ${activeTab === tab.id 
                          ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                        }`}
                    >
                      <tab.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-4 sm:p-6">
                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <h3 className="font-bold text-gray-900 mb-4 text-base sm:text-lg">حالة إعداد المعايير</h3>
                      <div className="space-y-4">
                        {details.jobTypesWithKPIs.map((jt) => (
                          <div key={jt.jobType.id} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <span className="font-semibold text-gray-900 text-sm sm:text-base">{jt.jobType.name}</span>
                              <span className={`text-sm sm:text-base font-bold ${jt.isValid ? 'text-green-600' : 'text-red-600'}`}>
                                {jt.totalWeight.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${jt.isValid ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(jt.totalWeight, 100)}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-gray-600">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                <span className="font-medium">{jt.activeSchoolSpecificCount} خاص</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                <span className="font-medium">{jt.activeCount - jt.activeSchoolSpecificCount} رسمي</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KPIs Tab */}
                  {activeTab === 'kpis' && (
                    <div className="space-y-6 sm:space-y-8">
                      {details.jobTypesWithKPIs.map((jt) => (
                        <div key={jt.jobType.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <h3 className="font-bold text-gray-900 text-base sm:text-lg">{jt.jobType.name}</h3>
                            <span className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap ${jt.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {jt.totalWeight.toFixed(1)}% إجمالي الوزن
                            </span>
                          </div>
                          
                          <div className="space-y-3">
                            {jt.kpis.filter(k => k.isActive).map((kpi) => (
                              <div key={kpi.kpiId} className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                                kpi.isOfficial 
                                  ? 'bg-indigo-50 border-indigo-200' 
                                  : 'bg-purple-50 border-purple-200'
                              }`}>
                                <div className="mt-0.5 flex-shrink-0">
                                  {kpi.isOfficial ? (
                                    <Shield className="w-5 h-5 text-indigo-600" aria-label="معيار رسمي" />
                                  ) : (
                                    <FileText className="w-5 h-5 text-purple-600" aria-label="معيار خاص بالمدرسة" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-sm sm:text-base font-semibold text-gray-900 truncate">{kpi.name}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap flex-shrink-0 ${
                                        kpi.isOfficial 
                                          ? 'bg-indigo-100 text-indigo-700' 
                                          : 'bg-purple-100 text-purple-700'
                                      }`}>
                                        {kpi.isOfficial ? 'رسمي' : 'خاص'}
                                      </span>
                                    </div>
                                    <span className="text-base sm:text-lg font-bold text-blue-600 whitespace-nowrap">{kpi.weight}%</span>
                                  </div>
                                  {kpi.evidenceItems.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                                        <span>📎</span>
                                        <span>الشواهد ({kpi.evidenceItems.length})</span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {kpi.evidenceItems.map(ev => (
                                          <span key={ev.id} className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                                            ev.isOfficial 
                                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                                              : 'bg-purple-100 text-purple-700 border border-purple-200'
                                          }`}>
                                            {ev.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {jt.kpis.filter(k => k.isActive).length === 0 && (
                              <div className="text-center py-8 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                                لا توجد معايير نشطة
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Users Tab */}
                  {activeTab === 'users' && (
                    <div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg">المستخدمين ({details.users.length})</h3>
                        <button
                          onClick={onAddUser}
                          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium whitespace-nowrap"
                        >
                          + إضافة مستخدم
                        </button>
                      </div>
                      <div className="space-y-3">
                        {details.users.map((user) => (
                          <div key={user.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl border-2 border-gray-300 flex-shrink-0">
                                {user.role === 'SCHOOL_MANAGER' ? '👨‍💼' : '👤'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                                  {user.role === 'SCHOOL_MANAGER' 
                                    ? `${details?.school.name} - ${user.name}`
                                    : user.name
                                  }
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600 mt-0.5">
                                  {user.role === 'SCHOOL_MANAGER' ? 'مدير مدرسة' : 'معلم'}
                                  {user.jobType && ` • ${user.jobType.name}`}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => onToggleUserStatus(user.id, user.status)}
                              className={`text-xs sm:text-sm px-4 py-2 rounded-lg border-2 font-medium transition-colors whitespace-nowrap ${
                                user.status 
                                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100' 
                                  : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                              }`}
                            >
                              {user.status ? 'تعطيل' : 'تفعيل'}
                            </button>
                          </div>
                        ))}
                        {details.users.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            لا يوجد مستخدمين مسجلين
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Settings Tab */}
                  {activeTab === 'settings' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg">إعدادات المدرسة</h3>
                        {!isEditingSchool && (
                          <button
                            onClick={() => setIsEditingSchool(true)}
                            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                          >
                            تعديل
                          </button>
                        )}
                      </div>

                      {isEditingSchool ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المدرسة</label>
                            <input
                              type="text"
                              required
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              value={schoolEditData.name}
                              onChange={(e) => setSchoolEditData({ ...schoolEditData, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم مدير المدرسة</label>
                            <input
                              type="text"
                              required
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              value={schoolEditData.managerName}
                              onChange={(e) => setSchoolEditData({ ...schoolEditData, managerName: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ بداية الاشتراك</label>
                            <input
                              type="datetime-local"
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              value={schoolEditData.subscriptionStart}
                              onChange={(e) => setSchoolEditData({ ...schoolEditData, subscriptionStart: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">تاريخ نهاية الاشتراك</label>
                            <input
                              type="datetime-local"
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              value={schoolEditData.subscriptionEnd}
                              onChange={(e) => setSchoolEditData({ ...schoolEditData, subscriptionEnd: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">بعد انتهاء التاريخ سيتم تعطيل المدرسة تلقائياً</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم جوال المدير (اختياري)</label>
                            <input
                              type="tel"
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              value={schoolEditData.managerPhone}
                              onChange={(e) => setSchoolEditData({ ...schoolEditData, managerPhone: e.target.value })}
                              placeholder="05xxxxxxxx"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">إيميل المدير (اختياري)</label>
                            <input
                              type="email"
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                              value={schoolEditData.managerEmail}
                              onChange={(e) => setSchoolEditData({ ...schoolEditData, managerEmail: e.target.value })}
                              placeholder="example@email.com"
                            />
                          </div>
                          <div className="flex gap-3 pt-4">
                            <button
                              onClick={() => setIsEditingSchool(false)}
                              className="flex-1 px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                              disabled={savingSchool}
                            >
                              إلغاء
                            </button>
                            <button
                              onClick={handleSaveSchool}
                              disabled={savingSchool}
                              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingSchool ? 'جاري الحفظ...' : 'حفظ'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">اسم المستخدم</div>
                            <div className="font-semibold text-gray-900">
                              {details.school.managerUsername || 'غير محدد'}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير اسم المستخدم بعد الإنشاء</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">اسم المدرسة</div>
                            <div className="font-semibold text-gray-900">{details.school.name}</div>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">اسم مدير المدرسة</div>
                            <div className="font-semibold text-gray-900">
                              {details.school.managerName || 'غير محدد'}
                            </div>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">تاريخ بداية الاشتراك</div>
                            <div className="font-semibold text-gray-900">
                              {details.school.subscriptionStart 
                                ? new Date(details.school.subscriptionStart).toLocaleString('ar-SA')
                                : 'غير محدد'}
                            </div>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">تاريخ نهاية الاشتراك</div>
                            <div className="font-semibold text-gray-900">
                              {details.school.subscriptionEnd 
                                ? new Date(details.school.subscriptionEnd).toLocaleString('ar-SA')
                                : 'غير محدد'}
                            </div>
                            {details.school.subscriptionEnd && (
                              <div className="mt-2 text-xs">
                                {new Date(details.school.subscriptionEnd) < new Date() ? (
                                  <span className="text-red-600 font-medium">⚠️ انتهت فترة الاشتراك</span>
                                ) : (
                                  <span className="text-gray-500">
                                    متبقي: {Math.ceil((new Date(details.school.subscriptionEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} يوم
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">رقم جوال المدير</div>
                            <div className="font-semibold text-gray-900">
                              {details.school.managerPhone || 'غير محدد'}
                            </div>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">إيميل المدير</div>
                            <div className="font-semibold text-gray-900">
                              {details.school.managerEmail || 'غير محدد'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              حدث خطأ في تحميل البيانات
            </div>
          )}
        </div>
      </div>
    </>
  )
}

