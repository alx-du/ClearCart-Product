import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'
import 'dotenv/config'

const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT?.trim()
const agentName = process.env.FOUNDRY_AGENT_NAME?.trim()
const model = process.env.FOUNDRY_MODEL_DEPLOYMENT?.trim()

const missing = [
  ['FOUNDRY_PROJECT_ENDPOINT', endpoint],
  ['FOUNDRY_AGENT_NAME', agentName],
  ['FOUNDRY_MODEL_DEPLOYMENT', model],
]
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exitCode = 1
} else {
  const project = new AIProjectClient(endpoint, new DefaultAzureCredential())
  const agent = await project.agents.createVersion(agentName, {
    kind: 'prompt',
    model,
    instructions: `You are ClearCart, a careful product research assistant.
Help users understand products using five dimensions: planet impact; people and supply chain; quality; value; and transparency.
Clearly distinguish verified facts from estimates or general knowledge. Never invent sources, certifications, prices, ratings, or product claims.
When evidence is missing, say what information is needed. Use concise, plain language that is easy to read.`,
  })

  console.log(`Created ${agent.name} version ${agent.version}`)
}
