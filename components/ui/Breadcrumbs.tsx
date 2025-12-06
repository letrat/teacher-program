'use client'

import Link from 'next/link'
import { ChevronLeft, Home, Sparkles } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-2 mb-5">
      <Link
        href="/"
        className="group relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105"
        title="الرئيسية"
      >
        <Home className="w-4 h-4 text-white transition-transform group-hover:scale-110" />
        <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-gradient-to-r from-blue-400 to-purple-400"></div>
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </div>
          {item.href && index < items.length - 1 ? (
            <Link
              href={item.href}
              className="group relative px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 border border-gray-200 hover:border-blue-300 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <span className="relative z-10">{item.label}</span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-300"></div>
            </Link>
          ) : (
            <span className="relative px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-md flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              <div className="absolute inset-0 rounded-xl bg-white opacity-10"></div>
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}



