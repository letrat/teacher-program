'use client'

import { Toaster } from 'react-hot-toast'

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{
        zIndex: 99999,
        top: '20px',
        position: 'fixed',
      }}
      toastOptions={{
        // Default options
        className: '',
        duration: 4000,
        style: {
          background: '#fff',
          color: '#363636',
          direction: 'rtl',
          fontFamily: 'inherit',
          zIndex: 99999,
        },
        // Success
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
          style: {
            border: '1px solid #10b981',
            zIndex: 99999,
          },
        },
        // Error
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
          style: {
            border: '2px solid #ef4444',
            background: '#fee2e2',
            color: '#991b1b',
            fontWeight: 'bold',
            padding: '16px',
            fontSize: '16px',
            zIndex: 99999,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
          },
        },
        // Loading
        loading: {
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#fff',
          },
        },
      }}
    />
  )
}





