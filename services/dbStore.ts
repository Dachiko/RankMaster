import { get, set } from 'idb-keyval';
import { FileHandle } from '../types';

const HANDLE_KEY = 'rankmaster_dir_handle';

export const saveDirectoryHandle = async (handle: FileHandle) => {
  await set(HANDLE_KEY, handle);
};

export const loadDirectoryHandle = async (): Promise<FileHandle | undefined> => {
  return await get<FileHandle>(HANDLE_KEY);
};
