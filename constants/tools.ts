import { Type } from '@google/genai';
import { Tool } from '../types';

export const ALL_TOOLS: Tool[] = [
  // Core Capabilities
  {
    name: 'deepThink',
    description: 'Engage a more powerful model for complex reasoning and problem-solving.',
    functionDeclaration: {
      name: 'deepThink',
      description: 'Use a more powerful, slower model for complex reasoning tasks that require deep thought.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING, description: 'The topic or problem requiring deep thought.' },
        },
        required: ['topic'],
      },
    },
  },
  {
    name: 'performGoogleSearch',
    description: 'Perform a Google search to get up-to-date information from the web.',
    functionDeclaration: {
      name: 'performGoogleSearch',
      description: 'Searches Google for the given query.',
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
    name: 'findNearbyPlaces',
    description: 'Find places of interest near a specific location using Google Maps.',
    functionDeclaration: {
      name: 'findNearbyPlaces',
      description: 'Finds nearby places of a certain type (e.g., "restaurant", "cafe").',
      parameters: {
        type: Type.OBJECT,
        properties: {
          placeType: { type: Type.STRING, description: 'The type of place to search for.' },
          location: { type: Type.STRING, description: 'The location to search near, e.g., "Mountain View, CA".' },
        },
        required: ['placeType', 'location'],
      },
    },
  },
  {
    name: 'performLowLatencyQuery',
    description: 'Use a faster, lower-latency model for quick responses and simple queries.',
    functionDeclaration: {
      name: 'performLowLatencyQuery',
      description: 'Switch to a faster model for quick, simple questions.',
       parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'The simple query to answer.' },
        },
        required: ['query'],
      },
    },
  },
  // Social & Content
  {
    name: 'generateImage',
    description: 'Generate an image based on a textual description.',
    functionDeclaration: {
      name: 'generateImage',
      description: 'Generates an image from a text prompt.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: 'A detailed description of the image to generate.' },
        },
        required: ['prompt'],
      },
    },
  },
  // Productivity & Google Suite
  {
    name: 'scheduleCalendarEvent',
    description: 'Schedule an event in Google Calendar.',
    functionDeclaration: {
      name: 'scheduleCalendarEvent',
      description: 'Creates a new event in the user\'s Google Calendar.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'The title of the event.' },
          startTime: { type: Type.STRING, description: 'The start time in ISO 8601 format.' },
          endTime: { type: Type.STRING, description: 'The end time in ISO 8601 format.' },
          description: { type: Type.STRING, description: 'A description of the event.' },
        },
        required: ['title', 'startTime', 'endTime'],
      },
    },
  },
  {
    name: 'sendEmail',
    description: 'Send an email to a recipient.',
    functionDeclaration: {
        name: 'sendEmail',
        description: 'Sends an email using the user\'s connected Gmail account.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                recipient: { type: Type.STRING, description: 'The email address of the recipient.' },
                subject: { type: Type.STRING, description: 'The subject line of the email.' },
                body: { type: Type.STRING, description: 'The content of the email.' },
            },
            required: ['recipient', 'subject', 'body'],
        },
    },
  },
  // Utilities
  {
    name: 'getStockPrice',
    description: 'Get the current stock price for a given ticker symbol.',
    functionDeclaration: {
      name: 'getStockPrice',
      parameters: {
        type: Type.OBJECT,
        properties: {
          ticker: { type: Type.STRING, description: 'The stock ticker symbol, e.g., GOOGL' },
        },
        required: ['ticker'],
      },
    },
  },
  {
    name: 'getWeather',
    description: 'Get the current weather for a specific location.',
    functionDeclaration: {
      name: 'getWeather',
      parameters: {
        type: Type.OBJECT,
        properties: {
          location: { type: Type.STRING, description: 'The city and state, e.g., "San Francisco, CA"' },
        },
        required: ['location'],
      },
    },
  },
];
