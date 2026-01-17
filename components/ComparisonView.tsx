
import React, { useState } from 'react';
import { ImageRecord, FileHandle } from '../types';
import { Loader2, Trash2, Star } from 'lucide-react';

interface ComparisonViewProps {
  leftImage: ImageRecord;
  rightImage: ImageRecord;
  leftUrl?: string;
  rightUrl?: string;
  dirHandle: FileHandle;
  onVote: (winner: 'left' | 'right' | 'skip') => void;
  onDiscard: (side: 'left' | 'right') => void;
  onSpecial: (side: 'left' | 'right') => void;
  isProcessing: boolean;
}

type FeedbackType = 'consensus' | 'insight' | 'neutral' | null;

const ImagePanel: React.FC<{ 
  url?: string;
  filename: string;
  onClick: () => void;
  isFadingOut: boolean;
}> = ({ url, filename, onClick, isFadingOut }) => {
  return (
    <div 
      onClick={onClick}
      className={`relative flex-1 h-full bg-black border-r border-gray-900 last:border-r-0 cursor-pointer group hover:bg-zinc-900/30 transition-all duration-150 ${isFadingOut ? 'opacity-40 scale-[0.99]' : 'opacity-100'}`}
    >
      {!url ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      ) : (
        <img 
          src={url} 
          alt={filename} 
          className="w-full h-full object-contain pointer-events-none select-none transition-transform duration-150 group-active:scale-[0.98]"
        />
      )}
    </div>
  );
};

export const ComparisonView: React.FC<ComparisonViewProps> = ({ 
  leftImage, 
  rightImage, 
  leftUrl,
  rightUrl,
  dirHandle, 
  onVote,
  onDiscard,
  onSpecial,
  isProcessing
}) => {
  const [feedback, setFeedback] = useState<{ side: 'left' | 'right' | null, type: FeedbackType }>({ side: null, type: null });
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handlePanelClick = (side: 'left' | 'right') => {
    if (isProcessing || isTransitioning) return;

    const chosen = side === 'left' ? leftImage : rightImage;
    const other = side === 'left' ? rightImage : leftImage;

    // Determine if it was a consensus choice (Agree with model) or Insight (Upset)
    let type: FeedbackType = 'neutral';
    if (chosen.rating.mu > other.rating.mu + 0.5) {
      type = 'consensus';
    } else if (chosen.rating.mu < other.rating.mu - 0.5) {
      type = 'insight';
    }

    setFeedback({ side, type });
    setIsTransitioning(true);

    // Short delay to show feedback before moving to next pair
    // Reduced from 450ms to 150ms for snappier feel
    setTimeout(() => {
      onVote(side);
      setFeedback({ side: null, type: null });
      setIsTransitioning(false);
    }, 150);
  };

  const getFeedbackGradient = () => {
    if (!feedback.side || feedback.type === 'neutral') return '';
    
    // Muted dark colors for the directional glow
    const color = feedback.type === 'consensus' ? 'from-emerald-900/40' : 'from-amber-900/40';
    const direction = feedback.side === 'left' ? 'bg-gradient-to-l' : 'bg-gradient-to-r';
    
    return `${direction} ${color} to-transparent`;
  };

  return (
    <div className="flex w-full h-full relative overflow-hidden">
      {/* Directional Feedback Glow Overlay */}
      {feedback.side && (
        <div 
          className={`absolute inset-y-0 z-10 pointer-events-none transition-opacity duration-300 animate-in fade-in
            ${feedback.side === 'left' ? 'left-0 right-1/2' : 'right-0 left-1/2'} 
            ${getFeedbackGradient()}`}
        />
      )}

      {/* Action Bar */}
      <div className="absolute top-6 left-0 right-0 z-30 flex justify-center items-start gap-32 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onDiscard('left'); }}
            disabled={isProcessing || isTransitioning}
            className="flex flex-col items-center gap-1 group transition-transform active:scale-95 disabled:opacity-50"
          >
            <div className="bg-black/40 backdrop-blur-sm p-3 rounded-full border border-white/10 text-white/50 group-hover:text-red-500 group-hover:bg-red-500/10 group-hover:border-red-500/50 transition-colors">
              <Trash2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-mono font-bold text-white/30 group-hover:text-red-400">[1]</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onSpecial('left'); }}
            disabled={isProcessing || isTransitioning}
            className="flex flex-col items-center gap-1 group transition-transform active:scale-95 disabled:opacity-50"
          >
            <div className="bg-black/40 backdrop-blur-sm p-3 rounded-full border border-white/10 text-white/50 group-hover:text-purple-400 group-hover:bg-purple-500/10 group-hover:border-purple-500/50 transition-colors">
              <Star className="w-6 h-6" />
            </div>
            <span className="text-xs font-mono font-bold text-white/30 group-hover:text-purple-400">[4]</span>
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onSpecial('right'); }}
            disabled={isProcessing || isTransitioning}
            className="flex flex-col items-center gap-1 group transition-transform active:scale-95 disabled:opacity-50"
          >
            <div className="bg-black/40 backdrop-blur-sm p-3 rounded-full border border-white/10 text-white/50 group-hover:text-purple-400 group-hover:bg-purple-500/10 group-hover:border-purple-500/50 transition-colors">
              <Star className="w-6 h-6" />
            </div>
            <span className="text-xs font-mono font-bold text-white/30 group-hover:text-purple-400">[5]</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDiscard('right'); }}
            disabled={isProcessing || isTransitioning}
            className="flex flex-col items-center gap-1 group transition-transform active:scale-95 disabled:opacity-50"
          >
            <div className="bg-black/40 backdrop-blur-sm p-3 rounded-full border border-white/10 text-white/50 group-hover:text-red-500 group-hover:bg-red-500/10 group-hover:border-red-500/50 transition-colors">
              <Trash2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-mono font-bold text-white/30 group-hover:text-red-400">[2]</span>
          </button>
        </div>
      </div>

      <ImagePanel 
        url={leftUrl}
        filename={leftImage.filename} 
        onClick={() => handlePanelClick('left')}
        isFadingOut={isTransitioning && feedback.side === 'right'}
      />
      <ImagePanel 
        url={rightUrl}
        filename={rightImage.filename} 
        onClick={() => handlePanelClick('right')}
        isFadingOut={isTransitioning && feedback.side === 'left'}
      />
      
      {/* Central Divider / VS Badge */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
        <div className={`
          text-white font-black text-xl w-14 h-14 flex items-center justify-center rounded-full border-2 shadow-2xl transition-all duration-300
          ${feedback.type === 'consensus' ? 'bg-emerald-950 border-emerald-500 scale-110 shadow-emerald-500/40' : 
            feedback.type === 'insight' ? 'bg-amber-950 border-amber-500 scale-110 shadow-amber-500/40' : 
            'bg-black/80 border-gray-700'}
        `}>
          VS
        </div>
      </div>
    </div>
  );
};
