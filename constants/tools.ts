import { FunctionDeclaration, Type } from '@google/genai';

export const ALL_TOOLS: FunctionDeclaration[] = [
  // Special Tools for Mode Switching
  {
    name: 'deepThink',
    description: 'Engage a more powerful model for complex reasoning, problem-solving, coding, and creative tasks.',
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: 'The complex question or task for deep thinking.' } },
      required: ['query'],
    },
  },
  {
    name: 'performGoogleSearch',
    description: 'Get up-to-date information from the web about recent events, news, or any topic requiring current data.',
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: 'The search query for Google.' } },
      required: ['query'],
    },
  },
  {
    name: 'findNearbyPlaces',
    description: 'Find information about places like restaurants, parks, or businesses using Google Maps.',
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: 'The type of place to search for (e.g., "italian restaurants", "parks with playgrounds").' } },
      required: ['query'],
    },
  },
   {
    name: 'performLowLatencyQuery',
    description: 'Get a quick, low-latency response for simple questions or commands.',
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: 'The query for a fast response.' } },
      required: ['query'],
    },
  },

  // Social Media & Content Creator Tools
  {
    name: 'postToTwitter',
    description: 'Posts a tweet to a connected Twitter account.',
    parameters: {
      type: Type.OBJECT,
      properties: { content: { type: Type.STRING, description: 'The text content of the tweet, under 280 characters.' } },
      required: ['content'],
    },
  },
  {
    name: 'postToLinkedIn',
    description: 'Shares a professional update or article on a connected LinkedIn profile.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING, description: 'The text content of the LinkedIn post.' },
        visibility: { type: Type.STRING, description: 'The visibility of the post, e.g., "connections" or "public".' },
      },
      required: ['content'],
    },
  },
  {
    name: 'getLatestYoutubeComments',
    description: 'Retrieves the most recent comments on a specific YouTube video.',
    parameters: {
      type: Type.OBJECT,
      properties: { videoId: { type: Type.STRING, description: 'The ID of the YouTube video.' } },
      required: ['videoId'],
    },
  },
  {
    name: 'scheduleInstagramPost',
    description: 'Schedules an image post to Instagram for a specific time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        imageUrl: { type: Type.STRING, description: 'Public URL of the image to post.' },
        caption: { type: Type.STRING, description: 'The caption for the Instagram post.' },
        postAt: { type: Type.STRING, description: 'ISO 8601 formatted date-time string for scheduling.' },
      },
      required: ['imageUrl', 'caption', 'postAt'],
    },
  },
  {
    name: 'startTikTokLive',
    description: 'Initiates a live stream on a connected TikTok account.',
    parameters: {
      type: Type.OBJECT,
      properties: { title: { type: Type.STRING, description: 'The title for the live stream.' } },
      required: ['title'],
    },
  },
  {
    name: 'generateContentIdeas',
    description: 'Brainstorms content ideas for a given topic and platform.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: 'The central theme or topic.' },
        platform: { type: Type.STRING, description: 'The target platform (e.g., YouTube, Blog, TikTok).' },
      },
      required: ['topic', 'platform'],
    },
  },

  // Business & Productivity Tools
  {
    name: 'scheduleCalendarEvent',
    description: 'Adds an event to the user\'s Google Calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'The title of the event.' },
        startTime: { type: Type.STRING, description: 'Event start time in ISO 8601 format.' },
        endTime: { type: Type.STRING, description: 'Event end time in ISO 8601 format.' },
        description: { type: Type.STRING, description: 'A brief description of the event.' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
  },
  {
    name: 'sendEmail',
    description: 'Sends an email from the user\'s connected email account.',
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
  {
    name: 'querySalesforce',
    description: 'Retrieves data from a Salesforce account.',
    parameters: {
      type: Type.OBJECT,
      properties: { soqlQuery: { type: Type.STRING, description: 'The SOQL query to execute.' } },
      required: ['soqlQuery'],
    },
  },
  {
    name: 'createJiraTicket',
    description: 'Creates a new issue ticket in a Jira project.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectKey: { type: Type.STRING, description: 'The key of the Jira project (e.g., "PROJ").' },
        summary: { type: Type.STRING, description: 'The title or summary of the ticket.' },
        description: { type: Type.STRING, description: 'Detailed description of the issue.' },
        issueType: { type: Type.STRING, description: 'The type of issue (e.g., "Bug", "Task", "Story").' },
      },
      required: ['projectKey', 'summary', 'issueType'],
    },
  },
  {
    name: 'getStockPrice',
    description: 'Gets the current stock price for a given ticker symbol.',
    parameters: {
      type: Type.OBJECT,
      properties: { ticker: { type: Type.STRING, description: 'The stock ticker symbol (e.g., "GOOGL").' } },
      required: ['ticker'],
    },
  },
   {
    name: 'summarizeDocument',
    description: 'Summarizes a long text document.',
    parameters: {
      type: Type.OBJECT,
      properties: { documentText: { type: Type.STRING, description: 'The full text of the document to summarize.' } },
      required: ['documentText'],
    },
  },
  {
    name: 'takeNote',
    description: 'Saves a text note for the user for later reference. Useful for capturing ideas, to-do items, or meeting notes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'A short title for the note.' },
        content: { type: Type.STRING, description: 'The main body of the note.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'translateText',
    description: 'Translates text from a source language to a target language.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'The text to be translated.' },
        targetLanguage: { type: Type.STRING, description: 'The target language code (e.g., "es", "fr", "ja").' },
      },
      required: ['text', 'targetLanguage'],
    },
  },

  // General Utility Tools
  {
    name: 'getWeather',
    description: 'Gets the current weather for a specified location.',
    parameters: {
      type: Type.OBJECT,
      properties: { location: { type: Type.STRING, description: 'The city and state, or zip code.' } },
      required: ['location'],
    },
  },
  {
    name: 'setTimer',
    description: 'Sets a timer for a specified duration.',
    parameters: {
      type: Type.OBJECT,
      properties: { durationInSeconds: { type: Type.NUMBER, description: 'The duration of the timer in seconds.' } },
      required: ['durationInSeconds'],
    },
  },
  {
    name: 'playMusic',
    description: 'Plays music based on a song title, artist, or playlist.',
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING, description: 'The search query for the music to play.' } },
      required: ['query'],
    },
  },
  {
    name: 'getFact',
    description: 'Retrieves a random interesting fact.',
    parameters: {
      type: Type.OBJECT,
      properties: { topic: { type: Type.STRING, description: 'Optional topic for the fact (e.g., "space", "history").' } },
    },
  },
  {
    name: 'controlSmartHomeDevice',
    description: 'Controls a smart home device.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            device: { type: Type.STRING, description: 'Name of the device to control (e.g., "living room light").' },
            action: { type: Type.STRING, description: 'The action to perform (e.g., "turn on", "dim to 50%", "set color to blue").' }
        },
        required: ['device', 'action']
    }
  },
];
