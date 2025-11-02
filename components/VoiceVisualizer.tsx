// FIX: Removed invalid file header.
import React from 'react';

interface VoiceVisualizerProps {
  isRecording: boolean;
  isSpeaking: boolean;
  micAmplitude: number; // Normalized value from 0 to 1
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isRecording, isSpeaking, micAmplitude }) => {
  
  const getGlowClassName = () => {
    if (isSpeaking) {
      return 'animate-speaking-glow'; // Purple pulse for speaking
    }
    if (isRecording) {
      return 'animate-recording-glow'; // Cyan pulse for recording
    }
    return 'shadow-idle'; // Default blueish static glow
  };

  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
      {/* Outer glow - animates based on state */}
      <div
        className={`absolute w-full h-full rounded-full transition-shadow duration-500 ease-in-out ${getGlowClassName()}`}
      />
      
      {/* Main Orb - pulses gently, scales up smoothly when speaking */}
      <div
        className={`w-full h-full rounded-full overflow-hidden animate-pulse-gentle transition-transform duration-700 ease-in-out ${
          isSpeaking ? 'scale-[1.03]' : ''
        }`}
      >
        <div className="relative w-full h-full bg-black">
           {/* Base blue */}
           <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-600 to-blue-900"></div>
           
           {/* Cloudy texture 1 */}
           <div className={`absolute inset-0 rounded-full opacity-60 mix-blend-screen animate-cloud-spin-slow`}>
                <div className="w-full h-full" style={{
                    background: 'radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.8) 0%, rgba(200, 220, 255, 0.6) 20%, rgba(100, 150, 255, 0) 50%)'
                }}></div>
           </div>
           
           {/* Cloudy texture 2 */}
           <div className={`absolute inset-0 rounded-full opacity-50 mix-blend-plus-lighter animate-cloud-spin-fast`}>
                <div className="w-full h-full" style={{
                    background: 'radial-gradient(circle at 70% 80%, rgba(220, 230, 255, 0.7) 0%, rgba(180, 200, 255, 0.5) 25%, rgba(100, 150, 255, 0) 60%)'
                }}></div>
           </div>
        </div>
      </div>
      
      {/* Microphone input ripples (cyan) - Show only when recording and not speaking */}
      {isRecording && !isSpeaking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute w-1/3 h-1/3 rounded-full border-cyan-400 animate-mic-ripple"
              style={{
                animationDelay: `${i * 0.6}s`,
                borderColor: `rgba(100, 220, 255, ${Math.min(1, Math.max(0.1, micAmplitude * 2))})`,
                transition: 'border-color 100ms ease-out',
              }}
            />
          ))}
        </div>
      )}

      {/* Speaking indicator pulses (purple) - Show only when speaking */}
      {isSpeaking && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="absolute w-full h-full rounded-full border-2 border-purple-400 animate-speaking-ripple"
              style={{
                animationDelay: `${i * 1.0}s`,
              }}
            />
          ))}
        </div>
      )}

       <style>
        {`
          .shadow-idle {
            box-shadow: 0 0 30px 10px rgba(59, 130, 246, 0.2), 0 0 60px 20px rgba(147, 197, 253, 0.1);
          }

          @keyframes recording-glow {
            0%, 100% {
              box-shadow: 0 0 60px 20px rgba(34, 211, 238, 0.25), 0 0 100px 35px rgba(100, 220, 255, 0.15);
            }
            50% {
              box-shadow: 0 0 75px 28px rgba(34, 211, 238, 0.35), 0 0 115px 42px rgba(100, 220, 255, 0.2);
            }
          }
          .animate-recording-glow {
            animation: recording-glow 3s infinite ease-in-out;
          }

          @keyframes speaking-glow {
            0%, 100% {
              box-shadow: 0 0 70px 25px rgba(192, 132, 252, 0.3), 0 0 120px 40px rgba(216, 180, 254, 0.2);
            }
            50% {
              box-shadow: 0 0 80px 30px rgba(192, 132, 252, 0.4), 0 0 140px 50px rgba(216, 180, 254, 0.25);
            }
          }
          .animate-speaking-glow {
            animation: speaking-glow 2.4s infinite ease-in-out;
          }

          @keyframes pulse-gentle {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.015); }
          }
          .animate-pulse-gentle {
            animation: pulse-gentle 8s infinite ease-in-out;
          }

          @keyframes cloud-spin-slow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .animate-cloud-spin-slow {
            animation: cloud-spin-slow 45s linear infinite;
          }
          
          @keyframes cloud-spin-fast {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(-360deg); }
          }
          .animate-cloud-spin-fast {
            animation: cloud-spin-fast 30s linear infinite;
          }

          @keyframes mic-ripple {
            0% { transform: scale(1); opacity: 0.8; border-width: 1px; }
            100% { transform: scale(3); opacity: 0; border-width: 1px; }
          }
          .animate-mic-ripple {
            animation: mic-ripple 1.8s infinite ease-out;
          }

          @keyframes speaking-ripple {
            0% { transform: scale(1); opacity: 0.7; }
            100% { transform: scale(1.25); opacity: 0; }
          }
          .animate-speaking-ripple {
            animation: speaking-ripple 2s infinite ease-out;
          }
        `}
      </style>
    </div>
  );
};
