import { Link, NavLink } from 'react-router-dom'
import { useCarts } from '../hooks/useCarts.js'

const NAV_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/capstone-paper', label: 'Capstone Paper' },
  { to: '/technical-overview', label: 'Technical Overview' },
]

export default function Sidebar() {
  const carts = useCarts()

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col bg-teal-600 px-6 py-8 text-white">
      <NavLink to="/" className="mb-10 flex items-center gap-2 text-2xl font-bold">
        ClearCart
        <span aria-hidden="true">🛒</span>
      </NavLink>

      <nav className="flex flex-col gap-2">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-xl px-4 py-3 text-base font-medium transition ${
                isActive ? 'bg-white text-teal-700' : 'text-white hover:bg-teal-500/60'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-12 flex min-h-0 flex-1 flex-col">
        <h2 className="mb-3 px-4 text-sm font-semibold tracking-wide text-teal-50 uppercase">
          Previous Carts
        </h2>
        {carts.length === 0 ? (
          <p className="px-4 text-sm text-teal-50">Your searches will show up here.</p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {carts.map((cart) => (
              <li key={cart.id}>
                <Link
                  to="/"
                  state={{ cartId: cart.id }}
                  className="block truncate rounded-xl px-4 py-2 text-sm text-teal-50 hover:bg-teal-500/60"
                  title={cart.productName}
                >
                  {cart.productName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
