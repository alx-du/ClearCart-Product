import { Link, NavLink, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

const MOBILE_LINK =
  'rounded-lg px-3 py-2 text-base font-semibold focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none'

// The sidebar is hidden below md, so phones get a slim bar with the main links.
function MobileHeader() {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-accent-900/10 bg-white px-4 py-3 md:hidden">
      <Link to="/" className="flex items-center gap-2 text-xl font-bold text-accent-800">
        <span aria-hidden="true">🛒</span>
        ClearCart
      </Link>
      <nav aria-label="Main" className="flex gap-1">
        {[
          ['/', 'Search'],
          ['/catalogue', 'Catalogue'],
        ].map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${MOBILE_LINK} ${isActive ? 'bg-accent-800 text-white' : 'text-slate-800 hover:bg-mist-300'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

export default function Layout() {
  return (
    <div className="flex h-screen w-full bg-white">
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <MobileHeader />
        <Outlet />
      </main>
      <Sidebar />
    </div>
  )
}
