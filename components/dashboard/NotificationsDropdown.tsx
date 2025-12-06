'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, CheckCheck, X, FileText, CheckCircle, XCircle, UserPlus, Award, Settings, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import api from '@/lib/api'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

export default function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    // تحديث التنبيهات كل 30 ثانية
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const fetchNotifications = async () => {
    try {
      const data = await api.notifications.list(false, 20) as { notifications?: any[]; unreadCount?: number }
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
      // If table doesn't exist or backend is not running, return empty
      setNotifications([])
      setUnreadCount(0)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await api.notifications.markRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      setLoading(true)
      await api.notifications.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('تم تحديد جميع التنبيهات كمقروءة')
    } catch (error) {
      toast.error('حدث خطأ في تحديث التنبيهات')
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'EVIDENCE_SUBMITTED':
        return <FileText className="w-5 h-5 text-blue-600" />
      case 'EVIDENCE_ACCEPTED':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'EVIDENCE_REJECTED':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'TEACHER_ADDED':
        return <UserPlus className="w-5 h-5 text-purple-600" />
      case 'KPI_ADDED':
      case 'EVIDENCE_ADDED':
        return <Award className="w-5 h-5 text-yellow-600" />
      case 'WEIGHT_UPDATED':
        return <Settings className="w-5 h-5 text-indigo-600" />
      default:
        return <Bell className="w-5 h-5 text-gray-600" />
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'الآن'
    if (minutes < 60) return `منذ ${minutes} دقيقة`
    if (hours < 24) return `منذ ${hours} ساعة`
    if (days < 7) return `منذ ${days} يوم`
    return date.toLocaleDateString('ar-SA')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="التنبيهات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 left-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[calc(100vh-120px)] sm:max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">التنبيهات</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4" />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>لا توجد تنبيهات</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm mb-1">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400">
                                {formatTime(notification.createdAt)}
                              </span>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                              )}
                            </div>
                          </div>
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded"
                              title="تحديد كمقروء"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {notification.link && (
                          <Link
                            href={notification.link}
                            onClick={() => {
                              markAsRead(notification.id)
                              setIsOpen(false)
                            }}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            عرض التفاصيل
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

