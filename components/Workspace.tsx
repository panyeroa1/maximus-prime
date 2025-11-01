import React from 'react';
import { ActiveToolCall } from '../types';

interface WorkspaceProps {
  activeToolCall: ActiveToolCall | null;
}

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const Workspace: React.FC<WorkspaceProps> = ({ activeToolCall }) => {
  if (!activeToolCall) {
    return null;
  }

  // Format the tool name for display (e.g., 'performGoogleSearch' -> 'Tool: Perform Google Search')
  const formattedToolName = `Tool: ${activeToolCall.name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())}`;

  return (
    <>
      <div className="absolute top-[calc(50%+10rem)] flex items-center justify-center pointer-events-none z-10">
        <div className="bg-gray-900/50 backdrop-blur-md border border-white/10 rounded-lg p-3 px-5 text-white pointer-events-auto animate-fade-in-tool shadow-lg">
          <div className="flex items-center space-x-3">
            <LoadingSpinner />
            <p className="font-medium text-sm">{formattedToolName}...</p>
          </div>
        </div>
      </div>
      <style>{`
        .animate-fade-in-tool {
          animation: fadeInTool 0.4s ease-in-out;
        }
        @keyframes fadeInTool {
          from { opacity: 0; transform: translateY(15px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
};
