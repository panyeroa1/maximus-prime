import React, { useState } from 'react';
import { Voice } from '../types';
import { PlusIcon, SaveIcon } from './icons';

interface EditVoiceModalProps {
  voice: Voice;
  onSave: (updatedTags: string[]) => Promise<void>;
  onClose: () => void;
}

export const EditVoiceModal: React.FC<EditVoiceModalProps> = ({ voice, onSave, onClose }) => {
    const [tags, setTags] = useState<string[]>(voice.tags || []);
    const [newTag, setNewTag] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddTag = () => {
        const trimmedTag = newTag.trim();
        if (trimmedTag && !tags.includes(trimmedTag)) {
            setTags([...tags, trimmedTag]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await onSave(tags);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save tags.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-eburon-panel border border-eburon-border rounded-xl w-full max-w-lg shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-eburon-fg mb-2">Edit Tags for "{voice.name}"</h2>
                <p className="text-eburon-fg/70 mb-4 text-sm">Add or remove tags to categorize this voice.</p>

                <div className="space-y-4">
                    <div className="bg-eburon-bg border border-eburon-border rounded-lg p-3 min-h-[80px]">
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <div key={tag} className="flex items-center gap-2 bg-eburon-panel border border-eburon-border text-eburon-accent px-3 py-1.5 rounded-lg">
                                    <span className="text-sm font-medium text-eburon-fg">{tag}</span>
                                    <button 
                                        onClick={() => handleRemoveTag(tag)} 
                                        className="text-eburon-fg/50 hover:text-red-400 rounded-full"
                                        aria-label={`Remove tag ${tag}`}
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                            {tags.length === 0 && <p className="text-sm text-eburon-fg/60 px-1 py-1.5">No tags yet.</p>}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                            placeholder="Add a new tag"
                            className="flex-grow bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                        />
                        <button onClick={handleAddTag} className="p-2 rounded-lg bg-eburon-accent hover:bg-eburon-accent-dark text-white flex-shrink-0">
                            <PlusIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

                <div className="flex justify-end gap-3 mt-6">
                    <button 
                        onClick={onClose}
                        className="font-bold py-2 px-4 rounded-lg bg-eburon-border hover:bg-white/10 text-white"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-eburon-accent hover:bg-eburon-accent-dark text-white disabled:bg-gray-500"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <SaveIcon className="w-5 h-5" />
                        )}
                        <span>{isSaving ? 'Saving...' : 'Save Tags'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};