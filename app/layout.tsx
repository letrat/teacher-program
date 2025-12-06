import type { Metadata } from 'next'
import { IBM_Plex_Sans_Arabic } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import ToastProvider from '@/components/ui/ToastProvider'
import GlobalErrorHandler from './components/GlobalErrorHandler'

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans-arabic',
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  title: 'قيم - منصة حوكمة المعايير',
  description: 'قيم - منصة حوكمة المعايير وتقييم الأداء للمعلمين',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexSansArabic.variable}>
      <body className={ibmPlexSansArabic.className}>
        <GlobalErrorHandler />
        <AuthProvider>
          {children}
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  )
}

