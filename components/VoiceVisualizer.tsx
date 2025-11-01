import React from 'react';

interface VoiceVisualizerProps {
  isSpeaking: boolean;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isSpeaking }) => {
  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
      {/* Outer glow */}
      <div
        className={`absolute w-full h-full rounded-full transition-all duration-500 ease-in-out ${
          isSpeaking ? 'scale-110' : 'scale-100'
        }`}
        style={{
          boxShadow: isSpeaking
            ? '0 0 60px 20px rgba(59, 130, 246, 0.5), 0 0 100px 40px rgba(147, 197, 253, 0.3)'
            : '0 0 30px 10px rgba(59, 130, 246, 0.4), 0 0 60px 20px rgba(147, 197, 253, 0.2)',
        }}
      ></div>
      
      {/* Main Orb */}
      <div
        className={`w-full h-full rounded-full overflow-hidden transition-transform duration-500 ease-in-out ${
          isSpeaking ? 'animate-pulse-strong' : 'animate-pulse-gentle'
        }`}
      >
        <div className="relative w-full h-full bg-black">
           {/* Base blue */}
           <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-blue-900"></div>
           
           {/* Cloudy texture 1 - moves */}
           <div className="absolute inset-0 rounded-full opacity-60 mix-blend-screen animate-cloud-spin-slow">
                <div className="w-full h-full" style={{
                    background: 'radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.8) 0%, rgba(200, 220, 255, 0.6) 20%, rgba(100, 150, 255, 0) 50%)'
                }}></div>
           </div>
           
           {/* Cloudy texture 2 - moves faster */}
           <div className="absolute inset-0 rounded-full opacity-50 mix-blend-plus-lighter animate-cloud-spin-fast">
                <div className="w-full h-full" style={{
                    background: 'radial-gradient(circle at 70% 80%, rgba(220, 230, 255, 0.7) 0%, rgba(180, 200, 255, 0.5) 25%, rgba(100, 150, 255, 0) 60%)'
                }}></div>
           </div>
        </div>
      </div>
       <style>
        {`
          @keyframes pulse-gentle {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
          }
          @keyframes pulse-strong {
            0%, 100% { transform: scale(1.05); }
            50% { transform: scale(1.1); }
          }
          @keyframes cloud-spin-slow {
            0% { transform: rotate(0deg) scale(1.2); }
            100% { transform: rotate(360deg) scale(1.2); }
          }
          @keyframes cloud-spin-fast {
            0% { transform: rotate(0deg) scale(1.3); }
            100% { transform: rotate(-360deg) scale(1.3); }
          }
          .animate-pulse-gentle {
            animation: pulse-gentle 5s infinite ease-in-out;
          }
          .animate-pulse-strong {
            animation: pulse-strong 1.2s infinite ease-in-out;
          }
          .animate-cloud-spin-slow {
            animation: cloud-spin-slow 45s linear infinite;
          }
          .animate-cloud-spin-fast {
            animation: cloud-spin-fast 30s linear infinite;
          }
        `}
      </style>
    </div>
  );
};
