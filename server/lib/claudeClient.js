// Claude, through the official Anthropic SDK, for offline jobs such as writing
// descriptions (AI_DESCRIPTION_PROVIDER=anthropic). Never used by a visitor
// request. Credentials come from the environment the usual SDK way:
// ANTHROPIC_API_KEY, or an `ant auth login` profile.

import Anthropic from '@anthropic-ai/sdk'

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5'

let client

// Structured outputs accept a subset of JSON Schema: every object needs
// additionalProperties: false, and array size limits aren't supported.
// checkDescription enforces the counts after the reply instead.
function toClaudeSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toClaudeSchema)
  if (!schema || typeof schema !== 'object') return schema
  const { minItems: _min, maxItems: _max, ...rest } = schema
  const converted = Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, toClaudeSchema(value)]))
  return converted.type === 'object' ? { ...converted, additionalProperties: false } : converted
}

// Instructions + one input, returning the reply text (JSON of `schema`).
export async function invokeClaude({ instructions, input, schema, model = DEFAULT_CLAUDE_MODEL }) {
  client ??= new Anthropic()
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    // Thinking is always on for this model; effort sets how hard it works.
    // Faithful wording matters more than speed here.
    output_config: { effort: 'high', format: { type: 'json_schema', schema: toClaudeSchema(schema) } },
    // If a safety classifier declines, the API retries on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: instructions,
    messages: [{ role: 'user', content: input }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined (${response.stop_details?.category ?? 'no category'})`)
  }
  if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of output tokens')
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}
