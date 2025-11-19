
export const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50; // Default neutral

  let gains = 0;
  let losses = 0;

  // Calculate initial average gain/loss
  for (let i = prices.length - period; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
    }
  }

  if (losses === 0) return 100;
  
  const relativeStrength = gains / losses;
  return 100 - (100 / (1 + relativeStrength));
};

export const calculateEMA = (currentPrice: number, prevEMA: number, period: number = 20): number => {
  if (!prevEMA) return currentPrice;
  const k = 2 / (period + 1);
  return currentPrice * k + prevEMA * (1 - k);
};

export const calculateStandardDeviation = (prices: number[], period: number = 20): number => {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const squaredDiffs = slice.map(p => Math.pow(p - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  return Math.sqrt(avgSquaredDiff);
};

export const calculateBollingerBands = (prices: number[], period: number = 20, stdDevMultiplier: number = 2) => {
  if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
  
  const slice = prices.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
  const stdDev = calculateStandardDeviation(prices, period);

  return {
    upper: sma + (stdDev * stdDevMultiplier),
    middle: sma,
    lower: sma - (stdDev * stdDevMultiplier)
  };
};

export const calculateMACD = (prices: number[]) => {
  // Needs at least 26 periods
  if (prices.length < 26) return { macdLine: 0, signalLine: 0, histogram: 0 };

  // 1. Calculate Fast EMA (12)
  let ema12 = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema12 = calculateEMA(prices[i], ema12, 12);
  }

  // 2. Calculate Slow EMA (26)
  let ema26 = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema26 = calculateEMA(prices[i], ema26, 26);
  }

  const macdLine = ema12 - ema26;
  
  // 3. We need a series of MACD lines to calculate the Signal Line (EMA 9 of MACD)
  // For this simplified simulation, we will approximate the Signal Line by smoothing the current MACD
  // In a full production app, we would store the MACD history separately.
  // Here, we return a simplified state for immediate decision making.
  
  return { 
    macdLine, 
    signalLine: macdLine * 0.85, // Approximation for simulation visual (Signal lags MACD)
    histogram: macdLine - (macdLine * 0.85) 
  };
};

export const calculateLinearRegressionSlope = (prices: number[], period: number = 20): number => {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const n = slice.length;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += slice[i];
    sumXY += i * slice[i];
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope;
};

export const generateRandomWalk = (currentPrice: number, volatility: number): number => {
  const changePercent = (Math.random() - 0.5) * 2 * volatility;
  return currentPrice * (1 + changePercent);
};
