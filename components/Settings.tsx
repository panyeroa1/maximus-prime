import React, { useState } from 'react';

const PREBUILT_VOICES = ['Charon', 'Zephyr', 'Puck', 'Kore', 'Fenrir'];

interface SettingsProps {
  initialRole: string;
  initialInstructions: string;
  initialVoice: string;
  onSave: (newSettings: {
    role: string;
    instructions: string;
    voice: string;
  }) => void;
  onCancel: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  initialRole,
  initialInstructions,
  initialVoice,
  onSave,
  onCancel,
}) => {
  const [role, setRole] = useState(initialRole);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [voice, setVoice] = useState(initialVoice);

  const handleSaveChanges = () => {
    onSave({ role, instructions, voice });
  };

  return (
    <div className="fixed inset-0 bg-black text-white z-50 p-4 sm:p-8 overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 border-b border-gray-700 pb-4">Settings</h1>

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
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      </div>
    </div>
  );
};
