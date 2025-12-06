import DashboardLayout from '@/components/dashboard/Layout'

export default function SchoolLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}


