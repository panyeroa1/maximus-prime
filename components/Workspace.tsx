import React, { useRef, FormEvent } from 'react';
import { WorkspaceState } from '../types';

interface WorkspaceProps {
  workspaceState: WorkspaceState;
  onFileSelect: (file: File) => void;
  onPromptSubmit: (prompt: string) => void;
  onClearWorkspace: () => void;
  onSelectApiKey: () => void;
}

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const UploadBox: React.FC<{ onFileSelect: (file: File) }> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelect(event.target.files[0]);
    }
  };
  return (
    <div className="text-center">
      <h3 className="text-xl font-semibold mb-2">Upload an Image</h3>
      <p className="text-gray-400 mb-4">Select an image to analyze, edit, or generate a video from.</p>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
      <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-md transition-colors">
        Choose File
      </button>
    </div>
  );
};

const ResultViewer: React.FC<{ state: WorkspaceState, onPromptSubmit: (prompt: string) => void, onClear: () => void }> = ({ state, onPromptSubmit, onClear }) => {
    const promptInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (promptInputRef.current?.value) {
            onPromptSubmit(promptInputRef.current.value);
        }
    };
    
    const content = state.content;
    if (!content) return null;

    return (
        <div className="w-full max-w-2xl flex flex-col items-center">
            {content.type === 'image' && <img src={content.data} alt="Generated content" className="max-w-full max-h-80 rounded-lg shadow-lg mb-4" />}
            {content.type === 'video' && <video src={content.data} controls autoPlay muted className="max-w-full max-h-80 rounded-lg shadow-lg mb-4" />}
            
            {(content.type === 'text' || content.type === 'grounding_search' || content.type === 'grounding_maps') && (
              <div className="bg-gray-900/80 p-4 rounded-lg text-left w-full max-h-60 overflow-y-auto mb-4">
                <p className="whitespace-pre-wrap">{content.data.text}</p>
                {content.data.sources && content.data.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-700">
                        <h4 className="font-semibold text-sm text-gray-400 mb-2">Sources:</h4>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            {content.data.sources.map((source: any, i: number) => (
                                <li key={i}>
                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{source.title}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
              </div>
            )}
            
            {state.uploadAction && (
                <form onSubmit={handleSubmit} className="w-full flex gap-2">
                    <input ref={promptInputRef} type="text" placeholder={`Prompt for ${state.uploadAction}...`} className="flex-grow bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md transition-colors">Submit</button>
                </form>
            )}

            <button onClick={onClear} className="mt-4 text-sm text-gray-400 hover:text-white">Clear</button>
        </div>
    );
};


export const Workspace: React.FC<WorkspaceProps> = ({ workspaceState, onFileSelect, onPromptSubmit, onClearWorkspace, onSelectApiKey }) => {
  if (workspaceState.mode === 'idle') {
    return null;
  }
  
  const renderContent = () => {
    switch (workspaceState.mode) {
      case 'api_key_needed':
        return (
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">API Key Required</h3>
            <p className="text-gray-400 mb-4 max-w-md">Video generation with Veo requires a dedicated API key with billing enabled. Please select your key to continue.</p>
            <p className="text-xs text-gray-500 mb-4">For more info, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">billing documentation</a>.</p>
            <button onClick={onSelectApiKey} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-md transition-colors">
              Select API Key
            </button>
          </div>
        );
      case 'upload':
        return <UploadBox onFileSelect={onFileSelect} />;
      case 'processing':
        return (
          <div className="flex flex-col items-center space-y-3">
            <LoadingSpinner />
            <p className="font-medium text-lg">{workspaceState.message || 'Processing...'}</p>
          </div>
        );
      case 'result':
        return <ResultViewer state={workspaceState} onPromptSubmit={onPromptSubmit} onClear={onClearWorkspace} />;
      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-4">
        <div className="bg-black/70 backdrop-blur-md border border-white/10 rounded-xl p-8 text-white pointer-events-auto shadow-2xl max-w-[90vw] max-h-[80vh] overflow-auto animate-fade-in-tool">
            {renderContent()}
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
    </div>
  );
};
