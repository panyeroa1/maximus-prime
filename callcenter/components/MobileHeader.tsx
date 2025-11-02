import React from 'react';
import { MenuIcon, PhoneIcon } from './icons';

interface MobileHeaderProps {
    title: string;
    onMenuClick: () => void;
    onDialerClick: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ title, onMenuClick, onDialerClick }) => {
    return (
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-eburon-panel border-b border-eburon-border flex-shrink-0">
            <button 
                onClick={onMenuClick}
                className="p-2 -ml-2 text-eburon-fg/80 hover:text-eburon-accent"
                aria-label="Open navigation menu"
            >
                <MenuIcon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">{title}</h1>
            <button
                onClick={onDialerClick}
                className="p-2 -mr-2 text-eburon-fg/80 hover:text-eburon-accent"
                aria-label="Open dialer"
            >
                <PhoneIcon className="w-6 h-6" />
            </button>
        </header>
    );
};