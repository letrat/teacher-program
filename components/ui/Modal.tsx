'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showCloseButton?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  const isMobile = useIsMobile()
  const modalRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(0)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
      setDragY(0)
      setIsDragging(false)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Swipe to close handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return
    startY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current
    if (diff > 0) {
      setDragY(diff)
    }
  }

  const handleTouchEnd = () => {
    if (!isMobile || !isDragging) return
    setIsDragging(false)
    if (dragY > 100) {
      onClose()
    }
    setDragY(0)
  }

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  const mobileSizes = {
    sm: 'max-w-[95%]',
    md: 'max-w-[95%]',
    lg: 'max-w-[98%]',
    xl: 'max-w-[98%]',
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end sm:items-center justify-center min-h-screen px-2 sm:px-4 pt-4 pb-4 sm:pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          ref={modalRef}
          className={`
            inline-block align-bottom bg-white rounded-t-2xl sm:rounded-lg text-right overflow-hidden shadow-xl
            transform transition-all w-full
            ${isMobile ? mobileSizes[size] : sizes[size]}
            ${isMobile ? 'sm:my-8 sm:align-middle' : 'my-8 align-middle'}
          `}
          style={{
            transform: isMobile && dragY > 0 
              ? `translateY(${dragY}px)` 
              : undefined,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Swipe indicator for mobile */}
          {isMobile && (
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 pr-2">{title}</h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-150px)] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}






