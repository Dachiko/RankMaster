
import { DB_FILENAME, SUPPORTED_EXTENSIONS } from '../constants';
import { RankingDatabase, ImageRecord, FileHandle } from '../types';
import { createInitialRating } from './rankingService';

const isElectron = !!window.electron;

export const getDirectoryHandle = async (): Promise<FileHandle | null> => {
  if (isElectron) {
    return await window.electron!.openDirectory();
  }
  
  try {
    // @ts-ignore
    return await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'pictures',
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return null;
    throw e;
  }
};

export const verifyPermission = async (handle: FileHandle, readWrite: boolean = true) => {
  if (isElectron) return true; // Electron has full FS access
  
  const browserHandle = handle as FileSystemDirectoryHandle;
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    // @ts-ignore
    if ((await browserHandle.queryPermission(options)) === 'granted') return true;
    // @ts-ignore
    if ((await browserHandle.requestPermission(options)) === 'granted') return true;
  } catch (e) {
    console.warn("Permission check failed", e);
    return false;
  }
  return false;
};

export const scanDirectory = async (
  handle: FileHandle,
  onProgress: (count: number) => void
): Promise<{ images: ImageRecord[]; database: RankingDatabase | null }> => {
  let db: RankingDatabase | null = null;
  const validFiles = new Set<string>();

  if (isElectron) {
    const dirPath = handle as string;
    const fileList = await window.electron!.scanDirectory(dirPath);
    fileList.forEach(name => {
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext && SUPPORTED_EXTENSIONS.has(ext)) validFiles.add(name);
    });

    onProgress(validFiles.size);

    const dbContent = await window.electron!.readFile(dirPath, DB_FILENAME);
    if (dbContent) {
      try { db = JSON.parse(dbContent); } catch (e) { console.error("DB Parse Error", e); }
    }
  } else {
    const dirHandle = handle as FileSystemDirectoryHandle;
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (ext && SUPPORTED_EXTENSIONS.has(ext)) validFiles.add(entry.name);
      }
    }
    onProgress(validFiles.size);

    try {
      const dbHandle = await dirHandle.getFileHandle(DB_FILENAME, { create: false });
      const file = await dbHandle.getFile();
      const text = await file.text();
      db = JSON.parse(text) as RankingDatabase;
    } catch (e) {}
  }

  const finalImages: ImageRecord[] = [];
  const dbImages = db?.images || {};

  validFiles.forEach(filename => {
    if (dbImages[filename]) {
      const record = dbImages[filename];
      if (record.impressions === undefined) record.impressions = 0;
      finalImages.push(record);
    } else {
      finalImages.push({
        filename,
        rating: createInitialRating(),
        matches: 0,
        impressions: 0,
        lastPlayed: 0
      });
    }
  });

  return { 
    images: finalImages, 
    database: {
      version: 1,
      lastUpdated: Date.now(),
      images: Object.fromEntries(finalImages.map(img => [img.filename, img]))
    }
  };
};

export const saveDatabase = async (
  handle: FileHandle,
  images: ImageRecord[]
): Promise<void> => {
  const dbData: RankingDatabase = {
    version: 1,
    lastUpdated: Date.now(),
    images: Object.fromEntries(images.map(img => [img.filename, img])),
  };
  const json = JSON.stringify(dbData, null, 2);

  if (isElectron) {
    await window.electron!.writeFile(handle as string, DB_FILENAME, json);
  } else {
    const dirHandle = handle as FileSystemDirectoryHandle;
    const fileHandle = await dirHandle.getFileHandle(DB_FILENAME, { create: true });
    // @ts-ignore
    const writable = await fileHandle.createWritable();
    await writable.write(json);
    await writable.close();
  }
};

export const moveImageToSubfolder = async (
  handle: FileHandle,
  imageRecord: ImageRecord,
  folderName: string
): Promise<void> => {
  if (isElectron) {
    const dirPath = handle as string;
    const sourcePath = await window.electron!.joinPath(dirPath, imageRecord.filename);
    const targetDirPath = await window.electron!.joinPath(dirPath, folderName);
    const targetFilePath = await window.electron!.joinPath(targetDirPath, imageRecord.filename);

    // Create subfolder if not exists (Main process handles this via FS calls)
    await window.electron!.makeDir?.(targetDirPath);
    
    // Load/Update subfolder DB
    let targetDb: RankingDatabase = { version: 1, lastUpdated: Date.now(), images: {} };
    const subDbContent = await window.electron!.readFile(targetDirPath, DB_FILENAME);
    if (subDbContent) try { targetDb = JSON.parse(subDbContent); } catch(e){}

    targetDb.images[imageRecord.filename] = imageRecord;
    await window.electron!.writeFile(targetDirPath, DB_FILENAME, JSON.stringify(targetDb, null, 2));

    // Move physical file
    await window.electron!.moveFile?.(sourcePath, targetFilePath);
  } else {
    // Browser implementation (already robust)
    const rootHandle = handle as FileSystemDirectoryHandle;
    // @ts-ignore
    const targetFolderHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
    let targetDb: RankingDatabase = { version: 1, lastUpdated: Date.now(), images: {} };
    try {
      const dbFileHandle = await targetFolderHandle.getFileHandle(DB_FILENAME);
      const file = await dbFileHandle.getFile();
      targetDb = JSON.parse(await file.text());
    } catch (e) {}
    targetDb.images[imageRecord.filename] = imageRecord;
    const newDbHandle = await targetFolderHandle.getFileHandle(DB_FILENAME, { create: true });
    // @ts-ignore
    const writable = await newDbHandle.createWritable();
    await writable.write(JSON.stringify(targetDb, null, 2));
    await writable.close();
    const sourceHandle = await rootHandle.getFileHandle(imageRecord.filename);
    // @ts-ignore
    if (sourceHandle.move) { await sourceHandle.move(targetFolderHandle); } 
    else {
       const file = await sourceHandle.getFile();
       const newFileHandle = await targetFolderHandle.getFileHandle(imageRecord.filename, { create: true });
       // @ts-ignore
       const fileWritable = await newFileHandle.createWritable();
       await fileWritable.write(file);
       await fileWritable.close();
       await rootHandle.removeEntry(imageRecord.filename);
    }
  }
};

export const restoreImageFromSubfolder = async (
  handle: FileHandle,
  imageRecord: ImageRecord,
  folderName: string
): Promise<void> => {
  if (isElectron) {
    const dirPath = handle as string;
    const targetDirPath = await window.electron!.joinPath(dirPath, folderName);
    const sourcePath = await window.electron!.joinPath(targetDirPath, imageRecord.filename);
    const destPath = await window.electron!.joinPath(dirPath, imageRecord.filename);

    await window.electron!.moveFile?.(sourcePath, destPath);

    const subDbContent = await window.electron!.readFile(targetDirPath, DB_FILENAME);
    if (subDbContent) {
      try {
        const targetDb = JSON.parse(subDbContent);
        delete targetDb.images[imageRecord.filename];
        await window.electron!.writeFile(targetDirPath, DB_FILENAME, JSON.stringify(targetDb, null, 2));
      } catch(e){}
    }
  } else {
    // Browser implementation
    const rootHandle = handle as FileSystemDirectoryHandle;
    // @ts-ignore
    const targetFolderHandle = await rootHandle.getDirectoryHandle(folderName);
    const sourceHandle = await targetFolderHandle.getFileHandle(imageRecord.filename);
    // @ts-ignore
    if (sourceHandle.move) { await sourceHandle.move(rootHandle); } 
    else {
      const file = await sourceHandle.getFile();
      const newFileHandle = await rootHandle.getFileHandle(imageRecord.filename, { create: true });
      // @ts-ignore
      const fileWritable = await newFileHandle.createWritable();
      await fileWritable.write(file);
      await fileWritable.close();
      await targetFolderHandle.removeEntry(imageRecord.filename);
    }
    try {
      const dbFileHandle = await targetFolderHandle.getFileHandle(DB_FILENAME);
      const text = await (await dbFileHandle.getFile()).text();
      const targetDb = JSON.parse(text);
      if (targetDb.images[imageRecord.filename]) {
        delete targetDb.images[imageRecord.filename];
        const writable = await dbFileHandle.createWritable();
        await writable.write(JSON.stringify(targetDb, null, 2));
        await writable.close();
      }
    } catch (e) {}
  }
};

export const getFileUrl = async (handle: FileHandle, filename: string): Promise<string> => {
  if (isElectron) {
    const dirPath = handle as string;
    const fullPath = await window.electron!.joinPath(dirPath, filename);
    // Use query parameter to pass path safely
    return `local-resource://image?path=${encodeURIComponent(fullPath)}`;
  } else {
    try {
      const dirHandle = handle as FileSystemDirectoryHandle;
      const fileHandle = await dirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch (e) {
      console.error(`Failed to load image: ${filename}`, e);
      return '';
    }
  }
};
