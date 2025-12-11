/**
 * Detects Fair Value Gap (FVG) in a sequence of 3 candles.
 * 
 * @param {Array} candles - Array of 3 candles [i-2, i-1, i]
 * @returns {Object} { isDetected: boolean, type: 'bullish'|'bearish'|null, gapTop: number, gapBottom: number }
 */
export function detectFairValueGap(candles) {
  if (!candles || candles.length < 3) {
    return { isDetected: false, type: null, gapTop: 0, gapBottom: 0 };
  }

  // We only care about the last 3 candles passed
  const c0 = candles[candles.length - 3]; // i-2
  // const c1 = candles[candles.length - 2]; // i-1 (Middle candle, usually large body)
  const c2 = candles[candles.length - 1]; // i (Latest closed)

  // Bullish FVG: Low(i) > High(i-2)
  if (c2.low > c0.high) {
    return {
      isDetected: true,
      type: 'bullish',
      gapTop: c2.low,
      gapBottom: c0.high
    };
  }

  // Bearish FVG: High(i) < Low(i-2)
  if (c2.high < c0.low) {
    return {
      isDetected: true,
      type: 'bearish',
      gapTop: c0.low,
      gapBottom: c2.high
    };
  }

  return { isDetected: false, type: null, gapTop: 0, gapBottom: 0 };
}

/**
 * Scans for the most recent valid Order Block (OB).
 * 
 * @param {Array} candles - Array of candles (at least 20 recommended)
 * @returns {Object} { isDetected: boolean, type: 'bullish'|'bearish'|null, top: number, bottom: number, candleIndex: number }
 */
export function detectOrderBlock(candles) {
    if (!candles || candles.length < 4) {
        return { isDetected: false, type: null, top: 0, bottom: 0, candleIndex: -1 };
    }

    // Iterate backwards, starting from the 4th to last candle (leaving room for the impulse check)
    // We look for the IMPULSE first, then check the candle BEFORE it.
    // Loop from end-2 down to 1 (checks current as impulse, prev as OB)
    for (let i = candles.length - 1; i > 0; i--) {
        const current = candles[i];
        const prev = candles[i - 1]; // Potential OB
        
        // 1. BULLISH OB DETECTION
        // Logic: Previous candle was RED (Bearish), followed by a strong GREEN move.
        const isPrevRed = prev.close < prev.open;
        if (isPrevRed) {
            // Check for Impulse: Next 1-2 candles are Green and cover significant distance
            // Simple check: The candle AFTER the OB (current) is Green and breaks the OB's High
            const isImpulse = current.close > current.open && current.close > prev.high;
            
            // Refined Impulse: Body size of impulse is larger than OB body? Or just a strong move.
            // Let's stick to: "Last red candle before an upward explosion"
            // We check if 'current' (and maybe 'next') represents an explosion.
            // Let's assume 'current' is the start of the explosion.
            
            if (isImpulse) {
                // Check if it has been mitigated/invalidated by *subsequent* price action?
                // For this helper, we just find the structure. The strategy checks if we are currently testing it.
                // However, if price CRASHED below it later, it's broken.
                // We will return the *most recent* one we find.
                
                // Optional: Check if the move was "significant" (e.g. body > prev body)
                const impulseBody = Math.abs(current.close - current.open);
                const obBody = Math.abs(prev.open - prev.close);
                
                if (impulseBody > obBody * 1.1) { // 10% larger body implies momentum
                     return {
                        isDetected: true,
                        type: 'bullish',
                        top: prev.high,
                        bottom: prev.low,
                        candleIndex: i - 1
                    };
                }
            }
        }

        // 2. BEARISH OB DETECTION
        // Logic: Previous candle was GREEN (Bullish), followed by a strong RED move.
        const isPrevGreen = prev.close > prev.open;
        if (isPrevGreen) {
            const isImpulse = current.close < current.open && current.close < prev.low;
            
            if (isImpulse) {
                 const impulseBody = Math.abs(current.close - current.open);
                 const obBody = Math.abs(prev.open - prev.close);
                 
                 if (impulseBody > obBody * 1.1) {
                    return {
                        isDetected: true,
                        type: 'bearish',
                        top: prev.high,
                        bottom: prev.low,
                        candleIndex: i - 1
                    };
                 }
            }
        }
    }

    return { isDetected: false, type: null, top: 0, bottom: 0, candleIndex: -1 };
}
