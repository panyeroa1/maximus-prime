import React from 'react';
import { NAV_ITEMS } from '../constants';
import { ActiveView } from '../types';
import { ChevronLeftIcon, MessageCircleIcon } from './icons';

// FIX: This file was missing. Added a functional sidebar component.

interface LeftSidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  onOpenFeedback: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ activeView, setActiveView, isCollapsed, setIsCollapsed, onOpenFeedback }) => {
  return (
    <aside className={`relative bg-eburon-panel border-r border-eburon-border flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`flex items-center p-4 h-[73px] border-b border-eburon-border ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
            <div className="flex items-center gap-2">
                <img src="https://eburon.ai/assets/icon-eburon.png" alt="Eburon Logo" className="h-8 w-8" />
                <h1 className="text-xl font-bold">Eburon<span className="text-eburon-accent">.ai</span></h1>
            </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 rounded-full bg-eburon-bg border border-eburon-border hover:bg-eburon-accent text-eburon-fg ${isCollapsed ? 'absolute top-5 right-1/2 translate-x-1/2' : ''}`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeftIcon className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      </div>

      <nav className="flex-grow p-4 space-y-2">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
              activeView === item.id 
                ? 'bg-eburon-accent text-white' 
                : 'text-eburon-fg/80 hover:bg-white/10'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? item.label : ''}
          >
            <item.icon className="w-6 h-6 flex-shrink-0" />
            {!isCollapsed && <span className="font-semibold">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 space-y-2 border-t border-eburon-border">
         <button
            onClick={onOpenFeedback}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors text-eburon-fg/80 hover:bg-white/10 ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'Submit Feedback' : ''}
          >
            <MessageCircleIcon className="w-6 h-6 flex-shrink-0" />
            {!isCollapsed && <span className="font-semibold">Feedback</span>}
          </button>

        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
           {!isCollapsed && (
            <div>
              <p className="font-semibold text-sm">Eburon Studio</p>
              <p className="text-xs text-eburon-fg/60">v1.0.0</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};