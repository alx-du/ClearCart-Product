import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ChatInput from '../components/ChatInput.jsx'
import { addCart, getCartById, updateCart } from '../lib/carts.js'

function getAssistantReply(productName) {
  // Stub: the real lookup + rating logic will replace this later.
  return productName
}

export default function Home() {
  const location = useLocation()
  const [messages, setMessages] = useState(() => {
    const cartId = location.state?.cartId
    return cartId ? (getCartById(cartId)?.messages ?? []) : []
  })
  // The one history entry this chat session belongs to — set on the first
  // message (or when reopening a saved cart), then reused for every
  // message after that instead of creating a new sidebar item each time.
  const cartIdRef = useRef(location.state?.cartId ?? null)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function handleSend(productName) {
    const userMessage = { id: crypto.randomUUID(), role: 'user', text: productName }
    const assistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: getAssistantReply(productName),
    }
    const nextMessages = [...messages, userMessage, assistantMessage]
    setMessages(nextMessages)

    if (cartIdRef.current) {
      updateCart(cartIdRef.current, nextMessages)
    } else {
      cartIdRef.current = addCart(productName, nextMessages).id
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
                    Found it!
                  </span>
                  <p>{message.text}</p>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <ChatInput onSend={handleSend} />
    </div>
  )
}
