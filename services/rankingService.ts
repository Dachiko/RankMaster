
import { ImageRecord, Rating } from '../types';
import { INITIAL_MU, INITIAL_SIGMA, BETA, TAU, TARGET_SIGMA } from '../constants';
import { cdf, pdf, sq } from './mathUtils';

export const getMatchQuality = (r1: Rating, r2: Rating): number => {
  const deltaMu = r1.mu - r2.mu;
  const sumSigmaSq = sq(r1.sigma) + sq(r2.sigma);
  const denominator = Math.sqrt(2 * sq(BETA) + sumSigmaSq);
  return Math.exp((-1 * sq(deltaMu)) / (2 * sq(denominator)));
};

/**
 * Calculates a global confidence score (0 to 1) for the entire library.
 * This measures how close the total collection is to "Professional Grade" stability.
 */
export const calculateLibraryProgress = (images: ImageRecord[]): number => {
  if (images.length === 0) return 0;
  
  let totalNormalizedProgress = 0;
  
  // Total distance an image can travel from initial uncertainty to target stability
  const totalPossibleTravel = INITIAL_SIGMA - TARGET_SIGMA;

  for (const img of images) {
    const currentSigma = img.rating.sigma;
    // Calculate how much uncertainty has been removed
    const travel = INITIAL_SIGMA - currentSigma;
    // Normalize to 0-1 range (clamped)
    const normalized = Math.max(0, Math.min(1, travel / totalPossibleTravel));
    totalNormalizedProgress += normalized;
  }

  return totalNormalizedProgress / images.length;
};

export const updateRatings = (
  winner: Rating,
  loser: Rating,
  isDraw: boolean = false
): { newWinner: Rating; newLoser: Rating } => {
  const c = Math.sqrt(2 * sq(BETA) + sq(winner.sigma) + sq(loser.sigma));
  const winningMean = winner.mu;
  const losingMean = loser.mu;
  const deltaMu = winningMean - losingMean;
  
  let v: number;
  let w: number;
  
  if (isDraw) {
     return {
        newWinner: { ...winner, sigma: Math.max(winner.sigma * 0.95, 0.001) },
        newLoser: { ...loser, sigma: Math.max(loser.sigma * 0.95, 0.001) }
     };
  } else {
    const t = deltaMu / c;
    const val = pdf(t) / cdf(t);
    v = val;
    w = val * (val + t);
  }

  const newWinnerMu = winner.mu + (sq(winner.sigma) / c) * v;
  const newWinnerSigma = Math.sqrt(
    sq(winner.sigma) * (1 - (sq(winner.sigma) / sq(c)) * w)
  );

  const newLoserMu = loser.mu - (sq(loser.sigma) / c) * v;
  const newLoserSigma = Math.sqrt(
    sq(loser.sigma) * (1 - (sq(loser.sigma) / sq(c)) * w)
  );

  const finalWinner: Rating = {
    mu: newWinnerMu,
    sigma: Math.sqrt(sq(newWinnerSigma) + sq(TAU)),
  };

  const finalLoser: Rating = {
    mu: newLoserMu,
    sigma: Math.sqrt(sq(newLoserSigma) + sq(TAU)),
  };

  return { newWinner: finalWinner, newLoser: finalLoser };
};

export const createInitialRating = (): Rating => ({
  mu: INITIAL_MU,
  sigma: INITIAL_SIGMA,
});

export const selectNextPair = (
  images: ImageRecord[],
  recentIds: Set<string> = new Set()
): [ImageRecord, ImageRecord] | null => {
  if (images.length < 2) return null;

  const MAX_PROBES = 100;
  
  const unrankedFound: ImageRecord[] = [];
  for (let i = 0; i < MAX_PROBES && unrankedFound.length < 2; i++) {
    const candidate = images[Math.floor(Math.random() * images.length)];
    if (candidate.matches < 3 && !recentIds.has(candidate.filename)) {
      if (!unrankedFound.includes(candidate)) {
        unrankedFound.push(candidate);
      }
    }
  }

  if (unrankedFound.length >= 2) {
    return [unrankedFound[0], unrankedFound[1]];
  }

  const sampleSize = Math.min(images.length, 50);
  const candidates: ImageRecord[] = [];
  
  for (let i = 0; i < sampleSize; i++) {
    let candidate = images[Math.floor(Math.random() * images.length)];
    let retries = 0;
    while (recentIds.has(candidate.filename) && retries < 5) {
      candidate = images[Math.floor(Math.random() * images.length)];
      retries++;
    }
    candidates.push(candidate);
  }

  candidates.sort((a, b) => {
    const scoreA = a.rating.sigma - (a.impressions * 0.1);
    const scoreB = b.rating.sigma - (b.impressions * 0.1);
    return scoreB - scoreA;
  });
  
  const p1 = candidates[0];

  let bestP2 = candidates[1];
  let bestQuality = -1;

  for (let i = 1; i < candidates.length; i++) {
    const p2 = candidates[i];
    if (p1.filename === p2.filename) continue;
    
    const q = getMatchQuality(p1.rating, p2.rating);
    if (q > bestQuality) {
      bestQuality = q;
      bestP2 = p2;
    }
  }

  if (!bestP2 || bestP2.filename === p1.filename) {
     let p2Index = Math.floor(Math.random() * images.length);
     while (images[p2Index].filename === p1.filename) {
       p2Index = Math.floor(Math.random() * images.length);
     }
     bestP2 = images[p2Index];
  }

  return [p1, bestP2];
};
