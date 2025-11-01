import { ServerSettings } from '../types';

interface SubAgentResponse {
  text: string;
}

/**
 * Calls a sub-agent LLM provider.
 * This can be extended to support other providers like Anthropic, Cohere, etc.
 * @param provider - The name of the provider (e.g., 'ollama').
 * @param prompt - The prompt to send to the sub-agent.
 * @param model - The specific model to use (e.g., 'llama3').
 * @param settings - The server settings containing API keys and endpoints.
 * @returns A promise that resolves to the sub-agent's text response.
 */
export async function callSubAgent(
  provider: string,
  prompt: string,
  model: string,
  settings: ServerSettings
): Promise<SubAgentResponse> {
  if (provider.toLowerCase() === 'ollama') {
    return callOllama(prompt, model, settings);
  }
  throw new Error(`Unsupported sub-agent provider: ${provider}`);
}

/**
 * Makes a non-streaming API call to an Ollama-compatible endpoint.
 */
async function callOllama(
  prompt: string,
  model: string,
  settings: ServerSettings
): Promise<SubAgentResponse> {
  const { ollamaCloudEndpoint, ollamaCloudApiKey } = settings;
  if (!ollamaCloudEndpoint || !ollamaCloudApiKey) {
    throw new Error("Ollama Cloud endpoint or API key is not configured in Server Settings.");
  }

  try {
    const response = await fetch(ollamaCloudEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ollamaCloudApiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        stream: false, // For simplicity, tool calls use non-streaming responses
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Ollama API Error:", errorBody);
      throw new Error(`Ollama API request failed with status ${response.status}.`);
    }

    const data = await response.json();
    
    // Standard OpenAI-compatible response structure
    const text = data.choices?.[0]?.message?.content?.trim();

    if (typeof text !== 'string') {
        console.error("Unexpected Ollama response format:", data);
        throw new Error("Failed to extract text from the Ollama response.");
    }

    return { text };

  } catch (error) {
    console.error("Failed to call Ollama sub-agent:", error);
    if (error instanceof Error) {
        throw new Error(`Sub-agent call failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred while calling the sub-agent.");
  }
}
