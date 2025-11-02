import React from 'react';
import { ActiveView } from '../types';
import { MOBILE_NAV_ITEMS } from '../constants';

interface MobileBottomNavbarProps {
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;
}

export const MobileBottomNavbar: React.FC<MobileBottomNavbarProps> = ({ activeView, setActiveView }) => {
    return (
        <nav className="sticky bottom-0 z-30 flex items-center justify-around h-20 bg-eburon-panel border-t border-eburon-border flex-shrink-0">
            {MOBILE_NAV_ITEMS.map((item, index) => {
                const isActive = activeView === item.id;
                const isCenter = index === Math.floor(MOBILE_NAV_ITEMS.length / 2);

                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id)}
                        className={`flex flex-col items-center justify-center gap-1 transition-all duration-200 w-16 h-16 rounded-2xl ${
                            isActive ? 'text-eburon-accent' : 'text-eburon-fg/60 hover:text-eburon-fg'
                        } ${isCenter ? '-mt-8 bg-eburon-accent text-white rounded-full shadow-lg' : ''}`}
                        aria-label={item.label}
                    >
                        <item.icon className={`w-7 h-7 ${isCenter ? 'text-white' : ''}`} />
                        {!isCenter && <span className="text-[10px] font-bold">{item.label}</span>}
                    </button>
                );
            })}
        </nav>
    );
};