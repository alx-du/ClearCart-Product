import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ChatInput from '../components/ChatInput.jsx'
import { addCart, getCartById, updateCart } from '../lib/carts.js'

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
          ? { ...message, text: result.reply, status: 'complete' }
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
    <div className="flex h-full flex-col bg-white">
      {!hasMessages ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <h1 className="flex items-center gap-3 text-4xl font-bold text-gray-900">
            ClearCart
            <span aria-hidden="true">🛒</span>
          </h1>
          <p className="text-xl text-gray-600">Let's look at a product together.</p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-md rounded-2xl bg-teal-50 px-5 py-3 text-lg font-medium text-gray-900">
                  {message.text}
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex justify-start">
                <div className="max-w-md rounded-2xl border-2 border-teal-500 bg-white px-5 py-4 text-lg text-gray-900">
                  <span className="mb-2 inline-block rounded-full bg-teal-600 px-3 py-1 text-sm font-semibold text-white">
                    {message.status === 'pending'
                      ? 'Thinking…'
                      : message.status === 'error'
                        ? 'Unable to respond'
                        : 'ClearCart'}
                  </span>
                  <p aria-live={message.status === 'pending' ? 'polite' : undefined}>{message.text}</p>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={isSending} />
    </div>
  )
}
