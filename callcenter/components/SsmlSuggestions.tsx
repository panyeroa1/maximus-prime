import React from 'react';

interface SsmlSuggestionsProps {
    onInsert: (snippet: string) => void;
    disabled?: boolean;
}

const SNIPPETS = [
    { label: 'speak', value: '<speak>\n  \n</speak>' },
    { label: 'p', value: '<p>\n  \n</p>' },
    { label: 'prosody', value: '<prosody rate="medium" pitch="medium">\n  \n</prosody>' },
    { label: 'break', value: '<break time="300ms"/>' },
];

const SsmlSuggestions: React.FC<SsmlSuggestionsProps> = ({ onInsert, disabled }) => {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-eburon-fg/70 mr-2">Insert Tag:</span>
            {SNIPPETS.map(snippet => (
                <button
                    key={snippet.label}
                    onClick={() => onInsert(snippet.value)}
                    disabled={disabled}
                    className="bg-eburon-panel border border-eburon-border hover:border-eburon-accent text-eburon-accent font-mono text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {`<${snippet.label}>`}
                </button>
            ))}
        </div>
    );
};

export default SsmlSuggestions;
