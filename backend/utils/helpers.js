/**
 * Utility Helper Functions
 *
 * Collection of reusable utility functions for the WhatsApp Toolkit
 */

/**
 * Generate a random delay following Gaussian (normal) distribution
 * Uses Box-Muller transform for generating normally distributed random numbers
 *
 * @param {number} mean - Mean delay in milliseconds (default: 5000ms)
 * @param {number} stdDev - Standard deviation in milliseconds (default: 1500ms)
 * @param {number} minDelay - Minimum delay to prevent negative values (default: 1000ms)
 * @returns {Promise<number>} Promise that resolves after the random delay, returns actual delay used
 */
function gaussianDelay(mean = 5000, stdDev = 1500, minDelay = 1000) {
  // Box-Muller transform to generate Gaussian random number
  const u1 = Math.random();
  const u2 = Math.random();

  // Standard normal random variable (mean=0, stdDev=1)
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Scale to desired mean and standard deviation
  let delay = mean + z * stdDev;

  // Clamp to minimum delay to prevent negative or too-short delays
  delay = Math.max(minDelay, Math.round(delay));

  return new Promise((resolve) => {
    setTimeout(() => resolve(delay), delay);
  });
}

/**
 * Generate Gaussian random number (without delay)
 * Useful for testing or generating random values
 *
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @returns {number} Random number following Gaussian distribution
 */
function gaussianRandom(mean = 0, stdDev = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

module.exports = {
  gaussianDelay,
  gaussianRandom
};
