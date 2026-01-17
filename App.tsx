
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ComparisonView } from './components/ComparisonView';
import { Overlay } from './components/Overlay';
import { 
  GameState, 
  ImageRecord, 
  FileHandle, 
  ComparisonPair 
} from './types';
import { 
  getDirectoryHandle, 
  scanDirectory, 
  saveDatabase,
  verifyPermission,
  moveImageToSubfolder,
  restoreImageFromSubfolder,
  getFileUrl
} from './services/fileService';
import { 
  selectNextPair, 
  updateRatings,
  calculateLibraryProgress
} from './services/rankingService';
import { AUTO_SAVE_INTERVAL_MATCHES } from './constants';
import { Loader2, FolderOpen, AlertCircle, CheckCircle, Save, Trash2, Undo, Info, Star } from 'lucide-react';
import { loadDirectoryHandle, saveDirectoryHandle } from './services/dbStore';

interface NotificationState {
  message: string;
  type: 'success' | 'error' | 'info' | 'discard' | 'special';
  id: number;
}

interface MoveAction {
  record: ImageRecord;
  folderName: string;
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [currentPair, setCurrentPair] = useState<ComparisonPair | null>(null);
  const [nextPair, setNextPair] = useState<ComparisonPair | null>(null);
  const [dirHandle, setDirHandle] = useState<FileHandle | null>(null);
  const [sessionVotes, setSessionVotes] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  
  const [lastMoveAction, setLastMoveAction] = useState<MoveAction | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  
  // Refs for Event Listeners (Prevent stale closures)
  const imagesRef = useRef<ImageRecord[]>([]);
  const recentIdsRef = useRef<Set<string>>(new Set());
  const gameStateRef = useRef(gameState);
  const currentPairRef = useRef(currentPair);
  const nextPairRef = useRef(nextPair);
  const dirHandleRef = useRef(dirHandle);
  const isProcessingMoveRef = useRef(isProcessingMove);
  const sessionVotesRef = useRef(sessionVotes);
  const lastMoveActionRef = useRef(lastMoveAction);

  // Sync refs
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { currentPairRef.current = currentPair; }, [currentPair]);
  useEffect(() => { nextPairRef.current = nextPair; }, [nextPair]);
  useEffect(() => { dirHandleRef.current = dirHandle; }, [dirHandle]);
  useEffect(() => { isProcessingMoveRef.current = isProcessingMove; }, [isProcessingMove]);
  useEffect(() => { sessionVotesRef.current = sessionVotes; }, [sessionVotes]);
  useEffect(() => { lastMoveActionRef.current = lastMoveAction; }, [lastMoveAction]);

  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progressStats = useMemo(() => {
    return {
      confidence: calculateLibraryProgress(images),
      rankedCount: images.filter(i => i.matches > 0).length,
      totalCount: images.length
    };
  }, [images, sessionVotes]);
  
  useEffect(() => {
    const checkResume = async () => {
      const handle = await loadDirectoryHandle();
      if (handle) {
        setDirHandle(handle);
      }
    };
    checkResume();
  }, []);

  const showNotification = (message: string, type: NotificationState['type']) => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setNotification({ message, type, id: Date.now() });
    notificationTimeoutRef.current = setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenFolder = async () => {
    setErrorMsg(null);
    try {
      const handle = await getDirectoryHandle();
      if (handle) {
         await loadSession(handle);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error(e);
        setErrorMsg("Failed to open folder. Please try again.");
      }
    }
  };

  const handleResumeSession = async () => {
    if (!dirHandle) return;
    setErrorMsg(null);
    const hasPerm = await verifyPermission(dirHandle, true);
    if (hasPerm) {
      await loadSession(dirHandle);
    } else {
      handleOpenFolder();
    }
  };

  const loadSession = async (handle: FileHandle) => {
    setGameState(GameState.LOADING);
    setDirHandle(handle);
    setErrorMsg(null);
    saveDirectoryHandle(handle);

    try {
      const { images: loadedImages } = await scanDirectory(handle, (count) => {
        setLoadingProgress(count);
      });
      
      if (loadedImages.length < 2) {
        setErrorMsg("Folder contains fewer than 2 supported images.");
        setGameState(GameState.IDLE);
        return;
      }

      setImages(loadedImages);
      imagesRef.current = loadedImages;
      setGameState(GameState.RANKING);
      
      // Initialize pairs
      const firstPair = await generatePairWithUrls(handle);
      const secondPair = await generatePairWithUrls(handle);
      setCurrentPair(firstPair);
      setNextPair(secondPair);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Error scanning folder: " + (e.message || "Unknown error"));
      setGameState(GameState.IDLE);
    }
  };

  const generatePairWithUrls = async (handle: FileHandle): Promise<ComparisonPair | null> => {
    const p = selectNextPair(imagesRef.current, recentIdsRef.current);
    if (!p) return null;

    p[0].impressions = (p[0].impressions || 0) + 1;
    p[1].impressions = (p[1].impressions || 0) + 1;

    recentIdsRef.current.add(p[0].filename);
    recentIdsRef.current.add(p[1].filename);
    
    if (recentIdsRef.current.size > 30) {
       const it = recentIdsRef.current.values();
       recentIdsRef.current.delete(it.next().value!);
    }

    const [leftUrl, rightUrl] = await Promise.all([
      getFileUrl(handle, p[0].filename),
      getFileUrl(handle, p[1].filename)
    ]);

    return { left: p[0], right: p[1], leftUrl, rightUrl };
  };

  const cleanupPair = (pair: ComparisonPair | null) => {
    if (pair?.leftUrl) URL.revokeObjectURL(pair.leftUrl);
    if (pair?.rightUrl) URL.revokeObjectURL(pair.rightUrl);
  };

  const advanceRound = async () => {
    if (!dirHandleRef.current) return;
    
    if (!nextPairRef.current) {
      const p = await generatePairWithUrls(dirHandleRef.current);
      setCurrentPair(p);
    } else {
      setCurrentPair(nextPairRef.current);
    }

    generatePairWithUrls(dirHandleRef.current).then(p => setNextPair(p));
  };

  const triggerAutoSave = async () => {
    if (!dirHandleRef.current) return;
    try {
      setIsSaving(true);
      await saveDatabase(dirHandleRef.current, imagesRef.current);
      setTimeout(() => setIsSaving(false), 1500);
    } catch (e) {
      setIsSaving(false);
    }
  };

  const handleVote = async (choice: 'left' | 'right' | 'skip') => {
    const cp = currentPairRef.current;
    if (!cp || !dirHandleRef.current || isProcessingMoveRef.current) return;

    if (choice !== 'skip') {
      const { left, right } = cp;
      const winner = choice === 'left' ? left : right;
      const loser = choice === 'left' ? right : left;

      const { newWinner, newLoser } = updateRatings(winner.rating, loser.rating);
      
      winner.rating = newWinner;
      winner.matches += 1;
      winner.lastPlayed = Date.now();
      
      loser.rating = newLoser;
      loser.matches += 1;
      loser.lastPlayed = Date.now();

      setSessionVotes(v => v + 1);
      
      const currentVotes = sessionVotesRef.current + 1;
      if (currentVotes % AUTO_SAVE_INTERVAL_MATCHES === 0) {
        triggerAutoSave();
      }
    }

    const oldPair = cp;
    await advanceRound();
    cleanupPair(oldPair);
  };

  const moveImage = async (side: 'left' | 'right', folderName: string) => {
    const cp = currentPairRef.current;
    if (!cp || !dirHandleRef.current || isProcessingMoveRef.current) return;
    const targetImage = side === 'left' ? cp.left : cp.right;
    
    try {
      setIsProcessingMove(true);
      await moveImageToSubfolder(dirHandleRef.current, targetImage, folderName);
      
      const newImageList = imagesRef.current.filter(img => img.filename !== targetImage.filename);
      imagesRef.current = newImageList;
      setImages(newImageList);
      recentIdsRef.current.delete(targetImage.filename);
      setLastMoveAction({ record: targetImage, folderName });

      const type = folderName === 'discarded' ? 'discard' : 'special';
      showNotification(`Moved ${targetImage.filename} to ${folderName}`, type);
      
      const np = nextPairRef.current;
      if (np && (np.left.filename === targetImage.filename || np.right.filename === targetImage.filename)) {
        cleanupPair(np);
        setNextPair(null);
      }
      
      const oldPair = cp;
      await advanceRound();
      cleanupPair(oldPair);
    } catch (e) {
      console.error(`Move to ${folderName} failed`, e);
      setErrorMsg(`Failed to move file to ${folderName} folder.`);
    } finally {
      setIsProcessingMove(false);
    }
  };

  const handleDiscard = (side: 'left' | 'right') => moveImage(side, 'discarded');
  const handleSpecial = (side: 'left' | 'right') => moveImage(side, 'special 1');

  const handleUndo = async () => {
    if (!dirHandleRef.current || isProcessingMoveRef.current || !lastMoveActionRef.current) return;
    try {
      setIsProcessingMove(true);
      const { record, folderName } = lastMoveActionRef.current;
      await restoreImageFromSubfolder(dirHandleRef.current, record, folderName);
      const newImageList = [...imagesRef.current, record];
      imagesRef.current = newImageList;
      setImages(newImageList);
      setLastMoveAction(null);
      showNotification(`Restored ${record.filename} from ${folderName}`, 'success');
    } catch (e) {
      showNotification("Failed to restore image", 'error');
    } finally {
      setIsProcessingMove(false);
    }
  };

  const manualSave = async () => {
      if (!dirHandleRef.current) return;
      setIsSaving(true);
      try {
          await saveDatabase(dirHandleRef.current, imagesRef.current);
          setTimeout(() => setIsSaving(false), 1000);
      } catch (e) {
          setIsSaving(false);
      }
  };

  const handleExit = async () => {
    if (gameStateRef.current === GameState.IDLE) return;
    setGameState(GameState.SAVING);
    if (dirHandleRef.current) {
        try {
            await saveDatabase(dirHandleRef.current, imagesRef.current);
        } catch (e) {}
    }
    setGameState(GameState.EXITED);
  };

  // Stable event handler that reads from Refs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const gs = gameStateRef.current;
      
      if (gs === GameState.EXITED || isProcessingMoveRef.current) return;
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          manualSave();
          return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (gs === GameState.RANKING) handleUndo();
        return;
      }

      switch (e.key) {
        case 'ArrowLeft': 
          if (gs === GameState.RANKING) {
             e.preventDefault();
             handleVote('left');
          } 
          break;
        case 'ArrowRight': 
          if (gs === GameState.RANKING) {
             e.preventDefault();
             handleVote('right');
          }
          break;
        case 's':
        case 'S':
        case 'ArrowDown': 
          if (gs === GameState.RANKING && !e.ctrlKey && !e.metaKey) {
             e.preventDefault();
             handleVote('skip'); 
          }
          break;
        case '1': if (gs === GameState.RANKING) handleDiscard('left'); break;
        case '2': if (gs === GameState.RANKING) handleDiscard('right'); break;
        case '4': if (gs === GameState.RANKING) handleSpecial('left'); break;
        case '5': if (gs === GameState.RANKING) handleSpecial('right'); break;
        case 'o':
        case 'O': if (gs !== GameState.LOADING && !e.ctrlKey && !e.metaKey) handleOpenFolder(); break;
        case 'Escape': handleExit(); break;
      }
    };
    
    // Add listener once
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array = attached once

  if (gameState === GameState.SAVING) {
      return (
          <div className="h-screen w-full bg-black flex flex-col items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-zinc-400 animate-pulse">
                  <Save size={48} />
                  <span className="font-mono text-xl">Saving progress...</span>
              </div>
          </div>
      );
  }

  if (gameState === GameState.EXITED) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-900 text-white space-y-4">
        <CheckCircle size={64} className="text-green-500" />
        <h1 className="text-2xl font-bold">Session Saved</h1>
        <p className="text-zinc-400">It is safe to close this tab now.</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">Restart App</button>
      </div>
    );
  }

  if (gameState === GameState.IDLE) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black text-white p-6">
        <div className="text-center space-y-6 max-w-lg">
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">RankMaster</h1>
            <p className="text-zinc-400">Web Edition</p>
          </div>
          <div className="grid gap-4 w-full">
            <button onClick={handleOpenFolder} className="group relative flex items-center justify-center gap-3 w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all active:scale-95">
              <FolderOpen size={24} className="text-blue-400 group-hover:scale-110 transition-transform"/><span className="font-semibold text-lg">Select Folder [O]</span>
            </button>
            {dirHandle && (
              <button onClick={handleResumeSession} className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition-all active:scale-95">
                <div className="flex flex-col items-center">
                  <span className="font-semibold">Resume Session</span>
                  <span className="text-[10px] uppercase tracking-widest text-blue-400">{(progressStats.confidence * 100).toFixed(0)}% Confidence</span>
                </div>
              </button>
            )}
          </div>
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg text-sm">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black select-none overflow-hidden relative font-sans">
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
          <div className={`px-6 py-3 rounded-full border shadow-2xl flex items-center gap-3 backdrop-blur-md
            ${notification.type === 'discard' ? 'bg-red-500/20 border-red-500/50 text-red-200' : 
              notification.type === 'special' ? 'bg-purple-500/20 border-purple-500/50 text-purple-200' :
              'bg-zinc-800/80 border-white/20 text-white'}`}
          >
            {notification.type === 'discard' && <Trash2 size={18} />}
            {notification.type === 'special' && <Star size={18} />}
            {notification.type === 'success' && <CheckCircle size={18} className="text-green-400" />}
            <span className="font-medium">{notification.message}</span>
            {lastMoveAction && (
               <button 
                onClick={handleUndo}
                className="ml-4 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-colors flex items-center gap-1"
               >
                 <Undo size={12} /> UNDO
               </button>
            )}
          </div>
        </div>
      )}

      {isSaving && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-zinc-400 text-[10px] font-mono tracking-widest uppercase">
          <Loader2 size={10} className="animate-spin text-blue-500" /> Saving
        </div>
      )}

      <Overlay 
        totalImages={progressStats.totalCount}
        rankedCount={progressStats.rankedCount}
        confidenceProgress={progressStats.confidence}
        sessionVotes={sessionVotes}
        gameState={gameState}
        folderName={dirHandle ? (typeof dirHandle === 'string' ? dirHandle.split(/[/\\]/).pop() : dirHandle.name) : undefined}
      />

      {gameState === GameState.LOADING ? (
        <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
          <Loader2 size={48} className="animate-spin text-blue-500" />
          <div className="text-center">
             <p className="text-xl font-bold">Scanning Library...</p>
             <p className="text-zinc-500 font-mono text-sm">{loadingProgress.toLocaleString()} files found</p>
          </div>
        </div>
      ) : currentPair ? (
        <ComparisonView 
          leftImage={currentPair.left}
          rightImage={currentPair.right}
          leftUrl={currentPair.leftUrl}
          rightUrl={currentPair.rightUrl}
          dirHandle={dirHandle!}
          onVote={handleVote}
          onDiscard={handleDiscard}
          onSpecial={handleSpecial}
          isProcessing={isProcessingMove}
        />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center">
            <Info size={48} className="text-zinc-600 mb-4" />
            <p className="text-zinc-500">Wait, something went wrong. No pair available.</p>
            <button onClick={() => window.location.reload()} className="mt-4 text-blue-400 hover:underline">Reload App</button>
        </div>
      )}
    </div>
  );
};

export default App;
