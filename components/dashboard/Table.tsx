'use client'

import { ReactNode } from 'react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (value: any, row: T) => ReactNode
  className?: string
  hideOnMobile?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  className?: string
  emptyMessage?: string
}

export default function Table<T extends { id: string }>({
  columns,
  data,
  onRowClick,
  className = '',
  emptyMessage = 'لا توجد بيانات',
}: TableProps<T>) {
  const isMobile = useIsMobile()
  const visibleColumns = isMobile ? columns.filter(col => !col.hideOnMobile) : columns

  // Card view for mobile
  if (isMobile && data.length > 0) {
    return (
      <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
        <div className="divide-y divide-gray-200">
          {data.map((row) => (
            <div
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={`p-4 ${onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
            >
              <div className="space-y-2">
                {visibleColumns.map((column, index) => {
                  const value = typeof column.key === 'string' 
                    ? (row as any)[column.key]
                    : row[column.key as keyof T]
                  
                  return (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="text-xs font-medium text-gray-500 sm:w-1/3">
                        {column.label}:
                      </span>
                      <span className={`text-sm text-gray-900 sm:w-2/3 ${column.className || ''}`}>
                        {column.render ? column.render(value, row) : value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Table view for desktop
  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''} ${column.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 sm:px-6 py-12 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
                >
                  {columns.map((column, index) => {
                    const value = typeof column.key === 'string' 
                      ? (row as any)[column.key]
                      : row[column.key as keyof T]
                    
                    return (
                      <td
                        key={index}
                        className={`px-4 sm:px-6 py-4 text-sm text-gray-900 ${column.className || ''} ${column.hideOnMobile ? 'hidden md:table-cell' : ''} ${typeof value === 'string' && value.length > 50 ? 'break-words' : 'whitespace-nowrap'}`}
                      >
                        {column.render ? column.render(value, row) : value}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}






