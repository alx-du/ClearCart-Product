import { useState } from 'react'

export default function SearchInput({ initialValue = '', onSearch, size = 'default' }) {
  const [value, setValue] = useState(initialValue)
  const large = size === 'large'

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSearch(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="w-full">
      <div
        className={`mx-auto flex items-center gap-3 border-2 border-accent-600 bg-white shadow-md focus-within:border-accent-800 focus-within:ring-4 focus-within:ring-mist-300 ${
          large ? 'max-w-2xl rounded-3xl py-3 pr-3 pl-6' : 'max-w-3xl rounded-2xl py-2 pr-2 pl-5'
        }`}
      >
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter a product name…"
          aria-label="Product name"
          className={`min-w-0 flex-1 bg-transparent text-slate-900 placeholder-slate-500 outline-none ${
            large ? 'text-xl' : 'text-lg'
          }`}
        />
        <button
          type="submit"
          aria-label="Search"
          className={`flex shrink-0 items-center justify-center rounded-xl bg-accent-800 text-white transition hover:bg-accent-900 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none ${
            large ? 'h-14 w-14' : 'h-12 w-12'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </button>
      </div>
    </form>
  )
}
