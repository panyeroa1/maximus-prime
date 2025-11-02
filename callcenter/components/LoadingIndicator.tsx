import React from 'react';

interface LoadingIndicatorProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ text, size = 'medium' }) => {
  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-16 h-16',
    large: 'w-20 h-20',
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-eburon-fg/70 gap-3 bg-eburon-bg">
      <img
        src="https://eburon.ai/assets/icon-eburon.png"
        alt={text ? `Loading ${text}...` : "Loading..."}
        className={`${sizeClasses[size]} rounded-full animate-pulse`}
      />
      {text && <p className="font-semibold">{text}</p>}
    </div>
  );
};
