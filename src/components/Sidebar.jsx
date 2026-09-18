import { Link, NavLink } from 'react-router-dom'
import { useCarts } from '../hooks/useCarts.js'

// Icon shapes are SVG path data drawn on a 24x24 grid.
const NAV_LINKS = [
  {
    to: '/about',
    label: 'About',
    icon: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M12 11v5', 'M12 8h.01'],
  },
  {
    to: '/capstone-paper',
    label: 'Capstone Paper',
    icon: ['M7 3h7l4 4v14H7Z', 'M14 3v4h4', 'M10 13h5', 'M10 17h5'],
  },
  {
    to: '/technical-overview',
    label: 'Technical Overview',
    icon: [
      'M4 7h9',
      'M17 7h3',
      'M4 17h3',
      'M11 17h9',
      'M13 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z',
      'M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z',
    ],
  },
]

// White panels sit on the pale teal gradient; the soft shadow and hairline ring
// (see `.panel` in index.css) keep them from dissolving into the background.
const PANEL = 'panel'
const FOCUS = 'focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none'

function NavIcon({ paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

export default function Sidebar() {
  const carts = useCarts()

  return (
    <aside className="relative hidden h-screen w-72 shrink-0 flex-col overflow-hidden bg-linear-to-b from-mist-100 via-mist-200 to-mist-300 text-slate-800 shadow-[-8px_0_24px_-12px_rgba(30,70,66,0.3)] md:flex">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-white/50 blur-3xl" />
        <div className="absolute -right-24 bottom-28 h-72 w-72 rounded-full bg-mist-100/60 blur-3xl" />
        <div className="sidebar-dots absolute inset-0" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-5 px-5 py-7">
        <NavLink
          to="/"
          className={`${PANEL} flex items-center gap-3 p-3 transition hover:bg-mist-300 ${FOCUS}`}
        >
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mist-200 text-2xl"
            aria-hidden="true"
          >
            🛒
          </span>
          <span className="text-2xl font-bold tracking-tight text-accent-800">ClearCart</span>
        </NavLink>

        <nav aria-label="Main" className={`${PANEL} flex flex-col gap-1.5 p-2`}>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition ${FOCUS} ${
                  isActive ? 'bg-accent-800 text-white shadow-md' : 'text-slate-800 hover:bg-mist-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isActive ? 'bg-white/20 text-white' : 'bg-mist-100 text-accent-700'
                    }`}
                  >
                    <NavIcon paths={link.icon} />
                  </span>
                  {link.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <section aria-labelledby="carts-heading" className={`${PANEL} flex min-h-0 flex-1 flex-col p-3`}>
          <h2
            id="carts-heading"
            className="mb-3 px-2 pt-1 text-sm font-semibold tracking-wide text-accent-800 uppercase"
          >
            Previous Carts
          </h2>

          {carts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mist-300 px-4 py-8 text-center">
              <span className="text-3xl" aria-hidden="true">
                🛒
              </span>
              <p className="text-sm text-slate-600">Products you add to your cart will show up here.</p>
            </div>
          ) : (
            <ul className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
              {carts.map((cart) => (
                <li key={cart.id}>
                  <Link
                    to="/"
                    state={{ cartId: cart.id }}
                    title={cart.productName}
                    className={`block truncate rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-mist-300 ${FOCUS}`}
                  >
                    {cart.productName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  )
}
