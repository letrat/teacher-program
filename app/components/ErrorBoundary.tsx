'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Ignore browser extension errors
    if (error.message?.includes('message channel')) {
      console.warn('Browser extension error ignored')
      this.setState({ hasError: false })
      return
    }
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              حدث خطأ
            </h2>
            <p className="text-gray-600 mb-4">
              حدث خطأ غير متوقع. يرجى تحديث الصفحة.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}







