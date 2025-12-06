'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { UserRole } from '@prisma/client'

interface DashboardLayoutProps {
  children: ReactNode
  title?: string
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { user } = useAuth()
  const userRole = user?.role || UserRole.TEACHER
  
  // For school managers, show school name with manager name
  let userName = user?.name || 'مستخدم'
  if (userRole === UserRole.SCHOOL_MANAGER && user?.school?.name) {
    userName = `${user.school.name} - ${user.name}`
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="flex min-h-screen relative">
        <Sidebar userRole={userRole} userName={userName} />
        
        <div 
          className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out min-h-screen max-w-full" 
          id="main-content"
        >
          <TopBar title={title} />
          
          <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
