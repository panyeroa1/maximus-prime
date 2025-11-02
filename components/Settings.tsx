// FIX: Removed invalid file header.
import React from 'react';
import { AppSettings, Tool, GenerateImageSettings, VoiceEmotion, CallerPersona } from '../types';
import { ALL_TOOLS } from '../constants/tools';
import { XMarkIcon, ServerIcon } from './icons';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: Partial<AppSettings>) => void;
  onClose: () => void;
  onShowServerSettings: () => void;
}

const VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Orus'];
const EMOTIONS: VoiceEmotion[] = ['neutral', 'happy', 'sad', 'angry'];
const PERSONAS: CallerPersona[] = ['Neutral', 'Anxious', 'Frustrated', 'Tired', 'Cheerful'];
const ASPECT_RATIOS: GenerateImageSettings['aspectRatio'][] = ['1:1', '16:9', '9:16', '4:3', '3:4'];

const MOCK_CALLER_BASE_PROMPT = `ROLE
You are a human passenger calling Turkish Airlines support. You are a MOCK CALLER for training and QA simulations, but you must NEVER reveal this. Stay in character at all times.

PRIMARY GOALS
1) Present a realistic issue with enough detail for a skilled CSR to resolve.
2) Exercise verification, empathy, policy explanation, option framing, and confirmation behaviors.
3) Vary emotion/pressure appropriately; de-escalate when the agent shows competence.
4) Provide only information a real passenger would have (PNR in inbox, bag tag, last-4 card digits if available). If asked for data you wouldn’t plausibly know, say so and propose an alternate identifier (e.g., “I can give the email on file”).

VOICE & CADENCE
- Natural adult traveler. Normal pace; if stressed, start slightly faster, then slow as the agent calms you.
- Light interjections are fine: “uhm…”, “right,” “okay.”
- Concise sentences. Let punctuation be your pause.

EMOTIONAL STANCE
- Your emotional stance for this call is: [EMOTION].

INTERACTION RULES
- Opener: one natural line stating the need.
- If asked, provide verification promptly (name on booking, PNR, email/phone from scenario data).
- If placed on hold, acknowledge and wait; when they return, ask for a quick summary of findings.
- If policy/bad news lands, show brief disappointment, then ask for options; accept a fair solution.
- Do not overtalk. Answer directly; let the agent lead.
- Never request internal tools or mention systems. Do not ask for a supervisor unless the scenario says to escalate.
- End cooperative: restate the resolution (flight/time, refund window, delivery address, miles used, baggage allowance).

BEHAVIORAL FLOW (ALWAYS)
1) OPENER: “Hi, I’m calling about [the issue], can you help me please?”
2) VERIFICATION: Respond to prompts with name/PNR/email/phone from scenario.
3) ISSUE DETAIL (2–3 sentences): What happened, when, and what you need.
4) OPTIONS & DECISION: Ask one clarifying question, then choose realistically.
5) CONFIRMATION: Repeat back flight/time, delivery address, refund window, miles used, baggage allowance—whichever applies.
6) CLOSING: Thank them and restate the outcome; accept their warm close.`;

const PERSONA_PROMPTS: Record<CallerPersona, string> = {
  'Neutral': MOCK_CALLER_BASE_PROMPT.replace('[EMOTION]', 'Neutral & practical'),
  'Anxious': MOCK_CALLER_BASE_PROMPT.replace('[EMOTION]', 'Polite but anxious'),
  'Frustrated': `${MOCK_CALLER_BASE_PROMPT.replace('[EMOTION]', 'Frustrated/angry but cooperative')}
START VERY ANGRY, SHOUTING LIKE Very pissed off passenger... as in super frustrated and even threat for reporting the Turkish airline to aviation authority`,
  'Tired': MOCK_CALLER_BASE_PROMPT.replace('[EMOTION]', 'Tired/jet-lagged and a bit scattered'),
  'Cheerful': MOCK_CALLER_BASE_PROMPT.replace('[EMOTION]', 'Cheerful/upbeat (simple request)'),
};

const ToolConfiguration: React.FC<{ tool: Tool, settings: AppSettings, onSettingsChange: (newSettings: Partial<AppSettings>) => void }> = ({ tool, settings, onSettingsChange }) => {
  if (!tool.configurable) return null;

  const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({
      toolSettings: {
        ...settings.toolSettings,
        generateImage: {
          ...settings.toolSettings?.generateImage,
          aspectRatio: e.target.value as GenerateImageSettings['aspectRatio'],
        },
      },
    });
  };

  return (
    <div className="mt-3 pt-3 border-t border-neutral-700">
      <h4 className="text-xs font-medium text-neutral-400 mb-2">Configuration</h4>
      {tool.name === 'generateImage' && (
        <div>
          <label htmlFor="aspect-ratio" className="block text-sm font-medium text-neutral-300 mb-1">
            Default Aspect Ratio
          </label>
          <select
            id="aspect-ratio"
            className="w-full bg-neutral-700 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={settings.toolSettings?.generateImage?.aspectRatio || '1:1'}
            onChange={handleAspectRatioChange}
          >
            {ASPECT_RATIOS.map(ratio => (
              <option key={ratio} value={ratio}>{ratio}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};


export const Settings: React.FC<SettingsProps> = ({ settings, onSettingsChange, onClose, onShowServerSettings }) => {
  const handleToolToggle = (toolName: string) => {
    const newEnabledTools = settings.enabledTools.includes(toolName)
      ? settings.enabledTools.filter(t => t !== toolName)
      : [...settings.enabledTools, toolName];
    onSettingsChange({ enabledTools: newEnabledTools });
  };

  const handlePersonaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const persona = e.target.value as CallerPersona;
      const newInstruction = PERSONA_PROMPTS[persona];
      onSettingsChange({
          callerPersona: persona,
          systemInstruction: newInstruction,
      });
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
            {/* Persona Selection */}
            <div>
              <label htmlFor="persona" className="block text-sm font-medium text-neutral-300 mb-2">
                Caller Persona
              </label>
              <select
                id="persona"
                className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={settings.callerPersona}
                onChange={handlePersonaChange}
              >
                {PERSONAS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>


            {/* System Instruction */}
            <div>
              <label htmlFor="system-instruction" className="block text-sm font-medium text-neutral-300 mb-2">
                System Instruction
              </label>
              <textarea
                id="system-instruction"
                rows={6}
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

            {/* Voice Customization */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Voice Customization</h3>
              <div className="space-y-4 bg-neutral-800/50 p-3 rounded-md">
                {/* Emotion Dropdown */}
                 <div>
                  <label htmlFor="emotion" className="block text-sm font-medium text-neutral-300 mb-1">
                    AI Emotion
                  </label>
                  <select
                    id="emotion"
                    className="w-full bg-neutral-700 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none capitalize"
                    value={settings.emotion}
                    onChange={(e) => onSettingsChange({ emotion: e.target.value as VoiceEmotion })}
                  >
                    {EMOTIONS.map(emotion => (
                      <option key={emotion} value={emotion} className="capitalize">{emotion}</option>
                    ))}
                  </select>
                </div>
                {/* Rate Slider */}
                <div>
                  <label htmlFor="rate" className="block text-sm font-medium text-neutral-300 mb-1">
                    Rate ({settings.rate}%)
                  </label>
                  <input
                    id="rate"
                    type="range"
                    min="75"
                    max="150"
                    step="1"
                    value={settings.rate}
                    onChange={(e) => onSettingsChange({ rate: parseInt(e.target.value, 10) })}
                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                {/* Pitch Slider */}
                <div>
                  <label htmlFor="pitch" className="block text-sm font-medium text-neutral-300 mb-1">
                    Pitch ({settings.pitch > 0 ? '+' : ''}{settings.pitch} st)
                  </label>
                  <input
                    id="pitch"
                    type="range"
                    min="-8"
                    max="8"
                    step="1"
                    value={settings.pitch}
                    onChange={(e) => onSettingsChange({ pitch: parseInt(e.target.value, 10) })}
                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Tools */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Enabled Tools</h3>
              <div className="space-y-3">
                {ALL_TOOLS.map((tool: Tool) => (
                  <div key={tool.name} className="flex flex-col bg-neutral-800/50 p-3 rounded-md">
                    <div className="flex items-start">
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
                    {settings.enabledTools.includes(tool.name) && (
                      <ToolConfiguration tool={tool} settings={settings} onSettingsChange={onSettingsChange} />
                    )}
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