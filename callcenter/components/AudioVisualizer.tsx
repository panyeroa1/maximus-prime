import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    analyserNode.fftSize = 256;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      analyserNode.getByteFrequencyData(dataArray);

      // Match panel background color
      canvasCtx.fillStyle = '#111723';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];

        // Use accent color with opacity based on bar height
        canvasCtx.fillStyle = `rgba(91, 182, 255, ${barHeight / 255})`;
        // Draw bars from the center line out
        const barY = (canvas.height - barHeight) / 2;
        canvasCtx.fillRect(x, barY, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyserNode]);

  return <canvas ref={canvasRef} width="300" height="64" className="w-full h-16 rounded-lg bg-eburon-panel" />;
};
