export const sq = (x: number) => x * x;

// Cumulative Distribution Function (CDF) of the standard normal distribution
export const cdf = (x: number): number => {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
};

// Probability Density Function (PDF) of the standard normal distribution
export const pdf = (x: number): number => {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
};

// Error function approximation
export const erf = (x: number): number => {
  // Save the sign of x
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  // Constants
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
};

// Inverse CDF (Probit) - not strictly needed for basic updates but useful for matching quality
export const ppf = (p: number): number => {
  // Approximation if needed, but for this app we mostly need PDF/CDF
  return 0; 
};
