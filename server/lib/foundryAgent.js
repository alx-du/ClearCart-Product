import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity'

let clients

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
    const project = new AIProjectClient(endpoint, createCredential())
    clients = { project, openAI: project.getOpenAIClient() }
  }
  return clients
}

export async function invokeFoundryAgent(messages) {
  const agentName = requireEnvironmentVariable('FOUNDRY_AGENT_NAME')
  const { openAI } = getClients()
  const conversation = await openAI.conversations.create({
    items: messages.map(({ role, text }) => ({
      type: 'message',
      role,
      content: text,
    })),
  })

  try {
    const response = await openAI.responses.create(
      { conversation: conversation.id },
      { body: { agent: { name: agentName, type: 'agent_reference' } } },
    )

    const reply = response.output_text?.trim()
    if (!reply) throw new Error('The Foundry agent returned an empty response')
    return reply
  } finally {
    try {
      await openAI.conversations.delete(conversation.id)
    } catch (error) {
      console.warn(`Could not delete Foundry conversation ${conversation.id}:`, error)
    }
  }
}
