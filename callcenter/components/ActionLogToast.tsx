import React, { useState, useEffect } from 'react';
import { CheckCircleIcon } from './icons';

interface ActionLogToastProps {
  log: string | null;
}

export const ActionLogToast: React.FC<ActionLogToastProps> = ({ log }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (log) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000); // Message stays visible for 3 seconds

      return () => clearTimeout(timer);
    }
  }, [log]);

  if (!log) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-3 bg-eburon-ok/90 text-black font-semibold px-4 py-3 rounded-lg shadow-lg transition-all duration-500 ease-in-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <CheckCircleIcon className="w-6 h-6" />
      <span>{log}</span>
    </div>
  );
};