import DashboardLayout from '@/components/dashboard/Layout'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}


