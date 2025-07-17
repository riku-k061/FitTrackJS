/**
 * Calculate mean of an array of numbers.
 */
exports.calculateMean = (values) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

/**
 * Calculate standard deviation of an array of numbers.
 */
exports.calculateStandardDeviation = (values) => {
  if (values.length <= 1) return 0;
  const mean = exports.calculateMean(values);
  const variance = values.reduce((sum, v) => {
    const d = v - mean;
    return sum + d * d;
  }, 0) / values.length;
  return Math.sqrt(variance);
};

/**
 * Mark each value as anomalous if it deviates by more than `threshold` σ from the mean.
 */
exports.detectAnomalies = (values, referenceValues = null, threshold = 2.0) => {
  const base = referenceValues || values;
  if (base.length <= 1) {
    return values.map(v => ({ value: v, deviation: 0, isAnomaly: false }));
  }
  const mean = exports.calculateMean(base);
  const stdDev = exports.calculateStandardDeviation(base);
  return values.map(v => {
    const dev = stdDev === 0 ? 0 : (v - mean) / stdDev;
    return { value: v, deviation: dev, isAnomaly: Math.abs(dev) > threshold };
  });
};
