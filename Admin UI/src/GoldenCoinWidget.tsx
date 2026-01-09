import React from 'react';
import { Coins } from 'lucide-react';

interface GoldenCoinWidgetProps {
  points?: number;
  onClick: () => void;
}

export function GoldenCoinWidget({ points = 0, onClick }: GoldenCoinWidgetProps) {
  return (
    <button 
      onClick={onClick}
      className="group relative flex items-center gap-2 bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-500 px-3 py-1.5 rounded-full shadow-lg border border-yellow-200 hover:scale-105 transition-transform active:scale-95"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-white/30 rounded-full animate-pulse"></div>
        <Coins className="w-5 h-5 text-yellow-900 drop-shadow-sm" />
      </div>
      <span className="font-bold text-yellow-900 text-sm drop-shadow-sm">{points}</span>
      
      {/* Shine effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    </button>
  );
}
