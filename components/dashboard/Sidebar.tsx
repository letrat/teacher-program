'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/components/providers/AuthProvider'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  CheckSquare, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { UserRole } from '@/types'
import { useIsMobile, useIsDesktop } from '@/lib/hooks/useIsMobile'
import { useWindowSize } from '@/lib/hooks/useWindowSize'
import AccountSettingsModal from './AccountSettingsModal'

interface NavItem {
  href: string
  label: string
  icon: any
  role?: UserRole[]
}

interface SidebarProps {
  userRole: UserRole
  userName: string
  onMobileToggle?: (isOpen: boolean) => void
}

export default function Sidebar({ userRole, userName, onMobileToggle }: SidebarProps) {
  const pathname = usePathname()
  const { logout } = useAuth()
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()
  const windowSize = useWindowSize()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [topBarHeight, setTopBarHeight] = useState(60) // ارتفاع افتراضي للـ TopBar
  const [showAccountModal, setShowAccountModal] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // تحميل حالة الطي من localStorage عند التحميل
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved !== null) {
      try {
        setIsCollapsed(JSON.parse(saved))
      } catch {
        setIsCollapsed(false)
      }
    }
  }, [])

  // حفظ حالة الطي في localStorage وإرسال event عند التغيير
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed))
    
    // إرسال event لتحديث Layout (للشاشات الكبيرة فقط)
    if (isDesktop) {
      window.dispatchEvent(new CustomEvent('sidebarToggle', { 
        detail: { isCollapsed } 
      }))
    }
  }, [isCollapsed, isDesktop])

  // حساب ارتفاع TopBar ديناميكياً
  useEffect(() => {
    const updateTopBarHeight = () => {
      if (typeof window === 'undefined') return
      
      const topBar = document.querySelector('header.sticky')
      if (topBar) {
        setTopBarHeight(topBar.getBoundingClientRect().height)
      } else {
        // ارتفاع افتراضي بناءً على الشاشة
        setTopBarHeight(windowSize.width >= 768 ? 60 : 56)
      }
    }

    updateTopBarHeight()
    
    // مراقبة تغييرات DOM للـ TopBar
    const observer = new MutationObserver(updateTopBarHeight)
    const topBarElement = document.querySelector('header.sticky')
    if (topBarElement) {
      observer.observe(topBarElement, { attributes: true, childList: true, subtree: true })
    }

    return () => {
      observer.disconnect()
    }
  }, [windowSize.width])

  const getNavItems = (): NavItem[] => {
    switch (userRole) {
      case UserRole.ADMIN:
        return [
          { href: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard },
          { href: '/admin/schools', label: 'المدارس', icon: Users },
          { href: '/admin/job-types', label: 'صفات الموظفين', icon: FileText },
          { href: '/admin/users', label: 'المستخدمين', icon: Users },
        ]
      case UserRole.SCHOOL_MANAGER:
        return [
          { href: '/school', label: 'لوحة المدرسة', icon: LayoutDashboard },
          { href: '/school/teachers', label: 'إدارة المعلمين', icon: Users },
          { href: '/school/kpis', label: 'إدارة المعايير', icon: FileText },
          { href: '/school/review', label: 'مراجعة الشواهد', icon: CheckSquare },
          { href: '/school/teachers/scores', label: 'أداء المعلمين', icon: BarChart3 },
        ]
      case UserRole.TEACHER:
        return [
          { href: '/teacher', label: 'لوحة التحكم', icon: LayoutDashboard },
          { href: '/teacher/progress', label: 'تقدّم المعايير', icon: TrendingUp },
          { href: '/teacher/submit', label: 'رفع شاهد', icon: FileText },
          { href: '/teacher/submissions', label: 'طلباتي', icon: CheckSquare },
        ]
      default:
        return []
    }
  }

  const navItems = getNavItems()

  const isActive = (href: string) => {
    if (href === '/school' || href === '/admin' || href === '/teacher') {
      return pathname === href
    }
    // Special handling for /school/teachers/scores - check this first to avoid conflict
    if (href === '/school/teachers/scores') {
      return pathname === '/school/teachers/scores' || (pathname.startsWith('/school/teachers/') && pathname.includes('/score'))
    }
    // Special handling for /school/teachers to avoid conflict with /school/teachers/scores
    if (href === '/school/teachers') {
      return pathname === '/school/teachers' && !pathname.includes('/score') && !pathname.includes('/scores')
    }
    return pathname.startsWith(href)
  }

  // Listen for mobile toggle events from TopBar
  useEffect(() => {
    const handleMobileToggle = (e: CustomEvent) => {
      setIsMobileOpen(e.detail.isMobileOpen)
      if (onMobileToggle) {
        onMobileToggle(e.detail.isMobileOpen)
      }
    }

    window.addEventListener('sidebarMobileToggle', handleMobileToggle as EventListener)
    return () => {
      window.removeEventListener('sidebarMobileToggle', handleMobileToggle as EventListener)
    }
  }, [onMobileToggle])

  const handleCollapseToggle = () => {
    setIsCollapsed(!isCollapsed)
  }

  // حساب عرض الـ Sidebar بناءً على الحالة
  const getSidebarWidth = () => {
    if (isMobile) {
      // على الجوال: عرض كامل عند الفتح
      if (isMobileOpen) {
        return isCollapsed ? 80 : (windowSize.width >= 640 ? 288 : Math.min(256, windowSize.width - 24))
      }
      // على الجوال، نستخدم عرض كامل لكن نحركه خارج الشاشة
      return windowSize.width >= 640 ? 288 : Math.min(256, windowSize.width - 24)
    } else {
      // على الشاشات الكبيرة: عرض بناءً على حالة الطي
      return isCollapsed ? 80 : (windowSize.width >= 640 ? 288 : 256)
    }
  }

  const currentWidth = windowSize.width > 0 ? getSidebarWidth() : 288

  return (
    <>
      {/* Mobile menu button - removed from here, moved to TopBar */}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white
          transition-all duration-300 ease-in-out shadow-2xl
          ${isCollapsed ? 'w-20' : 'w-64 sm:w-72'}
          lg:translate-x-0
          flex-shrink-0
          z-40
          relative
          [&::-webkit-scrollbar]:hidden
        `}
        style={{
          width: windowSize.width > 0 ? `${currentWidth}px` : isCollapsed ? '80px' : '288px',
          height: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: isMobile && isMobileOpen ? 'sticky' : (isMobile ? 'fixed' : 'sticky'),
          right: isMobile && !isMobileOpen ? 0 : 'auto',
          top: 0,
          alignSelf: 'flex-start', // مهم لـ sticky
          zIndex: typeof window !== 'undefined' && window.innerWidth < 1024 ? 40 : 'auto',
          transform: typeof window !== 'undefined' && window.innerWidth < 1024 
            ? (isMobileOpen ? 'translateX(0)' : 'translateX(100%)')
            : 'none',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE and Edge
        }}
      >
        {/* Toggle Button - في الحافة اليسرى للسايد بار (الموضع الأصلي) */}
        <button
          onClick={handleCollapseToggle}
          className="hidden lg:flex absolute w-8 h-8 bg-gray-700/90 hover:bg-gray-600 items-center justify-center text-gray-300 hover:text-white transition-all duration-200 z-[100] rounded-r-full rounded-l-none border-r border-gray-600/50 shadow-lg"
          aria-label={isCollapsed ? 'إظهار القائمة' : 'إخفاء القائمة'}
          style={{ 
            top: `${topBarHeight - 20}px`,
            left: '0',
            borderTopLeftRadius: '0',
            borderBottomLeftRadius: '0',
            borderTopRightRadius: '9999px',
            borderBottomRightRadius: '9999px',
          }}
        >
          {isCollapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        <div className="flex flex-col relative" style={{ minHeight: '100vh', paddingTop: isMobile ? '60px' : '0' }}>
          {/* Logo */}
          <div className={`py-3 px-6 border-b border-gray-700/50 transition-all duration-300 ${isCollapsed ? 'px-3' : ''}`} style={{ paddingTop: '12px', paddingBottom: '12px' }}>
            {isCollapsed ? (
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden bg-white">
                  <Image
                    src="/logos/01-01.png"
                    alt="قيم"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 flex items-center justify-center">
                  <Image
                    src="/logos/01-01.png"
                    alt="قيم"
                    width={64}
                    height={64}
                    className="object-contain"
                  />
                </div>
                <p className="text-xs text-gray-400">منصة حوكمة المعايير</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav 
            className="flex-1 overflow-y-auto p-4 space-y-2 [&::-webkit-scrollbar]:hidden"
            style={{ 
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none', // IE and Edge
            }}
          >
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.href} className="group relative">
                    <Link
                      href={item.href}
                      onClick={() => {
                        // إغلاق الـ Sidebar على الجوال عند النقر على رابط
                        if (isMobile) {
                          setIsMobileOpen(false)
                        }
                      }}
                      className={`
                        flex items-center rounded-xl transition-all duration-200 relative overflow-hidden
                        ${isCollapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'}
                        ${active
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                          : 'text-gray-300 hover:bg-gray-700/50 hover:text-white hover:scale-105'
                        }
                      `}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {/* Background effect */}
                      <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 opacity-0 transition-opacity duration-200 ${active ? 'opacity-100' : 'group-hover:opacity-100'}`}></div>
                      
                      <Icon className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? 'ml-0' : 'ml-3'} ${active ? 'scale-110' : ''}`} />
                      {!isCollapsed && (
                        <span className="font-medium relative z-10 mr-2">{item.label}</span>
                      )}
                      
                      {/* Active indicator */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
                      )}
                    </Link>
                    
                    {/* Tooltip when collapsed */}
                    {isCollapsed && (
                      <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-xl border border-gray-700">
                        {item.label}
                        <div className="absolute left-full top-1/2 -translate-y-1/2 -translate-x-1 border-4 border-transparent border-r-gray-900"></div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User info and logout */}
          <div className={`p-4 border-t border-gray-700/50 transition-all duration-300 ${isCollapsed ? 'px-2' : ''}`} style={{ marginTop: 'auto' }}>
            <button
              onClick={() => setShowAccountModal(true)}
              className={`w-full flex items-center mb-3 rounded-xl hover:bg-gray-700/50 transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? 'إعدادات الحساب' : undefined}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-white font-bold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              {!isCollapsed && (
                <div className="mr-3 flex-1 min-w-0 text-right">
                  <p className="text-sm font-medium text-white truncate">{userName}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {userRole === UserRole.ADMIN ? 'مدير النظام' : 
                     userRole === UserRole.SCHOOL_MANAGER ? 'مدير المدرسة' : 'معلم'}
                  </p>
                </div>
              )}
            </button>
            <button
              onClick={() => logout()}
              className={`
                w-full flex items-center rounded-xl text-gray-300 hover:bg-red-600/20 hover:text-red-300 transition-all duration-200
                ${isCollapsed ? 'justify-center px-3 py-2' : 'px-4 py-2'}
              `}
              title={isCollapsed ? 'تسجيل الخروج' : undefined}
            >
              <LogOut className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? 'ml-0' : 'ml-3'} hover:scale-110`} />
              <span className="font-medium mr-2">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Account Settings Modal */}
      <AccountSettingsModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
      />
    </>
  )
}
