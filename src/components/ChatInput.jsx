import { useState } from 'react'

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask about a product…',
}) {
  const [value, setValue] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border-2 border-slate-300 bg-white py-2 pr-2 pl-5 shadow-sm focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-100">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-lg text-gray-900 placeholder-gray-500 outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={disabled}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition hover:bg-teal-700 focus-visible:ring-4 focus-visible:ring-teal-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M4 12L20 4L14 12L20 20L4 12Z" />
          </svg>
        </button>
      </div>
    </form>
  )
}
