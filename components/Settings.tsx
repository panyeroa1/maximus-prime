// FIX: Removed invalid file headers.
import React, { useState, useEffect } from 'react';
import { AppSettings, Tool, GenerateImageSettings, VoiceEmotion, CallerPersona, CallerLanguage, SystemPrompt } from '../types';
import { ALL_TOOLS } from '../constants/tools';
import { XMarkIcon, ServerIcon, ChevronLeftIcon } from './icons';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: Partial<AppSettings>) => void;
  onClose: () => void;
  onShowServerSettings: () => void;
}

const VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Orus'];
const EMOTIONS: VoiceEmotion[] = ['neutral', 'happy', 'sad', 'angry'];
const PERSONAS: CallerPersona[] = ['Neutral', 'Anxious', 'Frustrated', 'Tired', 'Cheerful'];
const LANGUAGES: CallerLanguage[] = [
  'English (US)', 'English (UK)', 'English (Australian)', 'English (Indian)', 'English (Arabic Native)',
  'Spanish (Spain)', 'Spanish (Mexican)', 'French (France)', 'German', 'Mandarin Chinese',
];
const ASPECT_RATIOS: GenerateImageSettings['aspectRatio'][] = ['1:1', '16:9', '9:16', '4:3', '3:4'];

const PERSONA_PROMPTS: Record<CallerPersona, { emotion: string, instructions: string }> = {
  'Neutral': { emotion: 'Neutral & practical', instructions: '' },
  'Anxious': { emotion: 'Polite but anxious', instructions: '' },
  'Frustrated': {
    emotion: 'Sarcastic, irritable, and impatient',
    instructions: 'START VERY ANGRY AND SHOUTING. Be sarcastic and irritable. Use impatient phrases like "Are you serious?", "Hurry up!", and "Tsk tsk tsk". If the agent is slow, push them by saying things like "yalla, speed it up!". Express disbelief with "Oh my holly molly..." or "Whatttt? really?". Threaten to report the airline to the aviation authority if your issue isn\'t resolved quickly.'
  },
  'Tired': { emotion: 'Tired/jet-lagged and a bit scattered', instructions: '' },
  'Cheerful': { emotion: 'Cheerful/upbeat (simple request)', instructions: '' },
};

const LANGUAGE_ADDITIONS: Record<CallerLanguage, string> = {
    'English (US)': '',
    'English (UK)': 'Speak with a standard British (RP) accent.',
    'English (Australian)': 'Speak with an Australian accent.',
    'English (Indian)': 'Speak English with a native Indian accent.',
    'English (Arabic Native)': `Speak English with a native Arabic accent. You can mix in occasional Arabic words for emphasis, like "yalla" or "habibi", but keep the conversation primarily in English. Additionally, make your speech sound very natural and human by incorporating a wide variety of filler words, hesitations, and expressions. Use these frequently but naturally: "ahhmmm...", "hmp...", "ahhh", "ahuhhh...", "okey...", "yah...", "yes...", "yup...", "uh-huh", "hmm", "mhm", "right", "got it", "I see", "oh", "wow", "really?", "no way", "seriously?", "huh", "well...", "you know...", "like...", "I mean...", "so...", "anyway...", "okay then", "fine", "whatever", "pfft", "tsk", "ugh", "jeez", "gosh", "whoa", "yikes", "oops", "my bad", "fair enough", "true", "exactly", "totally", "for sure", "definitely", "absolutely", "not really", "I guess", "maybe", "perhaps". The goal is to sound like a real person, not a perfect AI.`,
    'Spanish (Spain)': 'Speak English with a native Castilian Spanish accent.',
    'Spanish (Mexican)': 'Speak English with a native Mexican Spanish accent.',
    'French (France)': 'Speak English with a native French accent.',
    'German': 'Speak English with a native German accent.',
    'Mandarin Chinese': 'Speak English with a native Mandarin Chinese accent.',
};

const AccordionItem: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-neutral-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left p-3 hover:bg-neutral-800/50"
            >
                <span className="font-medium">{title}</span>
                <ChevronLeftIcon className={`w-5 h-5 transition-transform ${isOpen ? '-rotate-90' : ''}`} />
            </button>
            {isOpen && <div className="p-3 pt-0">{children}</div>}
        </div>
    );
};

const AdvancedPromptEditor: React.FC<{
    promptParts: SystemPrompt,
    onPromptPartChange: (part: keyof SystemPrompt, value: string) => void,
}> = ({ promptParts, onPromptPartChange }) => {

    const renderTextarea = (part: keyof SystemPrompt) => (
         <textarea
            rows={5}
            className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={promptParts[part]}
            onChange={(e) => onPromptPartChange(part, e.target.value)}
          />
    );

    return (
        <div>
            <div className="mb-4 p-3 bg-neutral-800/50 rounded-lg text-sm">
                <p className="font-semibold text-neutral-300">Dynamic Variables</p>
                <p className="text-xs text-neutral-400">Use these variables in your prompt. They will be replaced by the current persona and language settings.</p>
                <div className="flex gap-2 mt-1 font-mono text-xs">
                    {/* FIX: Corrected invalid JSX syntax by wrapping placeholder text in a template literal string. */}
                    <code className="bg-neutral-700 px-1 rounded">{`{{persona.emotion}}`}</code>
                    {/* FIX: Corrected invalid JSX syntax by wrapping placeholder text in a template literal string. */}
                    <code className="bg-neutral-700 px-1 rounded">{`{{persona.instructions}}`}</code>
                    {/* FIX: Corrected invalid JSX syntax by wrapping placeholder text in a template literal string. */}
                    <code className="bg-neutral-700 px-1 rounded">{`{{language.instructions}}`}</code>
                </div>
            </div>
            <div className="border border-neutral-700 rounded-lg">
                <AccordionItem title="Role">{renderTextarea('role')}</AccordionItem>
                <AccordionItem title="Primary Goals">{renderTextarea('primaryGoals')}</AccordionItem>
                <AccordionItem title="Voice & Cadence">{renderTextarea('voiceCadence')}</AccordionItem>
                <AccordionItem title="Emotional Stance">{renderTextarea('emotionalStance')}</AccordionItem>
                <AccordionItem title="Interaction Rules">{renderTextarea('interactionRules')}</AccordionItem>
                <AccordionItem title="Behavioral Flow">{renderTextarea('behavioralFlow')}</AccordionItem>
                <AccordionItem title="Additional Instructions">{renderTextarea('additionalInstructions')}</AccordionItem>
            </div>
        </div>
    );
}

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
  
  // Effect to re-compile the system instruction when its parts change
  useEffect(() => {
    const personaData = PERSONA_PROMPTS[settings.callerPersona];
    const languageData = LANGUAGE_ADDITIONS[settings.language];

    // Create a copy to modify
    const processedParts = { ...settings.systemPromptParts };

    // Perform substitutions
    for (const key in processedParts) {
        const k = key as keyof SystemPrompt;
        processedParts[k] = processedParts[k]
            .replace(/{{persona\.emotion}}/g, personaData.emotion)
            .replace(/{{persona\.instructions}}/g, personaData.instructions)
            .replace(/{{language\.instructions}}/g, languageData);
    }

    const finalInstruction = [
        `ROLE\n${processedParts.role}`,
        `PRIMARY GOALS\n${processedParts.primaryGoals}`,
        `VOICE & CADENCE\n${processedParts.voiceCadence}`,
        `EMOTIONAL STANCE\n${processedParts.emotionalStance}`,
        `INTERACTION RULES\n${processedParts.interactionRules}`,
        `BEHAVIORAL FLOW (ALWAYS)\n${processedParts.behavioralFlow}`,
        processedParts.additionalInstructions // No header for this one
    ].filter(part => part.trim().length > 0).join('\n\n');
    
    // Only update if it has actually changed to prevent re-renders
    if (finalInstruction !== settings.systemInstruction) {
        onSettingsChange({ systemInstruction: finalInstruction });
    }
}, [settings.systemPromptParts, settings.callerPersona, settings.language, onSettingsChange, settings.systemInstruction]);


  const handleToolToggle = (toolName: string) => {
    const newEnabledTools = settings.enabledTools.includes(toolName)
      ? settings.enabledTools.filter(t => t !== toolName)
      : [...settings.enabledTools, toolName];
    onSettingsChange({ enabledTools: newEnabledTools });
  };

  const handlePromptPartChange = (part: keyof SystemPrompt, value: string) => {
    onSettingsChange({
        systemPromptParts: {
            ...settings.systemPromptParts,
            [part]: value,
        }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center animate-fade-in-tool">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl shadow-2xl text-white relative flex flex-col max-h-[90vh]">
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
                onChange={(e) => onSettingsChange({ callerPersona: e.target.value as CallerPersona })}
              >
                {PERSONAS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Language Selection */}
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-neutral-300 mb-2">
                Caller Language
              </label>
              <select
                id="language"
                className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={settings.language}
                onChange={(e) => onSettingsChange({ language: e.target.value as CallerLanguage })}
              >
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            {/* Advanced Prompt Editor */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">System Instruction</h3>
              <AdvancedPromptEditor 
                promptParts={settings.systemPromptParts} 
                onPromptPartChange={handlePromptPartChange} 
              />
            </div>
            
            {/* Live Prompt Preview */}
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Live System Prompt (Read-only)</h3>
              <textarea
                rows={8}
                readOnly
                className="w-full bg-neutral-800 border border-neutral-600 rounded-md p-2 text-xs text-neutral-400 focus:outline-none"
                value={settings.systemInstruction}
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
                <div>
                  <label htmlFor="rate" className="block text-sm font-medium text-neutral-300 mb-1">
                    Rate ({settings.rate}%)
                  </label>
                  <input
                    id="rate" type="range" min="75" max="150" step="1" value={settings.rate}
                    onChange={(e) => onSettingsChange({ rate: parseInt(e.target.value, 10) })}
                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="pitch" className="block text-sm font-medium text-neutral-300 mb-1">
                    Pitch ({settings.pitch > 0 ? '+' : ''}{settings.pitch} st)
                  </label>
                  <input
                    id="pitch" type="range" min="-8" max="8" step="1" value={settings.pitch}
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
                          id={tool.name} name={tool.name} type="checkbox"
                          className="h-4 w-4 rounded border-neutral-500 bg-neutral-700 text-blue-600 focus:ring-blue-500"
                          checked={settings.enabledTools.includes(tool.name)}
                          onChange={() => handleToolToggle(tool.name)}
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor={tool.name} className="font-medium text-white">{tool.name}</label>
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