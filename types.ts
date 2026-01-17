
export interface Rating {
  mu: number; // Mean skill
  sigma: number; // Uncertainty
}

export interface ImageRecord {
  filename: string;
  rating: Rating;
  matches: number;
  impressions: number;
  lastPlayed: number;
}

export interface RankingDatabase {
  version: number;
  lastUpdated: number;
  images: Record<string, ImageRecord>;
}

export interface ComparisonPair {
  left: ImageRecord;
  right: ImageRecord;
  leftUrl?: string;
  rightUrl?: string;
}

export enum GameState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  RANKING = 'RANKING',
  SAVING = 'SAVING',
  EXITED = 'EXITED',
}

// In Browser: FileSystemDirectoryHandle
// In Electron: string (the absolute path)
export type FileHandle = FileSystemDirectoryHandle | string;

// Electron Window Bridge Definition
declare global {
  interface Window {
    electron?: {
      openDirectory: () => Promise<string | null>;
      scanDirectory: (path: string) => Promise<string[]>;
      readFile: (dirPath: string, filename: string) => Promise<string | null>;
      writeFile: (dirPath: string, filename: string, data: string) => Promise<boolean>;
      joinPath: (dirPath: string, filename: string) => Promise<string>;
      moveFile?: (sourcePath: string, targetPath: string) => Promise<boolean>;
      makeDir?: (dirPath: string) => Promise<boolean>;
      quit: () => void;
      isElectron: boolean;
    };
  }
}
