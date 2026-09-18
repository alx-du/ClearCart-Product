import { useState } from 'react'

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask about a product…',
  size = 'default',
}) {
  const [value, setValue] = useState('')
  const large = size === 'large'

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className={large ? 'w-full px-4' : 'px-4 pt-2 pb-5 sm:px-6'}>
      <div
        className={`mx-auto flex items-center gap-3 border-2 border-accent-600 bg-white shadow-md focus-within:border-accent-800 focus-within:ring-4 focus-within:ring-mist-300 ${
          large ? 'max-w-2xl rounded-3xl py-3 pr-3 pl-6' : 'max-w-3xl rounded-2xl py-2 pr-2 pl-5'
        }`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={placeholder}
          className={`min-w-0 flex-1 bg-transparent text-slate-900 placeholder-slate-500 outline-none ${
            large ? 'text-xl' : 'text-lg'
          }`}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={disabled}
          className={`flex shrink-0 items-center justify-center rounded-xl bg-accent-800 text-white transition hover:bg-accent-900 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-400 ${
            large ? 'h-14 w-14' : 'h-12 w-12'
          }`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M20 12L4 4L10 12L4 20L20 12Z" />
          </svg>
        </button>
      </div>
    </form>
  )
}
