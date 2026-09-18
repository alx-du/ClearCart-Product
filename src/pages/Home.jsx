import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation } from 'react-router-dom'
import AssessmentCard from '../components/AssessmentCard.jsx'
import ChatInput from '../components/ChatInput.jsx'
import ProductConfirmCard from '../components/ProductConfirmCard.jsx'
import { addCart, getCartById, updateCart } from '../lib/carts.js'

const STARTER_PROMPTS = [
  'Is this product durable and worth the price?',
  'What should I check before buying this?',
  'How can I compare two similar products?',
]

// Lets the centered hero input glide down to the bottom bar. Browsers without
// view transitions just swap instantly.
function withViewTransition(update) {
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => flushSync(update))
  } else {
    update()
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Request failed')
  return result
}

// What the model should see: the confirmed product name, its assessment, and
// the follow-up Q&A. Raw search text and the confirm-card steps are UI-only.
function toModelMessages(messages) {
  return messages.flatMap((message) => {
    if (message.kind === 'search' || message.status === 'pending' || message.status === 'error') {
      return []
    }
    if (message.kind === 'confirm') {
      return message.status === 'confirmed' ? [{ role: 'user', text: message.confirmedName }] : []
    }
    if (message.role === 'user') return [{ role: 'user', text: message.text }]
    return [
      {
        role: 'assistant',
        text: message.assessment ? JSON.stringify(message.assessment) : message.text,
      },
    ]
  })
}

function badgeLabel(status) {
  if (status === 'pending' || status === 'searching') return 'Thinking…'
  if (status === 'error') return 'Unable to respond'
  return 'ClearCart'
}

function AssistantBubble({ message, onRetry }) {
  const live = message.status === 'pending' || message.status === 'searching'

  return (
    <div className="panel max-w-2xl rounded-bl-md px-5 py-4 text-base leading-7 text-slate-900 shadow-sm sm:text-lg">
      <span className="mb-2 inline-block rounded-full bg-accent-800 px-3 py-1 text-sm font-semibold text-white">
        {badgeLabel(message.status)}
      </span>
      <p className="whitespace-pre-line" aria-live={live ? 'polite' : undefined}>
        {message.text}
      </p>
      {message.status === 'error' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full border-2 border-accent-800 px-5 py-2 text-base font-semibold text-accent-800 transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export default function Home() {
  const location = useLocation()
  const [messages, setMessages] = useState(() => {
    const cartId = location.state?.cartId
    return cartId ? (getCartById(cartId)?.messages ?? []) : []
  })
  const [isBusy, setIsBusy] = useState(false)
  // Always the latest messages, so async handlers never work from a stale snapshot.
  const messagesRef = useRef(messages)
  // The one history entry this session belongs to. It's created when the user
  // confirms a product (or set when reopening a saved cart) and reused after.
  const cartIdRef = useRef(location.state?.cartId ?? null)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function commit(next) {
    messagesRef.current = next
    setMessages(next)
    if (cartIdRef.current) updateCart(cartIdRef.current, next)
  }

  function patchMessage(id, changes) {
    commit(messagesRef.current.map((message) => (message.id === id ? { ...message, ...changes } : message)))
  }

  async function handleSearch(query) {
    const cardId = crypto.randomUUID()
    const isFirstMessage = messagesRef.current.length === 0
    const next = [
      ...messagesRef.current,
      { id: crypto.randomUUID(), role: 'user', kind: 'search', text: query },
      {
        id: cardId,
        role: 'assistant',
        kind: 'confirm',
        status: 'searching',
        text: 'Looking for that product…',
        candidates: [],
        candidateIndex: 0,
      },
    ]
    messagesRef.current = next
    const show = () => {
      setMessages(next)
      setIsBusy(true)
    }
    if (isFirstMessage) withViewTransition(show)
    else show()

    try {
      const result = await postJson('/api/resolve-product', { query })
      if (!Array.isArray(result.candidates)) throw new Error('Unexpected response')
      patchMessage(
        cardId,
        result.candidates.length > 0
          ? { status: 'pending', candidates: result.candidates }
          : {
              status: 'none',
              text:
                result.message ?? "I couldn't find that product. Try describing it a different way.",
            },
      )
    } catch (error) {
      console.error('Product lookup failed:', error)
      patchMessage(cardId, {
        status: 'error',
        text: 'I could not look that up right now. Please try again.',
      })
    } finally {
      setIsBusy(false)
    }
  }

  function handleDecision(cardId, accepted) {
    const card = messagesRef.current.find((message) => message.id === cardId)
    if (!card) return

    if (!accepted) {
      const nextIndex = card.candidateIndex + 1
      patchMessage(
        cardId,
        nextIndex < card.candidates.length
          ? { candidateIndex: nextIndex }
          : {
              status: 'none',
              text: "Okay, I'll need a bit more to go on. Try describing the product a different way.",
            },
      )
      return
    }

    const name = card.candidates[card.candidateIndex].name
    const assessmentMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'assessment',
      status: 'pending',
      text: 'Building your assessment…',
      productName: name,
    }
    commit([
      ...messagesRef.current.map((message) =>
        message.id === cardId ? { ...message, status: 'confirmed', confirmedName: name } : message,
      ),
      assessmentMessage,
    ])
    if (!cartIdRef.current) {
      cartIdRef.current = addCart(name, messagesRef.current).id
    }
    runAssessment(assessmentMessage.id, name)
  }

  async function runAssessment(messageId, name) {
    patchMessage(messageId, { status: 'pending', text: 'Building your assessment…' })
    setIsBusy(true)
    try {
      const result = await postJson('/api/chat', {
        mode: 'assessment',
        messages: [{ role: 'user', text: name }],
      })
      if (typeof result.reply !== 'string') throw new Error('Unexpected response')
      patchMessage(messageId, {
        status: 'complete',
        text: result.reply,
        assessment: result.assessment ?? null,
      })
    } catch (error) {
      console.error('Assessment failed:', error)
      patchMessage(messageId, {
        status: 'error',
        text: 'I could not reach the research assistant. Please try again.',
      })
    } finally {
      setIsBusy(false)
    }
  }

  async function handleFollowup(text) {
    const answerId = crypto.randomUUID()
    const next = [
      ...messagesRef.current,
      { id: crypto.randomUUID(), role: 'user', kind: 'followup', text },
      { id: answerId, role: 'assistant', kind: 'answer', status: 'pending', text: 'Thinking…' },
    ]
    commit(next)
    setIsBusy(true)

    try {
      const result = await postJson('/api/chat', { mode: 'chat', messages: toModelMessages(next) })
      if (typeof result.reply !== 'string') throw new Error('Unexpected response')
      patchMessage(answerId, { status: 'complete', text: result.reply, assessment: null })
    } catch (error) {
      console.error('Follow-up failed:', error)
      patchMessage(answerId, {
        status: 'error',
        text: 'I could not reach the research assistant. Please try again.',
      })
    } finally {
      setIsBusy(false)
    }
  }

  const hasMessages = messages.length > 0
  const last = messages.at(-1)
  const awaitingDecision = last?.kind === 'confirm' && last.status === 'pending'
  const inFollowupMode = messages.some(
    (message) => (message.kind === 'confirm' && message.status === 'confirmed') || message.assessment,
  )
  // The starter prompts only appear once the initial assessment has finished.
  const showStarters = !isBusy && last?.status === 'complete' && Boolean(last.assessment)
  const placeholder = awaitingDecision
    ? 'Confirm the product above to continue…'
    : inFollowupMode
      ? 'Ask a follow-up question…'
      : 'Enter a product name or paste a link…'
  const handleSend = inFollowupMode ? handleFollowup : handleSearch

  return (
    <div className="flex h-screen flex-col">
      {hasMessages && (
        <header className="border-b border-accent-900/10 bg-white px-4 py-4 sm:px-6 md:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2 text-xl font-bold text-accent-800">
            <span aria-hidden="true">🛒</span>
            ClearCart
          </div>
        </header>
      )}

      {!hasMessages ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 pt-10 pb-24">
          <h1 className="flex items-center gap-3 text-4xl font-bold text-accent-800">
            ClearCart
            <span aria-hidden="true">🛒</span>
          </h1>
          <p className="text-xl text-slate-600">Let's look at a product together.</p>
          <div className="chat-input-shell mt-4 w-full">
            <ChatInput
              size="large"
              onSend={handleSend}
              disabled={isBusy}
              placeholder={placeholder}
            />
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((message) => {
                if (message.role === 'user') {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-xl rounded-2xl rounded-br-md bg-accent-800 px-5 py-3 text-base font-medium text-white sm:text-lg">
                        {message.text}
                      </div>
                    </div>
                  )
                }

                const showCard =
                  message.kind === 'confirm' &&
                  (message.status === 'pending' || message.status === 'confirmed')

                return (
                  <div key={message.id} className="flex justify-start">
                    {showCard ? (
                      <ProductConfirmCard
                        candidate={message.candidates[message.candidateIndex]}
                        position={
                          message.candidates.length > 1
                            ? `Result ${message.candidateIndex + 1} of ${message.candidates.length}`
                            : null
                        }
                        status={message.status}
                        canShowMore={message.candidateIndex + 1 < message.candidates.length}
                        canGoBack={message.candidateIndex > 0}
                        onBack={() => patchMessage(message.id, { candidateIndex: message.candidateIndex - 1 })}
                        onDecision={(accepted) => handleDecision(message.id, accepted)}
                      />
                    ) : message.assessment && message.status === 'complete' ? (
                      <AssessmentCard assessment={message.assessment} />
                    ) : (
                      <AssistantBubble
                        message={message}
                        onRetry={
                          message.productName && !isBusy
                            ? () => runAssessment(message.id, message.productName)
                            : undefined
                        }
                      />
                    )}
                  </div>
                )
              })}

              {showStarters && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleFollowup(prompt)}
                      className="panel px-4 py-4 text-left text-sm font-medium text-slate-800 shadow-sm transition hover:bg-mist-300 focus-visible:ring-4 focus-visible:ring-accent-600 focus-visible:outline-none"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="chat-input-shell">
            <ChatInput
              onSend={handleSend}
              disabled={isBusy || awaitingDecision}
              placeholder={placeholder}
            />
          </div>
        </>
      )}
    </div>
  )
}
