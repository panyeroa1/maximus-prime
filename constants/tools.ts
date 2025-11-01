import { Type } from '@google/genai';
import { Tool } from '../types';

export const ALL_TOOLS: Tool[] = [
  // Core & Grounding
  {
    name: 'groundedSearch',
    description: 'Use Google Search for up-to-date information on recent events, news, or any topic that requires current data from the web.',
    functionDeclaration: {
      name: 'groundedSearch',
      description: 'Performs a Google Search to answer questions about recent events or provide up-to-date information.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'The search query.' },
        },
        required: ['query'],
      },
    },
  },
  {
    name: 'groundedMapSearch',
    description: 'Use Google Maps to find places, get information about locations, or answer geography-related questions.',
    functionDeclaration: {
      name: 'groundedMapSearch',
      description: 'Finds places or gets information about locations using Google Maps.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'The query for Google Maps, e.g., "good Italian restaurants nearby" or "capital of France".' },
        },
        required: ['query'],
      },
    },
  },
  {
    name: 'quickQuery',
    description: 'Use a faster, lower-latency model for quick responses and simple queries that do not require complex reasoning.',
    functionDeclaration: {
      name: 'quickQuery',
      description: 'Switches to a faster, lighter model for simple, quick questions.',
       parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'The simple query to answer.' },
        },
        required: ['query'],
      },
    },
  },
  
  // Media Generation & Editing
  {
    name: 'generateImage',
    description: 'Generate a high-quality image from a textual description using the Imagen model.',
    functionDeclaration: {
      name: 'generateImage',
      description: 'Generates a high-quality image from a text prompt.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: 'A detailed description of the image to generate.' },
          aspectRatio: { type: Type.STRING, description: 'The desired aspect ratio. Supported values: "1:1", "16:9", "9:16", "4:3", "3:4". Defaults to "1:1".' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    name: 'analyzeImage',
    description: 'Analyze and understand the content of a provided image.',
    functionDeclaration: {
      name: 'analyzeImage',
      description: 'Analyzes a user-provided image and answers a question about it.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: 'The question to ask about the image (e.g., "What is in this picture?").' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    name: 'editImage',
    description: 'Edit a provided image based on a text prompt (e.g., "add a retro filter").',
    functionDeclaration: {
      name: 'editImage',
      description: 'Edits a user-provided image based on a text instruction.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: 'The instruction for how to edit the image (e.g., "remove the person in the background").' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    name: 'generateVideoFromImage',
    description: 'Generate a video starting from an initial user-provided image and a text prompt.',
    functionDeclaration: {
      name: 'generateVideoFromImage',
      description: 'Generates a video based on a starting image and a text prompt.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: 'A description of the motion or story for the video.' },
          aspectRatio: { type: Type.STRING, description: 'The aspect ratio for the video, either "16:9" (landscape) or "9:16" (portrait).' },
        },
        required: ['prompt', 'aspectRatio'],
      },
    },
  },
  
  // Audio
  {
    name: 'speakText',
    description: 'Convert a piece of text into spoken audio using a high-quality text-to-speech model.',
    functionDeclaration: {
      name: 'speakText',
      description: 'Synthesizes speech from the provided text.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: 'The text to be converted to speech.' },
        },
        required: ['text'],
      },
    },
  },
  {
    name: 'transcribeAudioFile',
    description: 'Transcribe the speech from an uploaded audio file into text.',
    functionDeclaration: {
      name: 'transcribeAudioFile',
      description: 'Transcribes an audio file that the user has uploaded.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: 'An optional prompt to guide the transcription, e.g., specifying language or context. Default is "Transcribe the following audio."' },
        },
        required: [],
      },
    },
  },
  
  // Developer & Productivity
  {
    name: 'generateCode',
    description: 'Generate code in various programming languages based on a description.',
    functionDeclaration: {
      name: 'generateCode',
      description: 'Writes code based on a user\'s request.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING, description: 'The programming language for the code (e.g., "python", "javascript").' },
          description: { type: Type.STRING, description: 'A detailed description of the code to generate.' },
        },
        required: ['language', 'description'],
      },
    },
  },
  {
    name: 'generateDocumentation',
    description: 'Generate documentation for a given piece of code.',
    functionDeclaration: {
      name: 'generateDocumentation',
      description: 'Writes documentation (e.g., docstrings, comments, README) for a block of code.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: 'The code block that needs documentation.' },
          format: { type: Type.STRING, description: 'The desired documentation format (e.g., "JSDoc", "Python docstrings", "Markdown").' },
        },
        required: ['code', 'format'],
      },
    },
  },
  {
    name: 'summarizeLongText',
    description: 'Summarize or analyze a long piece of text or document.',
    functionDeclaration: {
      name: 'summarizeLongText',
      description: 'Processes a long document or text and provides a summary or analysis.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: 'The long text or document content to process.' },
          request: { type: Type.STRING, description: 'What to do with the text (e.g., "summarize", "list key points", "find all action items").' },
        },
        required: ['text', 'request'],
      },
    },
  },
  // Sub-Agents
  {
    name: 'useSubAgentLLM',
    description: 'Delegate a task to a specialized sub-agent LLM provider like Ollama for specific requests.',
    functionDeclaration: {
        name: 'useSubAgentLLM',
        description: 'Delegates a task to a different LLM provider (e.g., Ollama).',
        parameters: {
            type: Type.OBJECT,
            properties: {
                provider: { type: Type.STRING, description: 'The provider to use. Currently supported: "ollama".' },
                prompt: { type: Type.STRING, description: 'The prompt to send to the sub-agent.' },
                model: { type: Type.STRING, description: 'The specific model to use from the provider (e.g., "llama3").'}
            },
            required: ['provider', 'prompt', 'model'],
        },
    },
  },
];