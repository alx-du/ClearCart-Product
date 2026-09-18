import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function Layout() {
  return (
    <div className="flex min-h-screen w-full bg-white">
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      <Sidebar />
    </div>
  )
}
