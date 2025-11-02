import React from 'react';
import { NAV_ITEMS } from '../constants';
import { ActiveView } from '../types';
import { MessageCircleIcon } from './icons';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  onOpenFeedback: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, activeView, setActiveView, onOpenFeedback }) => {
  const handleNavClick = (view: ActiveView) => {
    setActiveView(view);
    onClose();
  };
  
  const handleFeedbackClick = () => {
    onOpenFeedback();
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-eburon-panel border-r border-eburon-border flex flex-col transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center p-4 h-16 border-b border-eburon-border">
          <img src="https://eburon.ai/assets/icon-eburon.png" alt="Eburon Logo" className="h-8 w-8" />
          <h1 className="ml-2 text-xl font-bold">Eburon<span className="text-eburon-accent">.ai</span></h1>
        </div>

        <nav className="flex-grow p-4 space-y-2">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                activeView === item.id 
                  ? 'bg-eburon-accent text-white' 
                  : 'text-eburon-fg/80 hover:bg-white/10'
              }`}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              <span className="font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-eburon-border">
          <button
              onClick={handleFeedbackClick}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors text-eburon-fg/80 hover:bg-white/10"
            >
              <MessageCircleIcon className="w-6 h-6 flex-shrink-0" />
              <span className="font-semibold">Feedback</span>
            </button>
        </div>
      </aside>
    </>
  );
};