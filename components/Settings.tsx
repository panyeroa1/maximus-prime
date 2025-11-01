import React from 'react';
import { AppSettings, Tool } from '../types';
import { ALL_TOOLS } from '../constants/tools';
import { XMarkIcon, ServerIcon } from './icons';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: Partial<AppSettings>) => void;
  onClose: () => void;
  onShowServerSettings: () => void;
}

const VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];

export const Settings: React.FC<SettingsProps> = ({ settings, onSettingsChange, onClose, onShowServerSettings }) => {
  const handleToolToggle = (toolName: string) => {
    const newEnabledTools = settings.enabledTools.includes(toolName)
      ? settings.enabledTools.filter(t => t !== toolName)
      : [...settings.enabledTools, toolName];
    onSettingsChange({ enabledTools: newEnabledTools });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center animate-fade-in-tool">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg shadow-2xl text-white relative flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-neutral-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* System Instruction */}
            <div>
              <label htmlFor="system-instruction" className="block text-sm font-medium text-neutral-300 mb-2">
                System Instruction
              </label>
              <textarea
                id="system-instruction"
                rows={4}
                className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={settings.systemInstruction}
                onChange={(e) => onSettingsChange({ systemInstruction: e.target.value })}
              />
            </div>

            {/* Voice Selection */}
            <div>
              <label htmlFor="voice" className="block text-sm font-medium text-neutral-300 mb-2">
                AI Voice
              </label>
              <select
                id="voice"
                className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={settings.voice}
                onChange={(e) => onSettingsChange({ voice: e.target.value })}
              >
                {VOICES.map(voice => (
                  <option key={voice} value={voice}>{voice}</option>
                ))}
              </select>
            </div>

            {/* Tools */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Enabled Tools</h3>
              <div className="space-y-3">
                {ALL_TOOLS.map((tool: Tool) => (
                  <div key={tool.name} className="flex items-start bg-neutral-800/50 p-3 rounded-md">
                    <div className="flex items-center h-5">
                      <input
                        id={tool.name}
                        name={tool.name}
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-500 bg-neutral-700 text-blue-600 focus:ring-blue-500"
                        checked={settings.enabledTools.includes(tool.name)}
                        onChange={() => handleToolToggle(tool.name)}
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor={tool.name} className="font-medium text-white">
                        {tool.name}
                      </label>
                      <p className="text-neutral-400">{tool.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-neutral-700 mt-auto">
             <button
              onClick={onShowServerSettings}
              className="w-full flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 p-2 rounded-md transition-colors"
            >
              <ServerIcon className="w-5 h-5" />
              <span>Server Settings</span>
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
