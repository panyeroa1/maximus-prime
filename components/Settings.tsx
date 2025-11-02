// FIX: Added missing Settings component.
import React from 'react';
import { AppSettings, CallerLanguage } from '../types';
import { ALL_TOOLS } from '../constants/tools';
import { LANGUAGE_ADDITIONS } from '../constants/prompts';
import { XMarkIcon } from './icons';

interface SettingsProps {
  settings: AppSettings;
  onClose: () => void;
  onSettingsChange: (newSettings: AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onClose, onSettingsChange }) => {
  const handleToolToggle = (toolName: string) => {
    const newEnabledTools = settings.enabledTools.includes(toolName)
      ? settings.enabledTools.filter(t => t !== toolName)
      : [...settings.enabledTools, toolName];
    onSettingsChange({ ...settings, enabledTools: newEnabledTools });
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ ...settings, voice: e.target.value as AppSettings['voice'] });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({ ...settings, language: e.target.value as CallerLanguage });
  };

  const handleSystemInstructionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onSettingsChange({ ...settings, systemInstruction: e.target.value });
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
          {/* System Instruction */}
          <div className="mb-6">
            <label htmlFor="system-instruction" className="block text-sm font-medium text-neutral-300 mb-2">
              System Instruction
            </label>
            <textarea
              id="system-instruction"
              rows={4}
              className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g., You are a helpful and friendly assistant."
              value={settings.systemInstruction}
              onChange={handleSystemInstructionChange}
            />
          </div>

          {/* Voice Selection */}
          <div className="mb-6">
            <label htmlFor="voice" className="block text-sm font-medium text-neutral-300 mb-2">
              Assistant Voice
            </label>
            <select
              id="voice"
              value={settings.voice}
              onChange={handleVoiceChange}
              className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Zephyr">Zephyr (Male)</option>
              <option value="Puck">Puck (Male)</option>
              <option value="Charon">Charon (Male)</option>
              <option value="Kore">Kore (Female)</option>
              <option value="Fenrir">Fenrir (Female)</option>
            </select>
          </div>
          
          {/* Language Selection */}
          <div className="mb-6">
            <label htmlFor="language" className="block text-sm font-medium text-neutral-300 mb-2">
              Assistant Accent / Language
            </label>
            <select
              id="language"
              value={settings.language}
              onChange={handleLanguageChange}
              className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {Object.keys(LANGUAGE_ADDITIONS).map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Enabled Tools */}
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-3">Enabled Tools</h3>
            <div className="space-y-3">
              {ALL_TOOLS.map(tool => (
                <label key={tool.name} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-neutral-700"
                    checked={settings.enabledTools.includes(tool.name)}
                    onChange={() => handleToolToggle(tool.name)}
                  />
                  <span className="text-sm">
                    <p className="font-medium text-neutral-200">{tool.name.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</p>
                    <p className="text-xs text-neutral-400">{tool.description}</p>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-neutral-700 bg-neutral-900/50 rounded-b-2xl text-right">
           <button onClick={onClose} className="text-sm px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 transition-colors">
              Done
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