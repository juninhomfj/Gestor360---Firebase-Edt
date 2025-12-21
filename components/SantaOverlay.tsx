
import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface SantaOverlayProps {
  onComplete: () => void;
}

const SantaOverlay: React.FC<SantaOverlayProps> = ({ onComplete }) => {
  useEffect(() => {
    // Trigger "Snow" Confetti
    const duration = 5000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ffffff', '#e2e8f0']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ffffff', '#e2e8f0']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Auto-close after animation duration (match CSS duration)
    const timer = setTimeout(() => {
      onComplete();
    }, 6000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
        {/* Santa & Reindeer Group using Emojis for zero-asset dependency */}
        <div className="santa-sleigh flex items-end">
            <span className="transform -scale-x-100">🦌</span>
            <span className="transform -scale-x-100 -ml-4 opacity-90">🦌</span>
            <span className="transform -scale-x-100 -ml-4 opacity-80">🦌</span>
            <div className="text-4xl mb-4 ml-2 animate-pulse text-yellow-300">✨</div>
            <span className="transform -scale-x-100 ml-2">🛷🎅</span>
        </div>
        
        {/* Magic Dust Trail */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="text-white text-2xl font-bold animate-pulse drop-shadow-lg" style={{ animationDuration: '0.5s' }}>
                 Ho Ho Ho! 🎄
             </div>
        </div>
    </div>
  );
};

export default SantaOverlay;
