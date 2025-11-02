// FIX: Removed invalid file header.
import React from 'react';
import { MicrophoneIcon, SparklesIcon, HandThumbUpIcon, XMarkIcon, ArrowUturnRightIcon } from './icons';

interface ControlBarProps {
  isRecording: boolean;
  isSpeaking: boolean;
  micAmplitude: number;
  onToggleRecording: () => void;
  onHangUp: () => void;
  onShowActions: () => void;
  onOpenFeedback: () => void;
  onSkipTurn: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isRecording,
  isSpeaking,
  micAmplitude,
  onToggleRecording,
  onHangUp,
  onShowActions,
  onOpenFeedback,
  onSkipTurn,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 flex justify-center items-center z-20">
      <div className="flex items-center space-x-6">
        {/* Actions Button */}
        <button
          onClick={onShowActions}
          className="w-16 h-16 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors flex items-center justify-center"
          aria-label="Show Actions"
        >
          <SparklesIcon className="w-8 h-8 text-white" />
        </button>

        {/* Microphone Button & Visualizer */}
        <div className="relative">
          {/* Visualizer Rings */}
          <div className="absolute inset-0 flex items-center justify-center -z-10">
            {/* Speaking Indicator (Purple) */}
            {isSpeaking && (
              <>
                <div className="w-24 h-24 rounded-full border-2 border-purple-400/80 animate-speaking-pulse-1"></div>
                <div className="absolute w-24 h-24 rounded-full border-2 border-purple-400/50 animate-speaking-pulse-2"></div>
              </>
            )}
            {/* Recording Indicator (Cyan) */}
            {isRecording && !isSpeaking && (
              <div
                className="w-24 h-24 rounded-full bg-cyan-400/20 transition-transform duration-100"
                style={{ transform: `scale(${1 + micAmplitude * 0.5})` }}
              ></div>
            )}
          </div>
          <button
            onClick={onToggleRecording}
            className={`w-16 h-16 rounded-full transition-colors flex items-center justify-center ${isRecording ? 'bg-blue-600 hover:bg-blue-700' : 'bg-neutral-800 hover:bg-neutral-700'}`}
            aria-label={isRecording ? 'Microphone is on' : 'Turn on microphone'}
          >
            <MicrophoneIcon className="w-8 h-8 text-white" />
          </button>
        </div>


        {/* Feedback Button */}
        <button
          onClick={onOpenFeedback}
          className="w-16 h-16 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors flex items-center justify-center"
          aria-label="Send Feedback"
        >
          <HandThumbUpIcon className="w-8 h-8 text-white" />
        </button>

        {/* Skip Turn Button */}
        <button
          onClick={onSkipTurn}
          className="w-16 h-16 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors flex items-center justify-center"
          aria-label="Skip Turn"
        >
          <ArrowUturnRightIcon className="w-8 h-8 text-white" />
        </button>

        {/* Hang Up Button */}
        <button
          onClick={onHangUp}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center"
          aria-label="Hang Up"
        >
          <XMarkIcon className="w-8 h-8 text-white" />
        </button>
      </div>
       <style>{`
        @keyframes speaking-pulse-1 {
            0% { transform: scale(0.9); opacity: 1; }
            100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes speaking-pulse-2 {
            0% { transform: scale(0.9); opacity: 1; }
            100% { transform: scale(2.2); opacity: 0; }
        }
        .animate-speaking-pulse-1 {
            animation: speaking-pulse-1 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .animate-speaking-pulse-2 {
            animation: speaking-pulse-1 2s 1s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
};