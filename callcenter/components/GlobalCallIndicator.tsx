import React from 'react';
import { useCall } from '../contexts/CallContext';
import { PhoneIcon } from './icons';

interface GlobalCallIndicatorProps {
    setIsRightSidebarCollapsed: (isCollapsed: boolean) => void;
    isRightSidebarCollapsed: boolean;
}

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

export const GlobalCallIndicator: React.FC<GlobalCallIndicatorProps> = ({ setIsRightSidebarCollapsed, isRightSidebarCollapsed }) => {
    const { status, duration, number } = useCall();

    const isCallActive = status === 'connected' || status === 'ringing' || status === 'dialing';

    if (!isCallActive || !isRightSidebarCollapsed) {
        // Only show when a call is active AND the sidebar is collapsed
        return null;
    }

    const getStatusText = () => {
        switch (status) {
            case 'connected': return `Ongoing Call - ${formatDuration(duration)}`;
            case 'ringing': return 'Ringing...';
            case 'dialing': return 'Dialing...';
            default: return '';
        }
    }

    return (
        <button
            className="fixed bottom-6 right-6 z-50 bg-eburon-ok text-black rounded-full shadow-lg flex items-center gap-3 pl-3 pr-5 py-2 hover:scale-105 transition-transform"
            onClick={() => setIsRightSidebarCollapsed(false)}
            aria-label="Show active call"
        >
            <div className="relative flex h-6 w-6">
                <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black/30 opacity-75"></div>
                <PhoneIcon className="relative inline-flex h-6 w-6"/>
            </div>
            <div className="text-sm font-semibold text-left">
                <p className="leading-tight">{getStatusText()}</p>
                <p className="text-xs leading-tight opacity-80">{number}</p>
            </div>
        </button>
    );
};
