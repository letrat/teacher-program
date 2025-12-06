import React from 'react'
import { UserRole } from '@prisma/client'

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

interface SchoolCardProps {
  school: School
  onViewDetails: (school: School) => void
  onToggleStatus: (schoolId: string, currentStatus: boolean) => void
}

export const SchoolCard: React.FC<SchoolCardProps> = ({ school, onViewDetails, onToggleStatus }) => {
  const manager = school.users.find(u => u.role === 'SCHOOL_MANAGER')

  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer group"
      onClick={() => onViewDetails(school)}
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
            🏫
          </div>
          <span 
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              school.status 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}
          >
            {school.status ? 'نشط' : 'معطل'}
          </span>
        </div>
        
        <h3 className="text-lg font-bold text-gray-900 mb-1 truncate" title={school.name}>
          {school.name}
        </h3>
        
        {manager && (
          <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
            <span className="w-4 h-4 flex items-center justify-center bg-gray-100 rounded-full text-[10px]">👤</span>
            {school.name} - {manager.name}
          </p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">{school._count.users}</span> مستخدم
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleStatus(school.id, school.status)
            }}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              school.status
                ? 'text-red-600 hover:bg-red-50'
                : 'text-green-600 hover:bg-green-50'
            }`}
          >
            {school.status ? 'تعطيل' : 'تفعيل'}
          </button>
        </div>
      </div>
    </div>
  )
}


