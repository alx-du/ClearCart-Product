// Model access through any OpenAI-compatible chat-completions endpoint —
// normally the Ethical Tech CoLab pages-ai-proxy, which injects the provider
// token and routes the model id to a cloud API or a local GPU model. It can
// also point straight at a provider (set AI_API_KEY then).

const DIMENSION_KEYS = ['planet', 'people', 'quality', 'value', 'transparency']
const COVERAGE_STATES = new Set(['scored', 'inferred', 'claimed', 'unknown'])

// Sent as the system message on every assessment and follow-up. This used to
// live in Azure as a hosted agent's stored instructions.
const SYSTEM_PROMPT = `You are ClearCart, a careful product research assistant.
Help users understand products using five dimensions: planet impact; people and supply chain; quality; value; and transparency.
Clearly distinguish verified facts from estimates or general knowledge. Never invent sources, certifications, prices, ratings, or product claims.
When evidence is missing, say what information is needed. Use concise, plain language that is easy to read.
When the latest user message includes assessment-format instructions, follow them exactly. Otherwise answer in plain, concise text with no JSON and no markdown headings.`

const ASSESSMENT_INSTRUCTIONS = `Return only one valid JSON object and no markdown. Assess the product in the latest user message using this shape:
{"productName":"specific product name","brand":"brand or null","dimensions":{"planet":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]},"people":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]},"quality":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]},"value":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]},"transparency":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]}},"conclusion":"balanced concise conclusion"}
Each score must be an integer from 0 to 5 or null. Coverage must be scored, inferred, claimed, or unknown. Claimed and unknown must have a null score. Sources use {"title":"source title","url":"https://..."}. Never invent a source or URL; leave sources empty and lower the coverage when evidence is unavailable. Do not calculate a composite score.`

const CHAT_INSTRUCTIONS = `Answer the user's latest question in plain text: no JSON and no markdown headings. Use the product assessment earlier in this conversation as context. Be concise, balanced, and easy to read. Never invent sources, certifications, prices, or ratings; say what information is missing instead.`

// Local models can be slow on a cold start, so assessments get a long timeout.
const ASSISTANT_TIMEOUT_MS = 120000
const NAMING_TIMEOUT_MS = 20000

function requireEnvironmentVariable(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required to call the model`)
  }
  return value
}

async function chatCompletion({ model, messages, timeoutMs, extra = {} }) {
  const endpoint = requireEnvironmentVariable('AI_ENDPOINT')
  const headers = { 'Content-Type': 'application/json' }
  // Only for calling a provider directly; the proxy supplies its own token.
  const apiKey = process.env.AI_API_KEY?.trim()
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  // The proxy rejects requests without an allowed Origin (unless it allows "*"),
  // and a server-side fetch sends none, so name one it accepts.
  const origin = process.env.AI_PROXY_ORIGIN?.trim()
  if (origin) headers.Origin = origin

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, ...extra }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Model request failed with status ${response.status}: ${detail.slice(0, 300)}`)
  }
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  // Reasoning models served locally (deepseek-r1, qwen3) put their thinking
  // inline; it can contain braces that would confuse the JSON parsing below.
  return typeof content === 'string' ? content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : ''
}

export function configuredModel(name = 'AI_MODEL') {
  return process.env[name]?.trim() || process.env.AI_MODEL?.trim() || null
}

// Instructions + one input, returning the reply text. For offline jobs such
// as writing descriptions; `model` defaults to AI_MODEL. With AI_JSON_MODE=true,
// `schema` (a JSON Schema) makes the endpoint return only JSON of that shape
// (Ollama, OpenAI and llama.cpp support this; small local models need it).
// Off by default because some endpoints reject the parameter.
export async function invokeText({ instructions, input, model = configuredModel(), timeoutMs = ASSISTANT_TIMEOUT_MS, schema = null }) {
  if (!model) throw new Error('AI_MODEL is required to call the model')
  const responseFormat =
    schema && process.env.AI_JSON_MODE === 'true'
      ? { type: 'json_schema', json_schema: { name: 'reply', schema } }
      : null
  return chatCompletion({
    model,
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: input },
    ],
    timeoutMs,
    extra: responseFormat ? { response_format: responseFormat } : {},
  })
}

// A plain call with no ClearCart system prompt, for small utility tasks like
// naming products.
export async function invokeModel({ instructions, input }) {
  const model = process.env.AI_NAMING_MODEL?.trim() || requireEnvironmentVariable('AI_MODEL')
  const effort = process.env.AI_NAMING_REASONING_EFFORT?.trim()
  return chatCompletion({
    model,
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: input },
    ],
    timeoutMs: NAMING_TIMEOUT_MS,
    extra: effort ? { reasoning_effort: effort } : {},
  })
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return []
  return sources.flatMap((source) => {
    if (typeof source?.title !== 'string' || typeof source?.url !== 'string') return []
    try {
      const url = new URL(source.url)
      return url.protocol === 'https:' || url.protocol === 'http:'
        ? [{ title: source.title.trim().slice(0, 200), url: url.href }]
        : []
    } catch {
      return []
    }
  })
}

function parseAssessment(reply, fallbackName) {
  try {
    const start = reply.indexOf('{')
    const end = reply.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(reply.slice(start, end + 1))
    const dimensions = {}

    for (const key of DIMENSION_KEYS) {
      const value = parsed.dimensions?.[key]
      if (!value || typeof value.explanation !== 'string') return null
      const coverage = COVERAGE_STATES.has(value.coverage) ? value.coverage : 'unknown'
      const score =
        (coverage === 'scored' || coverage === 'inferred') &&
        Number.isInteger(value.score) &&
        value.score >= 0 &&
        value.score <= 5
          ? value.score
          : null
      dimensions[key] = {
        score,
        coverage,
        explanation: value.explanation.trim().slice(0, 2000),
        sources: normalizeSources(value.sources),
      }
    }

    return {
      productName:
        typeof parsed.productName === 'string' && parsed.productName.trim()
          ? parsed.productName.trim().slice(0, 200)
          : fallbackName,
      brand:
        typeof parsed.brand === 'string' && parsed.brand.trim()
          ? parsed.brand.trim().slice(0, 200)
          : null,
      dimensions,
      conclusion:
        typeof parsed.conclusion === 'string' && parsed.conclusion.trim()
          ? parsed.conclusion.trim().slice(0, 2000)
          : 'Review the available evidence and unknowns before making a purchasing decision.',
    }
  } catch {
    return null
  }
}

// The conversation with the system prompt first and extra instructions
// appended to the latest user message.
function buildMessages(messages, instructions) {
  const conversation = messages.map(({ role, text }) => ({ role, content: text }))
  const last = conversation.at(-1)
  conversation[conversation.length - 1] = { ...last, content: `${last.content}\n\n${instructions}` }
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...conversation]
}

export async function invokeAssistant(messages, { mode = 'assessment' } = {}) {
  const model = requireEnvironmentVariable('AI_MODEL')

  if (mode === 'chat') {
    const reply = await chatCompletion({
      model,
      messages: buildMessages(messages, CHAT_INSTRUCTIONS),
      timeoutMs: ASSISTANT_TIMEOUT_MS,
    })
    if (!reply) throw new Error('The model returned an empty response')
    return { reply, assessment: null }
  }

  const fallbackName = messages.at(-1)?.text?.slice(0, 200) || 'Product assessment'
  let reply = ''

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const instructions =
      attempt === 0
        ? ASSESSMENT_INSTRUCTIONS
        : `${ASSESSMENT_INSTRUCTIONS}\n\nFORMAT CORRECTION: Your entire response must start with { and end with }. Return the JSON object only.`
    reply = await chatCompletion({
      model,
      messages: buildMessages(messages, instructions),
      timeoutMs: ASSISTANT_TIMEOUT_MS,
    })
    const assessment = parseAssessment(reply, fallbackName)
    if (assessment) return { reply: assessment.conclusion, assessment }
  }

  if (!reply) throw new Error('The model returned an empty response')
  return { reply, assessment: null }
}
