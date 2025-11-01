import { ServerSettings } from '../types';

export async function callOllama(prompt: string, model: string, settings: ServerSettings): Promise<string> {
    const { ollamaCloudEndpoint, ollamaCloudApiKey } = settings;
    if (!ollamaCloudEndpoint || !ollamaCloudApiKey) {
        throw new Error("Ollama settings are not configured in the Server tab.");
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
                prompt: prompt,
                stream: false // We want a single response for this implementation
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        return data.response ?? "No response content from Ollama.";

    } catch (error) {
        console.error("Failed to call Ollama:", error);
        if (error instanceof Error) {
            return `Failed to call Ollama sub-agent: ${error.message}`;
        }
        return "An unknown error occurred while contacting the Ollama sub-agent.";
    }
}
