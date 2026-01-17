
import React from 'react';
import { GameState } from '../types';
import { FolderOpen, LogOut, SkipForward, Keyboard, HelpCircle, Star, Trash2, Zap } from 'lucide-react';
import { APP_VERSION } from '../constants';

interface OverlayProps {
  totalImages: number;
  rankedCount: number;
  confidenceProgress: number; // 0 to 1
  sessionVotes: number;
  gameState: GameState;
  folderName?: string;
}

const getConfidenceTier = (progress: number) => {
  if (progress < 0.10) return { label: 'Scouting', color: 'text-zinc-500' };
  if (progress < 0.30) return { label: 'Organizing', color: 'text-blue-400' };
  if (progress < 0.60) return { label: 'Stabilizing', color: 'text-emerald-400' };
  if (progress < 0.85) return { label: 'Professional Grade', color: 'text-purple-400' };
  return { label: 'Master Grade', color: 'text-amber-400' };
};

export const Overlay: React.FC<OverlayProps> = ({ 
  totalImages, 
  rankedCount, 
  confidenceProgress,
  sessionVotes,
  folderName
}) => {
  const unranked = totalImages - rankedCount;
  const percentage = Math.round(confidenceProgress * 100);
  const tier = getConfidenceTier(confidenceProgress);

  return (
    <>
      {/* Left Info Box */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 text-xs text-gray-300 shadow-xl w-64">
          <div className="flex items-center space-x-2 mb-3">
            <FolderOpen size={14} className="text-blue-400" />
            <span className="font-bold text-white max-w-[180px] truncate">{folderName || "No Folder"}</span>
          </div>

          <div className="space-y-3">
            {/* Progress Section */}
            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Confidence</span>
                <span className={`font-mono font-bold ${tier.color}`}>{percentage}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full bg-current ${tier.color.replace('text-', 'bg-')}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className={`mt-1 text-[10px] font-medium flex items-center gap-1 ${tier.color}`}>
                <Zap size={10} /> {tier.label}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase">Unranked</span>
                <span className="text-orange-400 font-mono text-sm">{unranked.toLocaleString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase">Session</span>
                <span className="text-blue-300 font-mono text-sm">{sessionVotes}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls Help */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto group flex flex-col items-end">
        <div className="bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/10 text-gray-400 hover:text-white transition-colors cursor-help mb-2">
           <HelpCircle size={20} />
        </div>

        <div className="opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 bg-black/80 backdrop-blur-md p-4 rounded-lg border border-white/10 text-xs text-gray-300 shadow-xl w-52">
          <div className="font-bold text-white mb-2 flex items-center gap-2 border-b border-white/10 pb-1">
              <Keyboard size={14} /> Controls
          </div>
          <div className="grid grid-cols-[1fr,auto] gap-y-2">
            <span className="text-gray-400">Select Left</span> <span className="font-mono text-white">[←]</span>
            <span className="text-gray-400">Select Right</span> <span className="font-mono text-white">[→]</span>
            <span className="text-gray-400 flex items-center gap-1"><SkipForward size={10}/> Skip</span> <span className="font-mono text-white">[S]</span>
            <span className="text-gray-400 flex items-center gap-1"><Trash2 size={10}/> Discard</span> <span className="font-mono text-white">[1] / [2]</span>
            <span className="text-gray-400 flex items-center gap-1"><Star size={10}/> Special</span> <span className="font-mono text-white">[4] / [5]</span>
            <span className="text-gray-400 flex items-center gap-1"><FolderOpen size={10}/> Open</span> <span className="font-mono text-white">[O]</span>
            <span className="text-gray-400 flex items-center gap-1"><LogOut size={10}/> Exit</span> <span className="font-mono text-white">[Esc]</span>
          </div>

          <div className="mt-3 pt-2 border-t border-white/10 text-center text-gray-600 font-mono text-[10px]">
            RankMaster {APP_VERSION}
          </div>
        </div>
      </div>
    </>
  );
};
