'use client'

import { useState, useEffect } from 'react'
import { Search, X, Menu } from 'lucide-react'
import NotificationsDropdown from './NotificationsDropdown'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import Modal from '@/components/ui/Modal'

interface TopBarProps {
  title?: string
}

export default function TopBar({ title }: TopBarProps) {
  const isMobile = useIsMobile()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Listen for sidebar mobile toggle events
  useEffect(() => {
    const handleSidebarToggle = (e: CustomEvent) => {
      setIsMobileMenuOpen(e.detail.isMobileOpen)
    }

    window.addEventListener('sidebarMobileToggle', handleSidebarToggle as EventListener)
    return () => {
      window.removeEventListener('sidebarMobileToggle', handleSidebarToggle as EventListener)
    }
  }, [])

  const handleMobileMenuToggle = () => {
    const newState = !isMobileMenuOpen
    setIsMobileMenuOpen(newState)
    window.dispatchEvent(new CustomEvent('sidebarMobileToggle', { 
      detail: { isMobileOpen: newState } 
    }))
  }

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Mobile menu button - inside TopBar */}
            {isMobile && (
              <button
                onClick={handleMobileMenuToggle}
                className="p-2 rounded-lg bg-white shadow-md text-gray-700 hover:bg-gray-50 transition-all duration-200 flex-shrink-0"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

            <div className="flex-1 min-w-0">
              {title && (
                <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 truncate">{title}</h1>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
              {/* Search - Desktop */}
              <div className="relative hidden md:block">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="بحث..."
                  className="pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48 lg:w-64 text-sm"
                />
              </div>

              {/* Search Button - Mobile */}
              {isMobile && (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="بحث"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
              
              {/* Notifications */}
              <NotificationsDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Search Modal - Mobile */}
      {isMobile && (
        <Modal
          isOpen={isSearchOpen}
          onClose={() => {
            setIsSearchOpen(false)
            setSearchQuery('')
          }}
          title="بحث"
          size="sm"
        >
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ابحث..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              autoFocus
            />
          </div>
          {searchQuery && (
            <div className="mt-4 text-sm text-gray-600">
              نتائج البحث عن: <span className="font-semibold">{searchQuery}</span>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}




