import { redirect } from 'next/navigation'

export default function Home() {
  // This will redirect to /login, which is excluded from middleware
  redirect('/login')
}


