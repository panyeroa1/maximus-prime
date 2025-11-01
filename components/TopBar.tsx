import React from 'react';
import { CCIcon, VolumeIcon, SettingsIcon } from './icons';

interface TopBarProps {
  isSessionActive: boolean;
  onToggleCaptions: () => void;
  onToggleSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ isSessionActive, onToggleCaptions, onToggleSettings }) => {
  return (
    <header className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center">
      {/* Left spacer for centering */}
      <div className="w-24"></div>

      {/* Centered 'Connected' indicator */}
      <div className="flex-1 text-center">
        {isSessionActive && (
          <span className="text-green-400 text-sm font-semibold animate-pulse">
            Connected
          </span>
        )}
      </div>

      {/* Right-aligned buttons */}
      <div className="flex items-center justify-end space-x-4 w-24">
        <button onClick={onToggleCaptions} className="text-gray-400 hover:text-white transition-colors">
          <CCIcon className="w-7 h-7" />
        </button>
        <button className="text-gray-400 hover:text-white transition-colors">
          <VolumeIcon className="w-7 h-7" />
        </button>
        <button onClick={onToggleSettings} className="text-gray-400 hover:text-white transition-colors">
          <SettingsIcon className="w-7 h-7" />
        </button>
      </div>
    </header>
  );
};