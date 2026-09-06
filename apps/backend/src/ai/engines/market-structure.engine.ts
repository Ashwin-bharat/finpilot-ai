import { Injectable, Logger } from '@nestjs/common';
import {
  StockPricePoint,
  StructuralTrend,
  SwingPoint,
  OrderBlock,
  OrderBlockType,
  FairValueGap,
  FvgType,
  LiquiditySweep,
  DealingRange,
  MarketStructureResult,
} from '@finpilot/shared-types';

@Injectable()
export class MarketStructureEngine {
  private readonly logger = new Logger(MarketStructureEngine.name);

  /**
   * Master Analysis Method
   * Executes Institutional Smart Money Concepts (SMC) algorithms:
   * 1. Fractal Swing Points (HH, HL, LH, LL)
   * 2. Market Structure Shifts (BOS / CHoCH) & Trend Classification
   * 3. Order Blocks (Bullish Demand / Bearish Supply) & Mitigation Tracking
   * 4. Fair Value Gaps (FVG Imbalances) & Fill Tracking
   * 5. Liquidity Sweep Detection (Buyside / Sellside Purges)
   * 6. Dealing Range & Equilibrium (Premium vs. Discount Zones + OTE)
   */
  analyze(
    symbol: string,
    currentPrice: number,
    history: StockPricePoint[],
  ): MarketStructureResult {
    const cleanSymbol = symbol.toUpperCase();
    const safePrice = currentPrice > 0 ? currentPrice : (history[history.length - 1]?.close || 1000);

    const swingPoints = this.identifySwingPoints(history);
    const { trend, lastStructureShift } = this.classifyTrendAndStructure(swingPoints, safePrice);
    const orderBlocks = this.detectOrderBlocks(history, safePrice);
    const activeOrderBlocks = orderBlocks.filter((ob) => !ob.mitigated);

    const fairValueGaps = this.detectFairValueGaps(history, safePrice);
    const unfilledFvgs = fairValueGaps.filter((fvg) => !fvg.filled);

    const liquiditySweeps = this.detectLiquiditySweeps(history, swingPoints);
    const dealingRange = this.calculateDealingRange(swingPoints, history, safePrice);

    const { structureRating, institutionalNarrative, keyStructureTakeaways } = this.deriveStructureNarrative(
      cleanSymbol,
      safePrice,
      trend,
      lastStructureShift,
      activeOrderBlocks,
      unfilledFvgs,
      liquiditySweeps,
      dealingRange,
    );

    return {
      symbol: cleanSymbol,
      currentPrice: Number(safePrice.toFixed(2)),
      trend,
      lastStructureShift,
      swingPoints,
      orderBlocks,
      activeOrderBlocks,
      fairValueGaps,
      unfilledFvgs,
      liquiditySweeps,
      dealingRange,
      structureRating,
      institutionalNarrative,
      keyStructureTakeaways,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * 1. Fractal Swing Point Identification
   * Uses 5-candle fractal pivot detection: a swing high requires higher highs than 2 candles before and 2 after.
   */
  identifySwingPoints(history: StockPricePoint[]): SwingPoint[] {
    const validPoints = (history || []).filter(
      (p) => p.high != null && p.low != null && p.close != null,
    );

    if (validPoints.length < 5) {
      return [];
    }

    const rawSwings: { index: number; timestamp: string; type: 'SWING_HIGH' | 'SWING_LOW'; price: number }[] = [];

    // Detect 5-candle fractal extrema
    for (let i = 2; i < validPoints.length - 2; i++) {
      const curr = validPoints[i];
      const prev2 = validPoints[i - 2];
      const prev1 = validPoints[i - 1];
      const next1 = validPoints[i + 1];
      const next2 = validPoints[i + 2];

      const isSwingHigh =
        curr.high > prev2.high &&
        curr.high >= prev1.high &&
        curr.high >= next1.high &&
        curr.high > next2.high;

      const isSwingLow =
        curr.low < prev2.low &&
        curr.low <= prev1.low &&
        curr.low <= next1.low &&
        curr.low < next2.low;

      if (isSwingHigh) {
        rawSwings.push({
          index: i,
          timestamp: curr.timestamp,
          type: 'SWING_HIGH',
          price: Number(curr.high.toFixed(2)),
        });
      }

      if (isSwingLow) {
        rawSwings.push({
          index: i,
          timestamp: curr.timestamp,
          type: 'SWING_LOW',
          price: Number(curr.low.toFixed(2)),
        });
      }
    }

    // Label swings as HH, LH, HL, LL
    const labeledSwings: SwingPoint[] = [];
    let lastHigh: number | null = null;
    let lastLow: number | null = null;

    for (const swing of rawSwings) {
      if (swing.type === 'SWING_HIGH') {
        const label: 'HH' | 'LH' = lastHigh === null || swing.price >= lastHigh ? 'HH' : 'LH';
        lastHigh = swing.price;
        labeledSwings.push({ ...swing, label });
      } else {
        const label: 'HL' | 'LL' = lastLow === null || swing.price >= lastLow ? 'HL' : 'LL';
        lastLow = swing.price;
        labeledSwings.push({ ...swing, label });
      }
    }

    return labeledSwings;
  }

  /**
   * 2. Trend Classification & Structure Shifts (BOS / CHoCH)
   */
  classifyTrendAndStructure(
    swings: SwingPoint[],
    currentPrice: number,
  ): { trend: StructuralTrend; lastStructureShift?: string } {
    if (swings.length < 3) {
      return { trend: 'RANGE_ACCUMULATION' };
    }

    const recentHighs = swings.filter((s) => s.type === 'SWING_HIGH').slice(-3);
    const recentLows = swings.filter((s) => s.type === 'SWING_LOW').slice(-3);

    const latestHigh = recentHighs[recentHighs.length - 1];
    const prevHigh = recentHighs.length >= 2 ? recentHighs[recentHighs.length - 2] : null;
    const latestLow = recentLows[recentLows.length - 1];
    const prevLow = recentLows.length >= 2 ? recentLows[recentLows.length - 2] : null;

    // Detect Break of Structure (BOS)
    if (latestHigh && prevHigh && currentPrice > prevHigh.price) {
      return {
        trend: 'BULLISH_EXPANSION',
        lastStructureShift: `Bullish Break of Structure (BOS) confirmed above ₹${prevHigh.price}`,
      };
    }

    if (latestLow && prevLow && currentPrice < prevLow.price) {
      return {
        trend: 'BEARISH_EXPANSION',
        lastStructureShift: `Bearish Break of Structure (BOS) confirmed below ₹${prevLow.price}`,
      };
    }

    // Detect Change of Character (CHoCH)
    const isHigherHighs = latestHigh && prevHigh && latestHigh.price > prevHigh.price;
    const isHigherLows = latestLow && prevLow && latestLow.price > prevLow.price;
    const isLowerHighs = latestHigh && prevHigh && latestHigh.price < prevHigh.price;
    const isLowerLows = latestLow && prevLow && latestLow.price < prevLow.price;

    if (isHigherHighs && isHigherLows) {
      return { trend: 'BULLISH_EXPANSION', lastStructureShift: 'Bullish sequence (Consecutive HH + HL)' };
    }

    if (isLowerHighs && isLowerLows) {
      return { trend: 'BEARISH_EXPANSION', lastStructureShift: 'Bearish sequence (Consecutive LH + LL)' };
    }

    if (isLowerHighs && isHigherLows) {
      return { trend: 'RANGE_ACCUMULATION', lastStructureShift: 'Symmetrical structure compression / triangular consolidation' };
    }

    if (isHigherHighs && isLowerLows) {
      return { trend: 'STRUCTURE_SHIFT_BULLISH', lastStructureShift: 'Expanding volatility structure' };
    }

    return { trend: 'RANGE_ACCUMULATION', lastStructureShift: 'Consolidation within swing bounds' };
  }

  /**
   * 3. Institutional Order Block (OB) Detection & Mitigation Tracking
   */
  detectOrderBlocks(history: StockPricePoint[], currentPrice: number): OrderBlock[] {
    const valid = (history || []).filter((p) => p.open != null && p.close != null && p.high != null && p.low != null);
    if (valid.length < 3) return [];

    const orderBlocks: OrderBlock[] = [];

    // Calculate average candle body size to detect impulse moves
    const bodySizes = valid.map((c) => Math.abs(c.close - c.open));
    const avgBody = bodySizes.reduce((sum, b) => sum + b, 0) / bodySizes.length;

    // Scan for aggressive impulse moves (body > 1.35x average body)
    for (let i = 1; i < valid.length; i++) {
      const prev = valid[i - 1];
      const impulse = valid[i];
      const impulseBody = Math.abs(impulse.close - impulse.open);

      const isBullishImpulse = impulse.close > impulse.open && impulseBody > avgBody * 1.35;
      const isBearishImpulse = impulse.close < impulse.open && impulseBody > avgBody * 1.35;

      if (isBullishImpulse && prev.close <= prev.open) {
        // Bullish Order Block (Demand): last down candle before aggressive rally
        const obHigh = Math.max(prev.open, prev.close);
        const obLow = prev.low;

        // Check subsequent price action for mitigation
        let mitigated = false;
        let mitigatedAt: string | undefined;

        for (let k = i + 1; k < valid.length; k++) {
          if (valid[k].low <= obHigh) {
            mitigated = true;
            mitigatedAt = valid[k].timestamp;
            break;
          }
        }

        orderBlocks.push({
          type: 'BULLISH_DEMAND',
          candleIndex: i - 1,
          timestamp: prev.timestamp,
          high: Number(obHigh.toFixed(2)),
          low: Number(obLow.toFixed(2)),
          mitigated,
          mitigatedAt,
          significance: impulseBody > avgBody * 2.0 ? 'HIGH' : 'MEDIUM',
        });
      }

      if (isBearishImpulse && prev.close >= prev.open) {
        // Bearish Order Block (Supply): last up candle before aggressive drop
        const obHigh = prev.high;
        const obLow = Math.min(prev.open, prev.close);

        let mitigated = false;
        let mitigatedAt: string | undefined;

        for (let k = i + 1; k < valid.length; k++) {
          if (valid[k].high >= obLow) {
            mitigated = true;
            mitigatedAt = valid[k].timestamp;
            break;
          }
        }

        orderBlocks.push({
          type: 'BEARISH_SUPPLY',
          candleIndex: i - 1,
          timestamp: prev.timestamp,
          high: Number(obHigh.toFixed(2)),
          low: Number(obLow.toFixed(2)),
          mitigated,
          mitigatedAt,
          significance: impulseBody > avgBody * 2.0 ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    // Keep the most recent 6 order blocks
    return orderBlocks.slice(-6);
  }

  /**
   * 4. Fair Value Gap (FVG) / Imbalance Detection & Fill Tracking
   */
  detectFairValueGaps(history: StockPricePoint[], currentPrice: number): FairValueGap[] {
    const valid = (history || []).filter((p) => p.high != null && p.low != null);
    if (valid.length < 3) return [];

    const fvgs: FairValueGap[] = [];

    for (let i = 2; i < valid.length; i++) {
      const c1 = valid[i - 2];
      const c2 = valid[i - 1];
      const c3 = valid[i];

      // Bullish FVG: Candle 1 High < Candle 3 Low (Gap between c1.high and c3.low)
      if (c3.low > c1.high) {
        const top = Number(c3.low.toFixed(2));
        const bottom = Number(c1.high.toFixed(2));
        const size = Number((top - bottom).toFixed(2));
        const sizePercent = Number(((size / bottom) * 100).toFixed(2));

        // Track if subsequent candles filled the gap
        let filled = false;
        for (let k = i + 1; k < valid.length; k++) {
          if (valid[k].low <= bottom) {
            filled = true;
            break;
          }
        }

        const proxDist = currentPrice > 0 ? Number((((bottom - currentPrice) / currentPrice) * 100).toFixed(2)) : 0;

        fvgs.push({
          type: 'BULLISH_IMBALANCE',
          startIndex: i - 1,
          timestamp: c2.timestamp,
          top,
          bottom,
          size,
          sizePercent,
          filled,
          currentProximityPercent: proxDist,
        });
      }

      // Bearish FVG: Candle 1 Low > Candle 3 High (Gap between c3.high and c1.low)
      if (c3.high < c1.low) {
        const top = Number(c1.low.toFixed(2));
        const bottom = Number(c3.high.toFixed(2));
        const size = Number((top - bottom).toFixed(2));
        const sizePercent = Number(((size / bottom) * 100).toFixed(2));

        let filled = false;
        for (let k = i + 1; k < valid.length; k++) {
          if (valid[k].high >= top) {
            filled = true;
            break;
          }
        }

        const proxDist = currentPrice > 0 ? Number((((top - currentPrice) / currentPrice) * 100).toFixed(2)) : 0;

        fvgs.push({
          type: 'BEARISH_IMBALANCE',
          startIndex: i - 1,
          timestamp: c2.timestamp,
          top,
          bottom,
          size,
          sizePercent,
          filled,
          currentProximityPercent: proxDist,
        });
      }
    }

    return fvgs.slice(-8);
  }

  /**
   * 5. Liquidity Sweep Detection (Buyside & Sellside Stop Runs)
   */
  detectLiquiditySweeps(history: StockPricePoint[], swings: SwingPoint[]): LiquiditySweep[] {
    const valid = (history || []).filter((p) => p.high != null && p.low != null && p.close != null);
    if (valid.length === 0 || swings.length === 0) return [];

    const sweeps: LiquiditySweep[] = [];
    const swingHighs = swings.filter((s) => s.type === 'SWING_HIGH');
    const swingLows = swings.filter((s) => s.type === 'SWING_LOW');

    // Scan recent candles (last 20) for sweeps
    const scanSlice = valid.slice(-20);

    for (const candle of scanSlice) {
      // Buyside Liquidity Sweep: Wick pierced above swing high, but close remained below
      for (const sh of swingHighs) {
        if (candle.high > sh.price && candle.close < sh.price) {
          sweeps.push({
            type: 'BUYSIDE_LIQUIDITY_SWEEP',
            sweepPrice: Number(candle.high.toFixed(2)),
            swingPrice: sh.price,
            timestamp: candle.timestamp,
            reversalConfirmed: candle.close < candle.open,
            interpretation: `Buyside liquidity sweep: Price probed above prior swing high (₹${sh.price}) to ₹${candle.high.toFixed(2)}, but closed back below, rejecting overhead liquidity.`,
          });
          break;
        }
      }

      // Sellside Liquidity Sweep: Wick pierced below swing low, but close remained above
      for (const sl of swingLows) {
        if (candle.low < sl.price && candle.close > sl.price) {
          sweeps.push({
            type: 'SELLSIDE_LIQUIDITY_SWEEP',
            sweepPrice: Number(candle.low.toFixed(2)),
            swingPrice: sl.price,
            timestamp: candle.timestamp,
            reversalConfirmed: candle.close > candle.open,
            interpretation: `Sellside liquidity sweep: Price swept beneath prior swing low (₹${sl.price}) to ₹${candle.low.toFixed(2)}, but closed back above, absorbing institutional sell stops.`,
          });
          break;
        }
      }
    }

    return sweeps.slice(-4);
  }

  /**
   * 6. Dealing Range & Equilibrium (Premium vs. Discount Zones)
   */
  calculateDealingRange(
    swings: SwingPoint[],
    history: StockPricePoint[],
    currentPrice: number,
  ): DealingRange {
    const validPoints = (history || []).filter((p) => p.high != null && p.low != null);

    let rangeHigh: number;
    let rangeLow: number;

    const swingHighs = swings.filter((s) => s.type === 'SWING_HIGH');
    const swingLows = swings.filter((s) => s.type === 'SWING_LOW');

    if (swingHighs.length > 0 && swingLows.length > 0) {
      rangeHigh = Math.max(...swingHighs.slice(-3).map((s) => s.price));
      rangeLow = Math.min(...swingLows.slice(-3).map((s) => s.price));
    } else if (validPoints.length > 0) {
      const slice = validPoints.slice(-30);
      rangeHigh = Math.max(...slice.map((p) => p.high));
      rangeLow = Math.min(...slice.map((p) => p.low));
    } else {
      rangeHigh = Number((currentPrice * 1.05).toFixed(2));
      rangeLow = Number((currentPrice * 0.95).toFixed(2));
    }

    // Guard against equal high/low
    if (rangeHigh <= rangeLow) {
      rangeHigh = Number((currentPrice * 1.05).toFixed(2));
      rangeLow = Number((currentPrice * 0.95).toFixed(2));
    }

    const range = rangeHigh - rangeLow;
    const equilibrium = Number(((rangeHigh + rangeLow) / 2).toFixed(2));

    const relPos = Number((((currentPrice - rangeLow) / range) * 100).toFixed(2));
    const clampedPos = Math.max(0, Math.min(100, relPos));

    let currentZone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' = 'EQUILIBRIUM';
    if (clampedPos > 53.0) {
      currentZone = 'PREMIUM';
    } else if (clampedPos < 47.0) {
      currentZone = 'DISCOUNT';
    }

    // Optimal Trade Entry (Fibonacci 61.8% and 78.6% retracement from range high)
    const fib618 = Number((rangeHigh - 0.618 * range).toFixed(2));
    const fib786 = Number((rangeHigh - 0.786 * range).toFixed(2));

    return {
      rangeHigh: Number(rangeHigh.toFixed(2)),
      rangeLow: Number(rangeLow.toFixed(2)),
      equilibrium,
      currentZone,
      relativePositionPercent: clampedPos,
      optimalTradeEntry: {
        fib618,
        fib786,
      },
    };
  }

  /**
   * 7. Derive Institutional Structure Narrative & Rating
   */
  private deriveStructureNarrative(
    symbol: string,
    currentPrice: number,
    trend: StructuralTrend,
    lastShift: string | undefined,
    activeObs: OrderBlock[],
    unfilledFvgs: FairValueGap[],
    sweeps: LiquiditySweep[],
    range: DealingRange,
  ): {
    structureRating: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
    institutionalNarrative: string;
    keyStructureTakeaways: string[];
  } {
    const takeaways: string[] = [];

    // Trend description
    let trendDesc = 'structural consolidation';
    if (trend === 'BULLISH_EXPANSION') {
      trendDesc = 'institutional bullish expansion with higher swing highs and higher lows';
    } else if (trend === 'BEARISH_EXPANSION') {
      trendDesc = 'institutional bearish expansion with lower swing highs and lower lows';
    } else if (trend === 'STRUCTURE_SHIFT_BULLISH') {
      trendDesc = 'bullish market structure shift / character change';
    } else if (trend === 'STRUCTURE_SHIFT_BEARISH') {
      trendDesc = 'bearish market structure shift / character change';
    }

    takeaways.push(`Market structure displays ${trendDesc} (${lastShift || 'stable swing cycle'}).`);

    // Dealing range positioning
    if (range.currentZone === 'DISCOUNT') {
      takeaways.push(`Price trades at ${range.relativePositionPercent}% of dealing range, residing within the institutional DISCOUNT zone (favorable risk-reward for buyers).`);
    } else if (range.currentZone === 'PREMIUM') {
      takeaways.push(`Price trades at ${range.relativePositionPercent}% of dealing range, residing within the institutional PREMIUM zone (elevated supply overhead).`);
    } else {
      takeaways.push(`Price is centered near 50% equilibrium (₹${range.equilibrium}) within the ₹${range.rangeLow} – ₹${range.rangeHigh} dealing range.`);
    }

    // Active unmitigated order blocks
    const activeDemand = activeObs.find((ob) => ob.type === 'BULLISH_DEMAND');
    const activeSupply = activeObs.find((ob) => ob.type === 'BEARISH_SUPPLY');

    if (activeDemand) {
      takeaways.push(`Key unmitigated demand Order Block identified at ₹${activeDemand.low} – ₹${activeDemand.high} (${activeDemand.significance} conviction origin).`);
    }
    if (activeSupply) {
      takeaways.push(`Key unmitigated supply Order Block identified at ₹${activeSupply.low} – ₹${activeSupply.high} (${activeSupply.significance} conviction origin).`);
    }

    // Unfilled Fair Value Gaps
    const freshFvg = unfilledFvgs[unfilledFvgs.length - 1];
    if (freshFvg) {
      const fvgLabel = freshFvg.type === 'BULLISH_IMBALANCE' ? 'Bullish FVG demand' : 'Bearish FVG supply';
      takeaways.push(`Active 3-candle ${fvgLabel} imbalance at ₹${freshFvg.bottom} – ₹${freshFvg.top} (${freshFvg.sizePercent}% gap) acts as an institutional liquidity magnet.`);
    }

    // Liquidity sweeps
    const recentSweep = sweeps[sweeps.length - 1];
    if (recentSweep) {
      takeaways.push(recentSweep.interpretation);
    }

    // Rating derivation
    let rating: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH' = 'NEUTRAL';
    if (trend === 'BULLISH_EXPANSION') {
      rating = range.currentZone === 'DISCOUNT' ? 'STRONG_BULLISH' : 'BULLISH';
    } else if (trend === 'BEARISH_EXPANSION') {
      rating = range.currentZone === 'PREMIUM' ? 'STRONG_BEARISH' : 'BEARISH';
    } else if (trend === 'STRUCTURE_SHIFT_BULLISH') {
      rating = 'BULLISH';
    } else if (trend === 'STRUCTURE_SHIFT_BEARISH') {
      rating = 'BEARISH';
    }

    const narrative = `${symbol} is characterized by [STRUCTURE: ${trend.replace(/_/g, ' ')}] trading at ₹${currentPrice}. Price currently resides in the [ZONE: ${range.currentZone} ${range.relativePositionPercent}%] of its institutional dealing range (₹${range.rangeLow} – ₹${range.rangeHigh}, 50% Equilibrium: ₹${range.equilibrium}). ${activeDemand ? `Unmitigated demand OB is anchored at ₹${activeDemand.low} – ₹${activeDemand.high}.` : ''} ${freshFvg ? `Unfilled liquidity gap spans ₹${freshFvg.bottom} – ₹${freshFvg.top}.` : ''}`;

    return {
      structureRating: rating,
      institutionalNarrative: narrative,
      keyStructureTakeaways: takeaways,
    };
  }
}
