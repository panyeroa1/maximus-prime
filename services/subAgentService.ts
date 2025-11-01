import {
  generateImage,
  generateProText,
  analyzeTradingDataWithFlash,
} from './geminiService';
import { ActiveToolCall, WorkspaceContent } from '../types';

export async function executeTool(toolCall: ActiveToolCall): Promise<WorkspaceContent> {
  console.log(`Executing tool: ${toolCall.name}`, toolCall.args);

  try {
    switch (toolCall.name) {
      case 'generateImage': {
        const result = await generateImage(toolCall.args.prompt, toolCall.args.aspectRatio);
        return { type: 'image', data: result, prompt: toolCall.args.prompt };
      }

      case 'generateProText': {
        const result = await generateProText(toolCall.args.prompt);
        return {
          type: 'code',
          data: { text: result, language: toolCall.args.language || 'text' },
          prompt: toolCall.args.prompt
        };
      }

      case 'analyzeTradingData': {
        const result = await analyzeTradingDataWithFlash(toolCall.args.tradingData, toolCall.args.analysisPrompt);
        return { type: 'text', data: { text: result }, prompt: toolCall.args.analysisPrompt };
      }

      default:
        console.warn(`Unknown tool call: ${toolCall.name}`);
        return { type: 'text', data: { text: `Error: Tool "${toolCall.name}" is not implemented.` } };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolCall.name}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { type: 'text', data: { text: `Error executing tool "${toolCall.name}": ${errorMessage}` } };
  }
}
