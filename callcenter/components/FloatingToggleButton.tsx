import React from 'react';
import { PhoneIcon, GlobeIcon } from './icons';

interface FloatingToggleButtonProps {
    currentView: 'demo' | 'dialer';
    onToggle: () => void;
}

export const FloatingToggleButton: React.FC<FloatingToggleButtonProps> = ({ currentView, onToggle }) => {
    const isDemo = currentView === 'demo';
    
    return (
        <button
            onClick={onToggle}
            className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-eburon-accent text-white rounded-full shadow-lg flex items-center justify-center hover:bg-eburon-accent-dark hover:scale-105 transition-all duration-200"
            aria-label={isDemo ? "Switch to Dialer" : "Switch to Web Demo"}
        >
            {isDemo ? (
                <PhoneIcon className="w-8 h-8" />
            ) : (
                <GlobeIcon className="w-8 h-8" />
            )}
        </button>
    );
};
