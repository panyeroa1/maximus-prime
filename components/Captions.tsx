
import React, { useEffect, useRef } from 'react';
import { ConversationTurn } from '../types';

interface CaptionsProps {
  conversation: ConversationTurn[];
}

export const Captions: React.FC<CaptionsProps> = ({ conversation }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  return (
    <div
      ref={scrollRef}
      className="absolute bottom-0 left-0 right-0 h-1/3 bg-black bg-opacity-50 p-4 overflow-y-auto"
    >
      <div className="flex flex-col space-y-2">
        {conversation.map((turn, index) => (
          <div key={index} className={`flex ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg rounded-xl px-4 py-2 ${
                turn.speaker === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
              }`}
            >
              <p className="text-sm">{turn.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
