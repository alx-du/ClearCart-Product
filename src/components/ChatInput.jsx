import { useState } from 'react'

export default function ChatInput({ onSend, placeholder = "The product I'd like to look at is..." }) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-gray-50 px-6 py-5">
      <div className="flex items-center gap-3 rounded-full border-2 border-gray-300 bg-white py-2 pr-2 pl-6 focus-within:border-teal-500">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-lg text-gray-900 placeholder-gray-500 outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white transition hover:bg-teal-700"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M4 12L20 4L14 12L20 20L4 12Z" />
          </svg>
        </button>
      </div>
    </form>
  )
}
