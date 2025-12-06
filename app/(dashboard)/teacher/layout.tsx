import DashboardLayout from '@/components/dashboard/Layout'

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}


