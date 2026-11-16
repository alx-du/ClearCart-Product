// Writes the product-page descriptions whose facts have changed.
//
//   npm run descriptions:build             regenerate stale descriptions
//   npm run descriptions:build -- --dry-run   only list what is stale
//   npm run descriptions:build -- --force     regenerate everything
//
// A description is stale when no cached entry was written from exactly the
// current facts and prompt version, or when it was written by a different
// model than the one configured now (see below). Results go to
// server/data/descriptions.json; the running server picks them up on its own.

import 'dotenv/config'
import { getProductView, listProducts } from '../server/lib/catalogue.js'
import { writeDescription } from '../server/lib/descriptionModel.js'
import {
  PROMPT_VERSION,
  conclusionInputs,
  dimensionInputs,
  findDescription,
  hashInputs,
  saveDescriptions,
} from '../server/lib/descriptions.js'
import { DEFAULT_CLAUDE_MODEL, usageTotals } from '../server/lib/claudeClient.js'
import { configuredModel } from '../server/lib/modelClient.js'

const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force')
// AI_DESCRIPTION_PROVIDER=anthropic: Claude through the Anthropic SDK
// (ANTHROPIC_API_KEY or an `ant auth login` profile), model CLAUDE_MODEL.
// Otherwise any OpenAI-compatible endpoint (AI_ENDPOINT), model
// AI_DESCRIPTION_MODEL or AI_MODEL.
const provider = process.env.AI_DESCRIPTION_PROVIDER === 'anthropic' ? 'anthropic' : 'openai-compatible'
const model =
  provider === 'anthropic'
    ? process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL
    : configuredModel('AI_DESCRIPTION_MODEL')

if (!dryRun && provider !== 'anthropic' && (!model || !process.env.AI_ENDPOINT?.trim())) {
  console.error(
    'Set AI_ENDPOINT and AI_MODEL (or AI_DESCRIPTION_MODEL), or AI_DESCRIPTION_PROVIDER=anthropic, to write descriptions; or use --dry-run.',
  )
  process.exit(1)
}

// Every description the site can show: five dimensions and a conclusion per product.
const jobs = listProducts().flatMap(({ id }) => {
  const view = getProductView(id)
  return [
    ...view.dimensions.map((dimension) => ({ product: id, key: dimension.key, inputs: dimensionInputs(view.name, dimension, view.brand?.name ?? null) })),
    { product: id, key: 'conclusion', inputs: conclusionInputs(view.name, view.dimensions, view.brand?.name ?? null) },
  ]
})

const stale = jobs.filter((job) => {
  if (force) return true
  const entry = findDescription(job.product, job.key, hashInputs(job.inputs))
  return !entry || (model && entry.model !== model)
})

console.log(`${jobs.length} descriptions, ${stale.length} to write with ${model ?? 'no model set'}${dryRun ? ' (dry run)' : ''}.`)
for (const job of stale) console.log(`  ${job.product} · ${job.key}`)
if (dryRun || stale.length === 0) process.exit(0)

const written = []
let failed = 0
for (const job of stale) {
  // Nothing to say: the template's "No evidence recorded yet." is the description.
  const dimensionsWithEvidence = job.inputs.kind === 'conclusion' ? job.inputs.dimensions : [job.inputs]
  if (dimensionsWithEvidence.every((d) => d.facts.length === 0 && d.gaps.length === 0)) {
    console.log(`  skip  ${job.product} · ${job.key}: no evidence`)
    continue
  }
  try {
    const result = await writeDescription(job.inputs, { model, provider })
    if (!result.ok) {
      failed += 1
      console.warn(`  FAIL  ${job.product} · ${job.key}: ${result.problems.join(' ')}`)
      continue
    }
    written.push({
      product: job.product,
      key: job.key,
      inputsHash: hashInputs(job.inputs),
      promptVersion: PROMPT_VERSION,
      model,
      text: result.text,
      cites: result.cites,
      generatedAt: new Date().toISOString(),
      reviewed: false,
    })
    console.log(`  ok    ${job.product} · ${job.key}: ${result.text}`)
  } catch (error) {
    failed += 1
    console.warn(`  FAIL  ${job.product} · ${job.key}: ${error.message}`)
  }
}

if (written.length > 0) saveDescriptions(written)
console.log(`Wrote ${written.length}; ${failed} failed (those pages keep the template text).`)
if (provider === 'anthropic') {
  console.log(
    `Claude usage: ${usageTotals.requests} requests, ${usageTotals.inputTokens} input and ${usageTotals.outputTokens} output tokens (output includes thinking).`,
  )
}
process.exitCode = failed > 0 ? 1 : 0
