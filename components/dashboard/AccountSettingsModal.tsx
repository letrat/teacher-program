'use client'

import { useState, useEffect } from 'react'
import { X, Lock, User, Mail, Building, Briefcase, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { api } from '@/lib/api'
import { UserRole } from '@/types'

interface AccountSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AccountSettingsModal({ isOpen, onClose }: AccountSettingsModalProps) {
  const { user, refresh } = useAuth()
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setPasswordError('')
      setPasswordSuccess('')
    }
  }, [isOpen])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    // Validation
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('جميع الحقول مطلوبة')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('كلمة المرور الجديدة وتكرارها غير متطابقين')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
      return
    }

    setPasswordLoading(true)

    try {
      await api.auth.changePassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      })

      setPasswordSuccess('تم تغيير كلمة المرور بنجاح')
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      // Clear success message after 3 seconds
      setTimeout(() => {
        setPasswordSuccess('')
      }, 3000)
    } catch (error: any) {
      setPasswordError(error.message || 'حدث خطأ في تغيير كلمة المرور')
    } finally {
      setPasswordLoading(false)
    }
  }

  const getRoleName = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'مدير النظام'
      case UserRole.SCHOOL_MANAGER:
        return 'مدير المدرسة'
      case UserRole.TEACHER:
        return 'معلم'
      default:
        return ''
    }
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl flex items-center justify-between z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold mb-1">إعدادات الحساب</h2>
              <p className="text-sm text-blue-100">عرض وتعديل معلومات حسابك</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0 mr-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Account Information (Read-only) */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              معلومات الحساب
            </h3>
            <div className="bg-gray-50 rounded-lg p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المستخدم</label>
                <input
                  type="text"
                  value={user.username || ''}
                  readOnly
                  className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg border border-gray-300 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الاسم</label>
                <input
                  type="text"
                  value={user.name || ''}
                  readOnly
                  className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg border border-gray-300 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الدور</label>
                <input
                  type="text"
                  value={getRoleName(user.role)}
                  readOnly
                  className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg border border-gray-300 cursor-not-allowed"
                />
              </div>
              {user.schoolId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      المدرسة
                    </span>
                  </label>
                  <input
                    type="text"
                    value={user.school?.name || 'غير محدد'}
                    readOnly
                    className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg border border-gray-300 cursor-not-allowed"
                  />
                </div>
              )}
              {user.jobTypeId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      صفة الموظف
                    </span>
                  </label>
                  <input
                    type="text"
                    value={user.jobTypeId || 'غير محدد'}
                    readOnly
                    className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg border border-gray-300 cursor-not-allowed"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Change Password */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-600" />
              تغيير كلمة المرور
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كلمة المرور الحالية
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={passwordForm.oldPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, oldPassword: e.target.value })
                    }
                    className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="أدخل كلمة المرور الحالية"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showOldPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="أدخل كلمة المرور الجديدة (8 أحرف على الأقل)"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                    }
                    className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {passwordSuccess}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordLoading ? 'جاري التحديث...' : 'تغيير كلمة المرور'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

