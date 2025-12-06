'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/components/providers/AuthProvider'
import { UserRole } from '@prisma/client'
import { LogIn, User, Lock, Eye, EyeOff, Shield, School, GraduationCap, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(username, password)
      
      // Clear form
      setUsername('')
      setPassword('')
      
      setLoading(false)
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Redirect based on role
      if (user.role === UserRole.ADMIN) {
        router.replace('/admin')
      } else if (user.role === UserRole.SCHOOL_MANAGER) {
        router.replace('/school')
      } else if (user.role === UserRole.TEACHER) {
        router.replace('/teacher')
      } else {
        router.replace('/login')
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة'
      setError(errorMessage)
      setLoading(false)
      console.error('Login error handled:', errorMessage)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-0 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Left Side - Branding */}
        <div className="hidden md:flex flex-col justify-center items-center bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-12 text-white relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>
          
          <div className="relative z-10 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-32 h-32 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl p-4">
                <Image
                  src="/logos/01-01.png"
                  alt="قيم"
                  width={120}
                  height={120}
                  className="object-contain"
                />
              </div>
            </div>
            <h1 className="text-4xl font-bold">قيم</h1>
            <p className="text-xl text-blue-100">منصة حوكمة المعايير</p>
            <div className="pt-8 space-y-4">
              <div className="flex items-center justify-center gap-3 text-blue-100">
                <School className="w-5 h-5" />
                <span>إدارة المدارس والمعايير</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-blue-100">
                <GraduationCap className="w-5 h-5" />
                <span>تقييم أداء المعلمين</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-blue-100">
                <Shield className="w-5 h-5" />
                <span>حوكمة شاملة وآمنة</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex flex-col justify-center p-8 md:p-12">
          <div className="w-full max-w-md mx-auto space-y-8">
            {/* Mobile Logo */}
            <div className="md:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4 p-3">
                <Image
                  src="/logos/01-01.png"
                  alt="قيم"
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">قيم</h1>
              <p className="text-sm text-gray-600 mt-1">منصة حوكمة المعايير</p>
            </div>

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                  <LogIn className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">مرحباً بك</h2>
              <p className="text-gray-600">سجل دخولك للوصول إلى حسابك</p>
            </div>

            {/* Form */}
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Error Message */}
              {error && (
                <div className={`border-l-4 p-4 rounded-r-lg flex items-start gap-3 animate-in slide-in-from-top-2 ${
                  error.includes('المدرسة') || error.includes('الاشتراك')
                    ? 'bg-orange-50 border-orange-500'
                    : 'bg-red-50 border-red-500'
                }`}>
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    error.includes('المدرسة') || error.includes('الاشتراك')
                      ? 'text-orange-600'
                      : 'text-red-600'
                  }`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium whitespace-pre-line ${
                      error.includes('المدرسة') || error.includes('الاشتراك')
                        ? 'text-orange-800'
                        : 'text-red-800'
                    }`}>
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {/* Username Field */}
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  اسم المستخدم
                </label>
                <div className="relative">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    className="w-full px-4 py-3.5 pr-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400"
                    placeholder="أدخل اسم المستخدم"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setError('')
                    }}
                    disabled={loading}
                  />
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3.5 pr-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-gray-900 placeholder-gray-400"
                    placeholder="أدخل كلمة المرور"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    disabled={loading}
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري تسجيل الدخول...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>تسجيل الدخول</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Info */}
            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                نظام آمن ومحمي | جميع الحقوق محفوظة
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
