import React, { useState } from 'react';
import { ALL_TOOLS } from '../constants/tools';
import { AppSettings, ServerSettings } from '../types';
import { ServerIcon } from './icons';

const PREBUILT_VOICES = ['Orus', 'Charon', 'Zephyr', 'Puck', 'Kore', 'Fenrir'];

interface SettingsProps {
  initialSystemInstruction: string;
  initialVoice: string;
  initialEnabledTools: string[];
  initialServerSettings: ServerSettings;
  onSave: (newSettings: AppSettings) => void;
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
  initialSystemInstruction,
  initialVoice,
  initialEnabledTools,
  initialServerSettings,
  onSave,
  onCancel,
}) => {
  const [systemInstruction, setSystemInstruction] = useState(initialSystemInstruction);
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

  const handleServerSettingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setServerSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = () => {
    onSave({ systemInstruction, voice, enabledTools: Array.from(enabledTools), serverSettings });
  };

  const toolCategories = {
    'Core & Grounding': ['groundedSearch', 'groundedMapSearch', 'quickQuery'],
    'Media Generation & Editing': ['generateImage', 'analyzeImage', 'editImage', 'generateVideoFromImage'],
    'Audio': ['speakText'],
  };

  const getCategoryForTool = (toolName: string): string => {
    for (const category in toolCategories) {
        if ((toolCategories as any)[category].includes(toolName)) {
            return category;
        }
    }
    const oldTools = ALL_TOOLS.map(t => t.name);
    if (oldTools.includes(toolName)) {
        return "Legacy Tools";
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
              <h2 className="text-2xl font-semibold mb-6 text-blue-400">Persona & Voice</h2>
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
                <div>
                  <label htmlFor="instructions-textarea" className="block text-sm font-medium text-gray-300 mb-2">
                    System Prompt
                  </label>
                  <textarea
                    id="instructions-textarea"
                    rows={20}
                    value={systemInstruction}
                    onChange={(e) => setSystemInstruction(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Enter the full system prompt for the AI..."
                  />
                  <p className="text-xs text-gray-500 mt-2">This is the core prompt that defines the AI's role, personality, rules, and output format.</p>
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
              {Object.keys(categorizedTools).sort().map((category) => (
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
                <p className="text-gray-400 mb-8">Configure credentials for Google Cloud and other third-party services. These are stored locally in your browser.</p>
                <div className="space-y-10">
                  
                  {/* Google Cloud */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">Google Cloud Services</h3>
                    <p className="text-sm text-gray-500 mb-4">Required for advanced Google services not covered by the default API key.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Google Cloud Project ID</label>
                            <input name="googleCloudProjectId" value={serverSettings.googleCloudProjectId} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <p className="text-xs text-gray-500 mt-1">Find your Project ID in the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Cloud Console</a>.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Service Account Key (JSON)</label>
                            <textarea name="googleCloudServiceAccountJson" value={serverSettings.googleCloudServiceAccountJson} onChange={handleServerSettingChange} rows={5} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" placeholder='Paste the content of your service account JSON file here.' />
                            <p className="text-xs text-gray-500 mt-1">Create a service account with appropriate roles (e.g., Vertex AI User) and download the JSON key. <a href="https://cloud.google.com/iam/docs/service-accounts-create" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Learn how</a>.</p>
                        </div>
                    </div>
                  </div>

                  {/* Telephony */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">Telephony</h3>
                     <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Twilio Account SID</label>
                            <input name="twilioSid" value={serverSettings.twilioSid} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Twilio Auth Token</label>
                            <input name="twilioAuthToken" type="password" value={serverSettings.twilioAuthToken} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <p className="text-xs text-gray-500 mt-1">Find your Twilio credentials on your <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console dashboard</a>.</p>
                        </div>
                    </div>
                  </div>
                  
                   {/* Sub-Agent Services */}
                   <div>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">Sub-Agent Voice & AI Services</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Bland.ai API Key</label>
                            <input name="blandApiKey" type="password" value={serverSettings.blandApiKey} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                             <p className="text-xs text-gray-500 mt-1">Get your key from the <a href="https://app.bland.ai/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Bland.ai dashboard</a>.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Cartesia API Key</label>
                            <input name="cartesiaApiKey" type="password" value={serverSettings.cartesiaApiKey} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <p className="text-xs text-gray-500 mt-1">Get your key from the <a href="https://cartesia.ai/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Cartesia website</a>.</p>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">ElevenLabs API Key</label>
                            <input name="elevenLabsApiKey" type="password" value={serverSettings.elevenLabsApiKey} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                             <p className="text-xs text-gray-500 mt-1">Get your key from your <a href="https://elevenlabs.io/speech-synthesis" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ElevenLabs profile</a>.</p>
                        </div>
                    </div>
                  </div>
                  
                  {/* Sub-Agent LLMs */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-300 mb-2">Sub-Agent LLM Providers</h3>
                     <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Ollama Cloud Endpoint URL</label>
                            <input name="ollamaCloudEndpoint" value={serverSettings.ollamaCloudEndpoint} onChange={handleServerSettingChange} placeholder="e.g., https://api.ollama.cloud" className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Ollama Cloud API Key</label>
                            <input name="ollamaCloudApiKey" type="password" value={serverSettings.ollamaCloudApiKey} onChange={handleServerSettingChange} className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <p className="text-xs text-gray-500 mt-1">For use with <a href="https://ollama.com/blog/ollama-is-now-available-as-a-cloud-api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Ollama Cloud</a> or other compatible endpoints.</p>
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