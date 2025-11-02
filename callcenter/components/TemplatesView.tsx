import React from 'react';
import { Template } from '../types';
import { MOCK_TEMPLATES } from '../constants';
import { AgentIcon, PlusIcon } from './icons';

interface TemplatesViewProps {
    onUseTemplate: (template: Template) => void;
}

const TemplatesView: React.FC<TemplatesViewProps> = ({ onUseTemplate }) => {
    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-eburon-fg">Agent Templates</h1>
                <p className="text-eburon-fg/70">
                    Start with a pre-configured template to quickly create a new agent.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {MOCK_TEMPLATES.map(template => (
                    <div key={template.id} className="bg-eburon-panel border border-eburon-border rounded-xl flex flex-col p-6">
                        <div className="flex-grow">
                            <AgentIcon className="w-10 h-10 text-eburon-accent mb-4" />
                            <h2 className="text-xl font-bold text-eburon-fg mb-2">{template.name}</h2>
                            <p className="text-eburon-fg/70 mb-4 text-sm">{template.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {template.useCases.map(uc => (
                                    <span key={uc} className="bg-eburon-bg border border-eburon-border text-eburon-accent px-2.5 py-1 rounded-full text-xs font-semibold">{uc}</span>
                                ))}
                            </div>
                        </div>
                        <button 
                            onClick={() => onUseTemplate(template)}
                            className="mt-6 w-full bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-3 px-4 rounded-lg transition-colors duration-150 flex items-center justify-center gap-2"
                        >
                           <PlusIcon className="w-5 h-5" />
                           <span>Use This Template</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TemplatesView;
