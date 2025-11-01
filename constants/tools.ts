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
];
