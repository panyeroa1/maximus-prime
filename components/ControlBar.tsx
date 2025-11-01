
import React from 'react';
import { VideoIcon, MicIcon, MicOffIcon, MoreIcon, CloseIcon } from './icons';

interface ControlBarProps {
  isSessionActive: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  onStart: () => void;
  onEnd: () => void;
  onMuteToggle: () => void;
}

const ControlButton: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}> = ({ onClick, children, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

export const ControlBar: React.FC<ControlBarProps> = ({
  isSessionActive,
  isMuted,
  isConnecting,
  onStart,
  onEnd,
  onMuteToggle,
}) => {
  return (
    <footer className="w-full p-4 bg-black">
      <div className="flex justify-center items-center space-x-6">
        <ControlButton className="bg-gray-700 hover:bg-gray-600">
          <VideoIcon className="w-8 h-8 text-white" />
        </ControlButton>
        
        {isSessionActive ? (
          <ControlButton
            onClick={onMuteToggle}
            className={isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}
          >
            {isMuted ? <MicOffIcon className="w-8 h-8 text-white" /> : <MicIcon className="w-8 h-8 text-white" />}
          </ControlButton>
        ) : (
          <ControlButton
            onClick={onStart}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-500"
          >
             {isConnecting ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            ) : (
                <MicIcon className="w-8 h-8 text-white" />
            )}
          </ControlButton>
        )}

        <ControlButton className="bg-gray-700 hover:bg-gray-600">
          <MoreIcon className="w-8 h-8 text-white" />
        </ControlButton>
        
        <ControlButton onClick={onEnd} className="bg-red-600 hover:bg-red-500">
          <CloseIcon className="w-8 h-8 text-white" />
        </ControlButton>
      </div>
    </footer>
  );
};
