import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity'

let clients

const DIMENSION_KEYS = ['planet', 'people', 'quality', 'value', 'transparency']
const COVERAGE_STATES = new Set(['scored', 'inferred', 'claimed', 'unknown'])
const ASSESSMENT_INSTRUCTIONS = `Return only one valid JSON object and no markdown. Assess the product in the latest user message using this shape:
{"productName":"specific product name","brand":"brand or null","dimensions":{"planet":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]},"people":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]},"quality":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]},"value":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]},"transparency":{"score":null,"coverage":"unknown","explanation":"concise evidence-based explanation","sources":[]}},"conclusion":"balanced concise conclusion"}
Each score must be an integer from 0 to 5 or null. Coverage must be scored, inferred, claimed, or unknown. Claimed and unknown must have a null score. Sources use {"title":"source title","url":"https://..."}. Never invent a source or URL; leave sources empty and lower the coverage when evidence is unavailable. Do not calculate a composite score.`

function requireEnvironmentVariable(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required to use the Foundry agent`)
  }
  return value
}

function createCredential() {
  if (process.env.NODE_ENV !== 'production') {
    return new DefaultAzureCredential()
  }

  const clientId = process.env.AZURE_CLIENT_ID?.trim()
  return clientId ? new ManagedIdentityCredential(clientId) : new ManagedIdentityCredential()
}

function getClients() {
  if (!clients) {
    const endpoint = requireEnvironmentVariable('FOUNDRY_PROJECT_ENDPOINT')
    const agentName = requireEnvironmentVariable('FOUNDRY_AGENT_NAME')
    const project = new AIProjectClient(endpoint, createCredential())
    clients = {
      openAI: project.getOpenAIClient({
        azureConfig: { agentName, allowPreview: true },
      }),
    }
  }
  return clients
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

export async function invokeFoundryAgent(messages) {
  const { openAI } = getClients()
  const input = messages.map(({ role, text }) => ({ role, content: text }))
  input[input.length - 1] = {
    ...input[input.length - 1],
    content: `${input[input.length - 1].content}\n\n${ASSESSMENT_INSTRUCTIONS}`,
  }
  const fallbackName = messages.at(-1)?.text?.slice(0, 200) || 'Product assessment'
  let reply = ''

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptInput = input.map((item, index) =>
      attempt === 1 && index === input.length - 1
        ? {
            ...item,
            content: `${item.content}\n\nFORMAT CORRECTION: Your entire response must start with { and end with }. Return the JSON object only.`,
          }
        : item,
    )
    const response = await openAI.responses.create({ input: attemptInput })
    reply = response.output_text?.trim() ?? ''
    const assessment = parseAssessment(reply, fallbackName)
    if (assessment) return { reply: assessment.conclusion, assessment }
  }

  if (!reply) throw new Error('The Foundry agent returned an empty response')
  return { reply, assessment: null }
}
