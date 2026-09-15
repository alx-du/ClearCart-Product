import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import AssessmentCard from '../components/AssessmentCard.jsx'
import ChatInput from '../components/ChatInput.jsx'
import { addCart, getCartById, updateCart } from '../lib/carts.js'

const STARTER_PROMPTS = [
  'Is this product durable and worth the price?',
  'What should I check before buying this?',
  'How can I compare two similar products?',
]

export default function Home() {
  const location = useLocation()
  const [messages, setMessages] = useState(() => {
    const cartId = location.state?.cartId
    return cartId ? (getCartById(cartId)?.messages ?? []) : []
  })
  const [isSending, setIsSending] = useState(false)
  // The one history entry this chat session belongs to — set on the first
  // message (or when reopening a saved cart), then reused for every
  // message after that instead of creating a new sidebar item each time.
  const cartIdRef = useRef(location.state?.cartId ?? null)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSend(productName) {
    const userMessage = { id: crypto.randomUUID(), role: 'user', text: productName }
    const pendingMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: 'Researching that product…',
      status: 'pending',
    }
    const requestMessages = [...messages, userMessage]
    const pendingMessages = [...requestMessages, pendingMessage]
    setMessages(pendingMessages)
    setIsSending(true)

    if (cartIdRef.current) {
      updateCart(cartIdRef.current, pendingMessages)
    } else {
      cartIdRef.current = addCart(productName, pendingMessages).id
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages.map(({ role, text }) => ({ role, text })),
        }),
      })
      const result = await response.json()
      if (!response.ok || typeof result.reply !== 'string') {
        throw new Error(result.message || 'The assistant could not respond')
      }

      const completedMessages = pendingMessages.map((message) =>
        message.id === pendingMessage.id
          ? {
              ...message,
              text: result.reply,
              assessment: result.assessment ?? null,
              status: 'complete',
            }
          : message,
      )
      setMessages(completedMessages)
      updateCart(cartIdRef.current, completedMessages)
    } catch (error) {
      console.error('Assistant request failed:', error)
      const failedMessages = pendingMessages.map((message) =>
        message.id === pendingMessage.id
          ? {
              ...message,
              text: 'I could not reach the research assistant. Please try again.',
              status: 'error',
            }
          : message,
      )
      setMessages(failedMessages)
      updateCart(cartIdRef.current, failedMessages)
    } finally {
      setIsSending(false)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 md:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2 text-xl font-bold text-teal-800">
          <span aria-hidden="true">🛒</span>
          ClearCart
        </div>
      </header>
      {!hasMessages ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-5 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-3xl" aria-hidden="true">
            🛒
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Shop with more confidence
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-8 text-slate-600">
              Ask ClearCart about a product's quality, value, impact, or transparency.
            </p>
          </div>
          <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={isSending}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-teal-400 hover:bg-teal-50 focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:outline-none disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-xl rounded-2xl rounded-br-md bg-teal-700 px-5 py-3 text-base font-medium text-white sm:text-lg">
                    {message.text}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="flex justify-start">
                  {message.assessment && message.status === 'complete' ? (
                    <AssessmentCard assessment={message.assessment} />
                  ) : (
                    <div className="max-w-2xl rounded-2xl rounded-bl-md border border-slate-200 bg-white px-5 py-4 text-base leading-7 text-slate-900 shadow-sm sm:text-lg">
                      <span className="mb-2 inline-block rounded-full bg-teal-600 px-3 py-1 text-sm font-semibold text-white">
                        {message.status === 'pending'
                          ? 'Thinking…'
                          : message.status === 'error'
                            ? 'Unable to respond'
                            : 'ClearCart'}
                      </span>
                      <p aria-live={message.status === 'pending' ? 'polite' : undefined}>
                        {message.text}
                      </p>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={isSending} />
    </div>
  )
}
