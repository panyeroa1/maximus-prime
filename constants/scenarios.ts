// FIX: Added placeholder content for scenarios.
export interface Scenario {
  name: string;
  prompt: string;
  expectedTool?: string;
}

export const SCENARIOS: Scenario[] = [
  {
    name: "Weather Inquiry",
    prompt: "What's the weather like in London right now?",
    expectedTool: "groundedSearch"
  },
  {
    name: "Image Generation",
    prompt: "Generate an image of a futuristic city at sunset.",
    expectedTool: "generateImage"
  },
  {
    name: "Code Generation",
    prompt: "Write a python function to calculate fibonacci sequence.",
    expectedTool: "generateProText"
  },
  {
    name: "Summarization",
    prompt: "Summarize the following text for me: [long text here]",
    expectedTool: "summarizeText"
  },
  {
    name: "Map Search",
    prompt: "Find good coffee shops near me.",
    expectedTool: "groundedMapSearch"
  }
];
