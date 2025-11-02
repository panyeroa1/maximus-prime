import React, { useEffect } from 'react';
import { IphoneSimulator } from './IphoneSimulator';
import { ChevronRightIcon } from './icons';
import { ActiveView } from '../types';

interface RightSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  activeView: ActiveView;
  generatedAppHtml: string | null;
  onStartWebDemo: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ isCollapsed, setIsCollapsed, activeView, generatedAppHtml, onStartWebDemo }) => {
  
  const previewHtml = activeView === ActiveView.Chatbot ? generatedAppHtml : null;

  return (
    <div className={`relative bg-eburon-panel border-l border-eburon-border flex flex-col items-center justify-center transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-[390px]'}`}>
       <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-5 left-0 -translate-x-1/2 z-10 p-2 rounded-full bg-eburon-panel border border-eburon-border hover:bg-eburon-accent text-eburon-fg transition-opacity`}
        aria-label={isCollapsed ? "Expand dialer" : "Collapse dialer"}
      >
        <ChevronRightIcon className={`w-6 h-6 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`} />
      </button>
      
      {!isCollapsed && <IphoneSimulator previewHtml={previewHtml} onStartWebDemo={onStartWebDemo} />}
      
      {isCollapsed && (
          <div className="transform -rotate-90 whitespace-nowrap text-eburon-fg/50 font-semibold tracking-widest">
              DIALER
          </div>
      )}
    </div>
  );
};
