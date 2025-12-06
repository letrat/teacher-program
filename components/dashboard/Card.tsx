'use client'

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface CardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  children?: ReactNode
  className?: string
}

export default function Card({
  title,
  value,
  icon: Icon,
  iconColor = 'text-blue-600',
  trend,
  children,
  className = '',
}: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 ${className}`}>
      <div className="p-4 sm:p-5 md:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{value}</h3>
            {trend && (
              <div className={`flex items-center mt-2 text-xs sm:text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <span className="ml-1">{trend.isPositive ? '↑' : '↓'}</span>
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${
              iconColor.includes('blue') ? 'bg-blue-100' : 
              iconColor.includes('green') ? 'bg-green-100' : 
              iconColor.includes('yellow') ? 'bg-yellow-100' : 
              iconColor.includes('purple') ? 'bg-purple-100' :
              iconColor.includes('orange') ? 'bg-orange-100' :
              iconColor.includes('indigo') ? 'bg-indigo-100' :
              'bg-red-100'
            }`}>
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

