
import React, { useState } from 'react';
import { XMarkIcon } from './icons';

interface FeedbackProps {
  onClose: () => void;
  onSubmit: (feedback: string) => void;
}

export const Feedback: React.FC<FeedbackProps> = ({ onClose, onSubmit }) => {
  const [feedbackText, setFeedbackText] = useState('');

  const handleSubmit = () => {
    if (feedbackText.trim()) {
      onSubmit(feedbackText);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center animate-fade-in-tool">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md shadow-2xl text-white relative flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold">Send Feedback</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-neutral-400 mb-4">
            We'd love to hear your thoughts! What do you like? What could be improved?
          </p>
          <textarea
            rows={5}
            className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Your feedback..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end items-center p-4 gap-2 border-t border-neutral-700 bg-neutral-900/50 rounded-b-2xl">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-md hover:bg-neutral-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!feedbackText.trim()}
            className="text-sm px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-600 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
       <style>{`
        .animate-fade-in-tool {
          animation: fadeInTool 0.2s ease-in-out;
        }
        @keyframes fadeInTool {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
