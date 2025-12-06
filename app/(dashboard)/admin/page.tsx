'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Building2, Users, GraduationCap, ClipboardList, Award, FileText, 
  TrendingUp, TrendingDown, Activity, CheckCircle, XCircle, Clock,
  BarChart3, PieChart, Calendar, AlertCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import api from '@/lib/api'

interface DashboardStats {
  // Basic counts
  schoolsCount: number
  activeSchoolsCount: number
  managersCount: number
  activeManagersCount: number
  teachersCount: number
  activeTeachersCount: number
  jobTypesCount: number
  activeJobTypesCount: number
  kpisCount: number
  officialKPIsCount: number
  evidenceItemsCount: number
  submissionsCount: number
  pendingSubmissionsCount: number
  approvedSubmissionsCount: number
  rejectedSubmissionsCount: number
  // Subscription stats
  schoolsWithSubscriptions: number
  expiredSubscriptions: number
  // Growth
  schoolsGrowth: number
  submissionsGrowth: number
  // Detailed data
  recentSubmissions: Array<{
    id: string
    userName: string
    schoolName: string
    kpiName: string
    evidenceName: string
    status: string
    createdAt: string
  }>
  topJobTypes: Array<{
    id: string
    name: string
    usersCount: number
  }>
  schoolsByStatus: Array<{
    status: boolean
    count: number
  }>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const statsData = await api.admin.dashboard.stats() as any
      console.log('📊 Dashboard stats received:', statsData)
      
      // Validate and set default values if needed
      if (statsData && typeof statsData === 'object') {
        // Ensure all required fields exist with defaults
        const validatedStats: DashboardStats = {
          schoolsCount: statsData.schoolsCount || 0,
          activeSchoolsCount: statsData.activeSchoolsCount || 0,
          managersCount: statsData.managersCount || 0,
          activeManagersCount: statsData.activeManagersCount || 0,
          teachersCount: statsData.teachersCount || 0,
          activeTeachersCount: statsData.activeTeachersCount || 0,
          jobTypesCount: statsData.jobTypesCount || 0,
          activeJobTypesCount: statsData.activeJobTypesCount || 0,
          kpisCount: statsData.kpisCount || 0,
          officialKPIsCount: statsData.officialKPIsCount || 0,
          evidenceItemsCount: statsData.evidenceItemsCount || 0,
          submissionsCount: statsData.submissionsCount || 0,
          pendingSubmissionsCount: statsData.pendingSubmissionsCount || 0,
          approvedSubmissionsCount: statsData.approvedSubmissionsCount || 0,
          rejectedSubmissionsCount: statsData.rejectedSubmissionsCount || 0,
          schoolsWithSubscriptions: statsData.schoolsWithSubscriptions || 0,
          expiredSubscriptions: statsData.expiredSubscriptions || 0,
          schoolsGrowth: statsData.schoolsGrowth || 0,
          submissionsGrowth: statsData.submissionsGrowth || 0,
          recentSubmissions: statsData.recentSubmissions || [],
          topJobTypes: statsData.topJobTypes || [],
          schoolsByStatus: statsData.schoolsByStatus || []
        }
        setStats(validatedStats)
      } else {
        console.error('Invalid stats data structure:', statsData)
        setStats(null)
      }
    } catch (error: any) {
      console.error('❌ Error fetching admin stats:', error)
      console.error('Error details:', error.message, error.stack)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">جاري تحميل البيانات...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 text-lg font-semibold mb-2">حدث خطأ في تحميل البيانات</p>
          <p className="text-gray-600 text-sm mb-4">يرجى المحاولة مرة أخرى</p>
          <button
            onClick={fetchStats}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  const {
    schoolsCount, activeSchoolsCount, managersCount, activeManagersCount,
    teachersCount, activeTeachersCount, jobTypesCount, activeJobTypesCount,
    kpisCount, officialKPIsCount, evidenceItemsCount, submissionsCount,
    pendingSubmissionsCount, approvedSubmissionsCount, rejectedSubmissionsCount,
    schoolsWithSubscriptions, expiredSubscriptions, schoolsGrowth, submissionsGrowth,
    recentSubmissions, topJobTypes, schoolsByStatus
  } = stats

  const activeSchoolsPercentage = schoolsCount > 0 ? ((activeSchoolsCount / schoolsCount) * 100).toFixed(1) : '0'
  const activeUsersPercentage = (managersCount + teachersCount) > 0 
    ? (((activeManagersCount + activeTeachersCount) / (managersCount + teachersCount)) * 100).toFixed(1) 
    : '0'
  const approvalRate = submissionsCount > 0 
    ? ((approvedSubmissionsCount / submissionsCount) * 100).toFixed(1) 
    : '0'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Breadcrumbs items={[{ label: 'لوحة التحكم' }]} />

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                لوحة تحكم مدير النظام
              </h1>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">
                نظرة شاملة على النظام وإحصائيات مفصلة
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Activity className="w-4 h-4" />
              <span>آخر تحديث: {new Date().toLocaleTimeString('ar-SA')}</span>
            </div>
          </div>
      </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Schools Card */}
        <Link href="/admin/schools">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Building2 className="w-6 h-6" />
                </div>
                {schoolsGrowth >= 0 ? (
                  <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-xs">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>{Math.abs(schoolsGrowth)}%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-xs">
                    <ArrowDownRight className="w-3 h-3" />
                    <span>{Math.abs(schoolsGrowth)}%</span>
                  </div>
                )}
              </div>
              <div className="text-3xl font-bold mb-1">{schoolsCount}</div>
              <div className="text-blue-100 text-sm">إجمالي المدارس</div>
              <div className="mt-3 pt-3 border-t border-white/20 text-xs">
                <span className="text-blue-100">{activeSchoolsCount} نشط</span>
                <span className="mx-2">•</span>
                <span className="text-blue-100">{activeSchoolsPercentage}%</span>
              </div>
            </div>
          </Link>

          {/* Users Card */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{managersCount + teachersCount}</div>
            <div className="text-purple-100 text-sm">إجمالي المستخدمين</div>
            <div className="mt-3 pt-3 border-t border-white/20 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-purple-100">مديرو المدارس:</span>
                <span className="font-semibold">{managersCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-100">المعلمين:</span>
                <span className="font-semibold">{teachersCount}</span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-white/10">
                <span className="text-purple-100">نشط:</span>
                <span className="font-semibold">{activeManagersCount + activeTeachersCount} ({activeUsersPercentage}%)</span>
              </div>
            </div>
          </div>

          {/* Job Types Card */}
          <Link href="/admin/job-types">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all duration-300 cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <ClipboardList className="w-6 h-6" />
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{jobTypesCount}</div>
              <div className="text-orange-100 text-sm">صفات الموظفين</div>
              <div className="mt-3 pt-3 border-t border-white/20 text-xs">
                <span className="text-orange-100">{activeJobTypesCount} نشط</span>
              </div>
            </div>
        </Link>

          {/* Submissions Card */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <FileText className="w-6 h-6" />
              </div>
              {submissionsGrowth >= 0 ? (
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-xs">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>{Math.abs(submissionsGrowth)}%</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-xs">
                  <ArrowDownRight className="w-3 h-3" />
                  <span>{Math.abs(submissionsGrowth)}%</span>
                </div>
              )}
            </div>
            <div className="text-3xl font-bold mb-1">{submissionsCount}</div>
            <div className="text-green-100 text-sm">طلبات الشواهد</div>
            <div className="mt-3 pt-3 border-t border-white/20 text-xs">
              <span className="text-green-100">معدل الموافقة: {approvalRate}%</span>
            </div>
          </div>
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <Award className="w-8 h-8 text-yellow-500" />
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{kpisCount}</div>
                <div className="text-sm text-gray-600">المعايير</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {officialKPIsCount} رسمي
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 text-indigo-500" />
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{evidenceItemsCount}</div>
                <div className="text-sm text-gray-600">الشواهد</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-blue-500" />
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{pendingSubmissionsCount}</div>
                <div className="text-sm text-gray-600">قيد المراجعة</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{expiredSubscriptions}</div>
                <div className="text-sm text-gray-600">اشتراكات منتهية</div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submissions Status Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-600" />
                حالة طلبات الشواهد
              </h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-gray-900">مقبولة</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{approvedSubmissionsCount}</div>
                  <div className="text-xs text-gray-500">{approvalRate}%</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-semibold text-gray-900">قيد المراجعة</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-600">{pendingSubmissionsCount}</div>
                  <div className="text-xs text-gray-500">
                    {submissionsCount > 0 ? ((pendingSubmissionsCount / submissionsCount) * 100).toFixed(1) : '0'}%
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-gray-900">مرفوضة</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">{rejectedSubmissionsCount}</div>
                  <div className="text-xs text-gray-500">
                    {submissionsCount > 0 ? ((rejectedSubmissionsCount / submissionsCount) * 100).toFixed(1) : '0'}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Job Types */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                أكثر الصفات استخداماً
              </h2>
            </div>
            <div className="space-y-3">
              {topJobTypes.length > 0 ? (
                topJobTypes.map((jobType, index) => {
                  const maxUsers = Math.max(...topJobTypes.map(jt => jt.usersCount), 1)
                  const percentage = (jobType.usersCount / maxUsers) * 100
                  return (
                    <div key={jobType.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">{jobType.name}</span>
                        <span className="text-sm font-bold text-purple-600">{jobType.usersCount} مستخدم</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              النشاط الأخير
            </h2>
            <Link 
              href="/admin/submissions" 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              عرض الكل →
            </Link>
          </div>
          <div className="space-y-3">
            {recentSubmissions.length > 0 ? (
              recentSubmissions.map((submission) => (
                <div 
                  key={submission.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${
                      submission.status === 'ACCEPTED' ? 'bg-green-100' :
                      submission.status === 'REJECTED' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {submission.status === 'ACCEPTED' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : submission.status === 'REJECTED' ? (
                        <XCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{submission.userName}</div>
                      <div className="text-sm text-gray-600 truncate">
                        {submission.schoolName} • {submission.kpiName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {submission.evidenceName}
                      </div>
                    </div>
                  </div>
                  <div className="text-left text-xs text-gray-500">
                    {new Date(submission.createdAt).toLocaleDateString('ar-SA')}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">لا يوجد نشاط حديث</div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/admin/schools">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">إدارة المدارس</div>
                  <div className="text-sm text-gray-600">عرض وإدارة جميع المدارس</div>
                </div>
              </div>
            </div>
          </Link>

        <Link href="/admin/job-types">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                  <ClipboardList className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">إدارة الصفات</div>
                  <div className="text-sm text-gray-600">إدارة الصفات والمعايير</div>
                </div>
              </div>
            </div>
        </Link>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">طلبات الشواهد</div>
                <div className="text-sm text-gray-600">مراجعة طلبات الشواهد</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
