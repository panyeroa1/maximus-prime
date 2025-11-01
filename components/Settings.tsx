import React, { useState } from 'react';
import { ALL_TOOLS } from '../constants/tools';
import { ServerSettings } from '../types';
import { ServerIcon } from './icons';

const PREBUILT_VOICES = ['Charon', 'Zephyr', 'Puck', 'Kore', 'Fenrir'];

interface SettingsProps {
  initialRole: string;
  initialInstructions: string;
  initialVoice: string;
  initialEnabledTools: string[];
  initialServerSettings: ServerSettings;
  onSave: (newSettings: {
    role: string;
    instructions: string;
    voice: string;
    enabledTools: string[];
    serverSettings: ServerSettings;
  }) => void;
  onCancel: () => void;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, onChange }) => {
  return (
    <label className="relative inline-flex items-center cursor-pointer ml-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
  );
};


export const Settings: React.FC<SettingsProps> = ({
  initialRole,
  initialInstructions,
  initialVoice,
  initialEnabledTools,
  initialServerSettings,
  onSave,
  onCancel,
}) => {
  const [role, setRole] = useState(initialRole);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [voice, setVoice] = useState(initialVoice);
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set(initialEnabledTools));
  const [serverSettings, setServerSettings] = useState<ServerSettings>(initialServerSettings);
  const [activeTab, setActiveTab] = useState<'persona' | 'tools' | 'server'>('persona');


  const handleToolToggle = (toolName: string, isEnabled: boolean) => {
    setEnabledTools((prev) => {
      const newSet = new Set(prev);
      if (isEnabled) {
        newSet.add(toolName);
      } else {
        newSet.delete(toolName);
      }
      return newSet;
    });
  };

  const handleServerSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setServerSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = () => {
    onSave({ role, instructions, voice, enabledTools: Array.from(enabledTools), serverSettings });
  };

  const toolCategories = {
    'Core Capabilities': ['deepThink', 'performGoogleSearch', 'findNearbyPlaces', 'performLowLatencyQuery'],
    'Social & Content': ['postToTwitter', 'postToLinkedIn', 'getLatestYoutubeComments', 'scheduleInstagramPost', 'startTikTokLive', 'generateContentIdeas', 'generateImage'],
    'Productivity & Google Suite': ['scheduleCalendarEvent', 'sendEmail', 'querySalesforce', 'createJiraTicket', 'summarizeDocument', 'takeNote', 'translateText', 'manageGmail', 'editGoogleDoc', 'editGoogleSheet', 'manageGoogleDrive'],
    'Utilities': ['getStockPrice', 'getWeather', 'setTimer', 'playMusic', 'getFact', 'controlSmartHomeDevice', 'getRealTimeTraffic'],
  };

  const getCategoryForTool = (toolName: string) => {
    for (const category in toolCategories) {
        if ((toolCategories as any)[category].includes(toolName)) {
            return category;
        }
    }
    return 'Other';
  }
  
  const categorizedTools = ALL_TOOLS.reduce((acc, tool) => {
    const category = getCategoryForTool(tool.name);
    if (!acc[category]) {
        acc[category] = [];
    }
    acc[category].push(tool);
    return acc;
  }, {} as Record<string, typeof ALL_TOOLS>);

  return (
    <div className="fixed inset-0 bg-black text-white z-50 p-4 sm:p-8 overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Settings</h1>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-8">
          <button onClick={() => setActiveTab('persona')} className={`py-2 px-4 font-semibold transition-colors ${activeTab === 'persona' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white focus:outline-none'}`}>
            Persona
          </button>
          <button onClick={() => setActiveTab('tools')} className={`py-2 px-4 font-semibold transition-colors ${activeTab === 'tools' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white focus:outline-none'}`}>
            Tools
          </button>
          <button onClick={() => setActiveTab('server')} className={`py-2 px-4 font-semibold transition-colors flex items-center gap-2 ${activeTab === 'server' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white focus:outline-none'}`}>
            <ServerIcon className="w-5 h-5" /> Server
          </button>
        </div>

        {activeTab === 'persona' && (
          <div className="animate-fade-in">
            {/* Persona Section */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-6 text-blue-400">Persona Customization</h2>
              <div className="space-y-6">
                <div>
                  <label htmlFor="role-input" className="block text-sm font-medium text-gray-300 mb-2">
                    Role
                  </label>
                  <input
                    id="role-input"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., a witty science tutor"
                  />
                  <p className="text-xs text-gray-500 mt-2">Define the core role of Maximus. This is prefixed with "You are Maximus, ...".</p>
                </div>
                <div>
                  <label htmlFor="instructions-textarea" className="block text-sm font-medium text-gray-300 mb-2">
                    Instructions
                  </label>
                  <textarea
                    id="instructions-textarea"
                    rows={10}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="e.g., Always answer in the form of a haiku."
                  />
                  <p className="text-xs text-gray-500 mt-2">Provide specific instructions on how Maximus should behave, its personality, and what it should or shouldn't do.</p>
                </div>
              </div>
            </section>

            {/* Voice Section */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-6 text-blue-400">Voice Settings</h2>
              <div className="space-y-6">
                <div>
                  <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-2">
                    Voice Persona
                  </label>
                  <select
                    id="voice-select"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PREBUILT_VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          </div>
        )}
        
        {activeTab === 'tools' && (
          <section className="animate-fade-in">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">Toolbox</h2>
            <p className="text-gray-400 mb-8">Enable or disable tools to customize Maximus's capabilities.</p>
            <div className="space-y-8">
              {Object.keys(categorizedTools).map((category) => (
                <div key={category}>
                    <h3 className="text-xl font-bold text-gray-300 mb-4 border-b border-gray-800 pb-2">{category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {categorizedTools[category].sort((a,b) => a.name.localeCompare(b.name)).map((tool) => (
                            <div key={tool.name} className="flex items-center justify-between bg-gray-900/50 p-4 rounded-lg hover:bg-gray-800 transition-colors">
                                <div className="flex-1 pr-4">
                                    <p className="font-semibold">{tool.name}</p>
                                    <p className="text-sm text-gray-400">{tool.description}</p>
                                </div>
                                <ToggleSwitch
                                    checked={enabledTools.has(tool.name)}
                                    onChange={(isEnabled) => handleToolToggle(tool.name, isEnabled)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'server' && (
            <section className="animate-fade-in">
                <h2 className="text-2xl font-semibold mb-4 text-blue-400">Server & Integrations</h2>
                <p className="text-gray-400 mb-8">Configure credentials for third-party services. These are stored locally and are not shared.</p>
                <div className="space-y-8">
                  {/* Twilio */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-300 mb-4">Twilio</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Account SID</label>
                            <input name="twilioSid" value={serverSettings.twilioSid} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Auth Token</label>
                            <input name="twilioAuthToken" type="password" value={serverSettings.twilioAuthToken} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                  </div>
                   {/* Bland.ai & Cartesia */}
                   <div>
                    <h3 className="text-lg font-bold text-gray-300 mb-4">Voice & AI Services</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Bland.ai API Key</label>
                            <input name="blandApiKey" type="password" value={serverSettings.blandApiKey} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Cartesia API Key</label>
                            <input name="cartesiaApiKey" type="password" value={serverSettings.cartesiaApiKey} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">ElevenLabs API Key</label>
                            <input name="elevenLabsApiKey" type="password" value={serverSettings.elevenLabsApiKey} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                  </div>
                  {/* Ollama */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-300 mb-4">Ollama Cloud</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Cloud Endpoint URL</label>
                            <input name="ollamaCloudEndpoint" value={serverSettings.ollamaCloudEndpoint} onChange={handleServerSettingChange} placeholder="e.g., https://api.ollama.cloud" className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                            <input name="ollamaCloudApiKey" type="password" value={serverSettings.ollamaCloudApiKey} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                  </div>
                </div>
            </section>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end items-center space-x-4 mt-8 pt-6 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveChanges}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-md transition-colors"
          >
            Save Changes
          </button>
        </div>

        <style>{`
          .animate-fade-in {
            animation: fadeIn 0.3s ease-in-out;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
};
