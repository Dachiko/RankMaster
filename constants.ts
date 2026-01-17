
export const INITIAL_MU = 25.0;
export const INITIAL_SIGMA = 8.333; 
export const BETA = 4.167; 
export const TAU = 0.083; 
export const DRAW_PROBABILITY = 0.10; 

export const TARGET_SIGMA = 1.8;

export const DB_FILENAME = 'rankmaster_db.json';
export const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']);

export const PRELOAD_BATCH_SIZE = 5;
export const AUTO_SAVE_INTERVAL_MATCHES = 20;

// Hardcoded version string to avoid JSON import resolution issues in browser/ESM environments
export const APP_VERSION = 'v1.2.0';
