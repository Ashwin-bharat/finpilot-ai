import { Injectable, Logger } from '@nestjs/common';
import {
  StockPricePoint,
  AtrResult,
  BollingerBandsResult,
  StochasticResult,
  VwapResult,
  SupportResistanceResult,
  MultiTimeframeSummary,
  TechnicalEngineResult,
  VolatilityRegime,
  BollingerBandSqueezeStatus,
  StochasticMomentumStatus,
  InstitutionalBias,
  TimeframeTrend,
  TechnicalRating,
} from '@finpilot/shared-types';

@Injectable()
export class TechnicalAnalysisEngine {
  private readonly logger = new Logger(TechnicalAnalysisEngine.name);

  /**
   * Master Analysis Method
   * Executes institutional-grade technical models and derives a composite confluence score.
   */
  analyze(
    symbol: string,
    currentPrice: number,
    history: StockPricePoint[],
  ): TechnicalEngineResult {
    const cleanSymbol = symbol.toUpperCase();
    const safePrice = currentPrice > 0 ? currentPrice : (history[history.length - 1]?.close || 1000);

    const atr = this.computeATR(history, safePrice, 14);
    const bollingerBands = this.computeBollingerBands(history, safePrice, 20, 2);
    const stochastic = this.computeStochastic(history, 14, 3);
    const vwap = this.computeVWAP(history, safePrice);
    const supportResistance = this.computeSupportResistance(history, safePrice);
    const multiTimeframe = this.processMultiTimeframe(history, safePrice);

    const { confluenceScore, rating, keyTakeaways } = this.deriveConfluence(
      cleanSymbol,
      safePrice,
      atr,
      bollingerBands,
      stochastic,
      vwap,
      supportResistance,
      multiTimeframe,
    );

    return {
      symbol: cleanSymbol,
      currentPrice: Number(safePrice.toFixed(2)),
      atr,
      bollingerBands,
      stochastic,
      vwap,
      supportResistance,
      multiTimeframe,
      confluenceScore,
      rating,
      keyTakeaways,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * 1. Average True Range (ATR - 14 Period, Wilder's Smoothing)
   */
  computeATR(history: StockPricePoint[], currentPrice: number, period: number = 14): AtrResult {
    if (!history || history.length < 2) {
      const fallbackAtr = Number((currentPrice * 0.02).toFixed(2));
      return {
        value: fallbackAtr,
        period,
        relativeAtrPercent: 2.0,
        volatilityRegime: 'MODERATE_VOLATILITY',
        stopLossBuffer: {
          multiplier1_5: Number((fallbackAtr * 1.5).toFixed(2)),
          multiplier2_0: Number((fallbackAtr * 2.0).toFixed(2)),
          recommendedStopDistance: Number((fallbackAtr * 1.5).toFixed(2)),
          recommendedStopPrice: Number((currentPrice - fallbackAtr * 1.5).toFixed(2)),
        },
        interpretation: 'Limited historical candle series; estimated ATR set at baseline 2.0% volatility band.',
      };
    }

    // Calculate True Range for each candle starting from index 1
    const trSeries: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      const prev = history[i - 1];
      const high = current.high ?? current.close;
      const low = current.low ?? current.close;
      const prevClose = prev.close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      );
      trSeries.push(tr);
    }

    let atr = 0;
    if (trSeries.length <= period) {
      atr = trSeries.reduce((sum, val) => sum + val, 0) / trSeries.length;
    } else {
      // First ATR is simple SMA of first `period` TRs
      let initialSum = 0;
      for (let i = 0; i < period; i++) {
        initialSum += trSeries[i];
      }
      atr = initialSum / period;

      // Wilder's smoothing for remaining periods
      for (let i = period; i < trSeries.length; i++) {
        atr = (atr * (period - 1) + trSeries[i]) / period;
      }
    }

    const safeAtr = Number(Math.max(0.01, atr).toFixed(2));
    const relativeAtrPercent = Number(((safeAtr / currentPrice) * 100).toFixed(2));

    let volatilityRegime: VolatilityRegime = 'MODERATE_VOLATILITY';
    let regimeDesc = 'balanced volatility suitable for standard positional swings';
    if (relativeAtrPercent < 1.5) {
      volatilityRegime = 'LOW_VOLATILITY';
      regimeDesc = 'compressed price range / consolidation regime';
    } else if (relativeAtrPercent > 3.5) {
      volatilityRegime = 'HIGH_VOLATILITY';
      regimeDesc = 'elevated volatility regime requiring wider trailing buffers';
    }

    const stop15 = Number((safeAtr * 1.5).toFixed(2));
    const stop20 = Number((safeAtr * 2.0).toFixed(2));
    const recommendedStopPrice = Number(Math.max(0, currentPrice - stop15).toFixed(2));

    return {
      value: safeAtr,
      period,
      relativeAtrPercent,
      volatilityRegime,
      stopLossBuffer: {
        multiplier1_5: stop15,
        multiplier2_0: stop20,
        recommendedStopDistance: stop15,
        recommendedStopPrice,
      },
      interpretation: `14-day ATR is ₹${safeAtr} (${relativeAtrPercent}% of current price), reflecting a ${regimeDesc}. Suggested dynamic stop buffer is ₹${stop15} (1.5x ATR).`,
    };
  }

  /**
   * 2. Bollinger Bands (20 Period, 2 Standard Deviations)
   */
  computeBollingerBands(
    history: StockPricePoint[],
    currentPrice: number,
    period: number = 20,
    stdDevMultiplier: number = 2,
  ): BollingerBandsResult {
    const validPoints = (history || []).filter((p) => p.close != null && !isNaN(p.close));
    const slice = validPoints.slice(-period);

    if (slice.length < 5) {
      const fallbackMid = currentPrice;
      const fallbackUpper = Number((currentPrice * 1.05).toFixed(2));
      const fallbackLower = Number((currentPrice * 0.95).toFixed(2));
      return {
        middleBand: Number(fallbackMid.toFixed(2)),
        upperBand: fallbackUpper,
        lowerBand: fallbackLower,
        percentB: 0.5,
        bandwidthPercent: 10.0,
        squeezeStatus: 'NORMAL',
        interpretation: 'Insufficient price points for complete Bollinger Band model; price resides within baseline envelope.',
      };
    }

    const closes = slice.map((p) => p.close);
    const n = closes.length;
    const mean = closes.reduce((sum, c) => sum + c, 0) / n;

    const variance = closes.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const middleBand = Number(mean.toFixed(2));
    const upperBand = Number((mean + stdDevMultiplier * stdDev).toFixed(2));
    const lowerBand = Number((mean - stdDevMultiplier * stdDev).toFixed(2));

    const bandRange = upperBand - lowerBand;
    const percentB = bandRange > 0 ? Number(((currentPrice - lowerBand) / bandRange).toFixed(2)) : 0.5;
    const bandwidthPercent = middleBand > 0 ? Number(((bandRange / middleBand) * 100).toFixed(2)) : 0;

    let squeezeStatus: BollingerBandSqueezeStatus = 'NORMAL';
    let squeezeDesc = 'normal band width';
    if (bandwidthPercent < 4.0) {
      squeezeStatus = 'SQUEEZE_CONTRACTION';
      squeezeDesc = 'volatility squeeze contraction — potential directional breakout brewing';
    } else if (bandwidthPercent > 12.0) {
      squeezeStatus = 'SQUEEZE_EXPANSION';
      squeezeDesc = 'volatility expansion underway';
    }

    let positionDesc = 'near the mid-band baseline';
    if (percentB >= 1.0) {
      positionDesc = 'piercing above the upper band (overbought extension / strong momentum)';
    } else if (percentB >= 0.8) {
      positionDesc = 'approaching the upper band envelope';
    } else if (percentB <= 0.0) {
      positionDesc = 'piercing below the lower band (oversold condition / mean-reversion zone)';
    } else if (percentB <= 0.2) {
      positionDesc = 'approaching the lower band envelope';
    }

    return {
      middleBand,
      upperBand,
      lowerBand,
      percentB,
      bandwidthPercent,
      squeezeStatus,
      interpretation: `Price is trading at %B ${percentB} (${positionDesc}) within the ₹${lowerBand} – ₹${upperBand} Bollinger Band envelope. Bandwidth is ${bandwidthPercent}% (${squeezeDesc}).`,
    };

  }

  /**
   * 3. Stochastic Oscillator (14, 3, 3)
   */
  computeStochastic(history: StockPricePoint[], kPeriod: number = 14, dPeriod: number = 3): StochasticResult {
    const validPoints = (history || []).filter((p) => p.close != null && p.high != null && p.low != null);

    if (validPoints.length < kPeriod) {
      return {
        kValue: 50.0,
        dValue: 50.0,
        status: 'NEUTRAL',
        crossoverSignal: 'NONE',
        interpretation: 'Insufficient historical bars for 14-period stochastic calculation (neutral baseline 50.0).',
      };
    }

    // Compute rolling %K series over the last (dPeriod + 2) candles to assess %D and crossover
    const kSeries: number[] = [];
    const startIndex = Math.max(0, validPoints.length - (kPeriod + dPeriod + 2));

    for (let i = startIndex + kPeriod; i <= validPoints.length; i++) {
      const window = validPoints.slice(i - kPeriod, i);
      const currentClose = window[window.length - 1].close;
      const highestHigh = Math.max(...window.map((p) => p.high));
      const lowestLow = Math.min(...window.map((p) => p.low));

      const range = highestHigh - lowestLow;
      const k = range > 0 ? ((currentClose - lowestLow) / range) * 100 : 50;
      kSeries.push(k);
    }

    const latestK = kSeries[kSeries.length - 1] ?? 50.0;
    const prevK = kSeries.length >= 2 ? kSeries[kSeries.length - 2] : latestK;

    // Latest %D is SMA of last `dPeriod` %K values
    const dSlice = kSeries.slice(-dPeriod);
    const latestD = dSlice.reduce((sum, v) => sum + v, 0) / (dSlice.length || 1);

    // Previous %D is SMA of prior `dPeriod` %K values
    const prevDSlice = kSeries.length >= dPeriod + 1 ? kSeries.slice(-dPeriod - 1, -1) : dSlice;
    const prevD = prevDSlice.reduce((sum, v) => sum + v, 0) / (prevDSlice.length || 1);

    const kFormatted = Number(latestK.toFixed(2));
    const dFormatted = Number(latestD.toFixed(2));

    let status: StochasticMomentumStatus = 'NEUTRAL';
    if (kFormatted >= 80) {
      status = 'OVERBOUGHT';
    } else if (kFormatted <= 20) {
      status = 'OVERSOLD';
    } else if (kFormatted > 50 && kFormatted >= dFormatted) {
      status = 'BULLISH_MOMENTUM';
    } else if (kFormatted < 50 && kFormatted <= dFormatted) {
      status = 'BEARISH_MOMENTUM';
    }

    let crossoverSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NONE' = 'NONE';
    if (prevK < prevD && latestK >= latestD) {
      crossoverSignal = 'BULLISH_CROSS';
    } else if (prevK > prevD && latestK <= latestD) {
      crossoverSignal = 'BEARISH_CROSS';
    }

    let crossDesc = 'no active cross';
    if (crossoverSignal === 'BULLISH_CROSS') {
      crossDesc = 'fresh bullish %K crossing above %D signal';
    } else if (crossoverSignal === 'BEARISH_CROSS') {
      crossDesc = 'fresh bearish %K crossing below %D signal';
    }

    return {
      kValue: kFormatted,
      dValue: dFormatted,
      status,
      crossoverSignal,
      interpretation: `Stochastic %K is ${kFormatted} and %D is ${dFormatted} (${status} zone with ${crossDesc}).`,
    };
  }

  /**
   * 4. Volume Weighted Average Price (VWAP)
   */
  computeVWAP(history: StockPricePoint[], currentPrice: number): VwapResult {
    const validPoints = (history || []).filter(
      (p) => p.close != null && p.volume != null && p.high != null && p.low != null,
    );

    if (validPoints.length === 0) {
      return {
        vwap: currentPrice,
        differencePercent: 0,
        bias: 'NEUTRAL_EQUILIBRIUM',
        interpretation: 'Volume data unavailable; benchmark defaults to neutral current price equilibrium.',
      };
    }

    // Standard institutional swing VWAP anchors to the active 20-day rolling trading window (1 trading month).
    // Summing over 252+ daily candles distorts VWAP into a 200-day moving average proxy.
    const sessionPoints = validPoints.slice(-20);

    let cumulativeTypicalVolume = 0;
    let cumulativeVolume = 0;

    for (const point of sessionPoints) {
      const typicalPrice = (point.high + point.low + point.close) / 3;
      const vol = point.volume > 0 ? point.volume : 1;
      cumulativeTypicalVolume += typicalPrice * vol;
      cumulativeVolume += vol;
    }

    const rawVwap = cumulativeVolume > 0 ? cumulativeTypicalVolume / cumulativeVolume : currentPrice;
    const vwap = Number(rawVwap.toFixed(2));
    const diffPercent = vwap > 0 ? Number((((currentPrice - vwap) / vwap) * 100).toFixed(2)) : 0;

    let bias: InstitutionalBias = 'NEUTRAL_EQUILIBRIUM';
    let biasDesc = 'hovering near volume-weighted fair value';
    if (diffPercent >= 0.5) {
      bias = 'BUYER_CONTROL';
      biasDesc = `trading +${diffPercent}% above 20-day VWAP (institutional accumulation / buyer control)`;
    } else if (diffPercent <= -0.5) {
      bias = 'SELLER_CONTROL';
      biasDesc = `trading ${diffPercent}% below 20-day VWAP (institutional distribution / seller control)`;
    }

    return {
      vwap,
      differencePercent: diffPercent,
      bias,
      interpretation: `Institutional 20-day VWAP benchmark stands at ₹${vwap}; price is currently ${biasDesc}.`,
    };
  }

  /**
   * 5. Support & Resistance Pivot Engine (Floor Trader Pivots + Rolling Swing Extrema)
   */
  computeSupportResistance(history: StockPricePoint[], currentPrice: number): SupportResistanceResult {
    const validPoints = (history || []).filter((p) => p.close != null && p.high != null && p.low != null);

    if (validPoints.length === 0) {
      const p = currentPrice;
      const r1 = Number((p * 1.02).toFixed(2));
      const s1 = Number((p * 0.98).toFixed(2));
      const r2 = Number((p * 1.05).toFixed(2));
      const s2 = Number((p * 0.95).toFixed(2));

      return {
        floorPivots: { pivotPoint: p, r1, r2, s1, s2 },
        swingHighResistance: r1,
        swingLowSupport: s1,
        nearestSupport: { level: s1, distancePercent: -2.0, label: 'S1 Support' },
        nearestResistance: { level: r1, distancePercent: 2.0, label: 'R1 Resistance' },
        interpretation: `Floor trader pivots estimated: Pivot ₹${p}, R1 ₹${r1}, S1 ₹${s1}.`,
      };
    }

    // Use the most recent completed period for Floor Pivots
    const recent = validPoints[validPoints.length - 1];
    const prev = validPoints.length >= 2 ? validPoints[validPoints.length - 2] : recent;

    const high = prev.high;
    const low = prev.low;
    const close = prev.close;

    const pivotPoint = Number(((high + low + close) / 3).toFixed(2));
    const r1 = Number((2 * pivotPoint - low).toFixed(2));
    const s1 = Number((2 * pivotPoint - high).toFixed(2));
    const r2 = Number((pivotPoint + (high - low)).toFixed(2));
    const s2 = Number((pivotPoint - (high - low)).toFixed(2));

    // Rolling 20-period swing extrema
    const rollingSlice = validPoints.slice(-20);
    const swingHighResistance = Number(Math.max(...rollingSlice.map((p) => p.high)).toFixed(2));
    const swingLowSupport = Number(Math.min(...rollingSlice.map((p) => p.low)).toFixed(2));

    // Identify nearest support and resistance relative to currentPrice
    const supportCandidates = [
      { level: s1, label: 'S1 Floor Pivot' },
      { level: s2, label: 'S2 Floor Pivot' },
      { level: swingLowSupport, label: '20-day Swing Low' },
    ].filter((c) => c.level <= currentPrice);

    const resistanceCandidates = [
      { level: r1, label: 'R1 Floor Pivot' },
      { level: r2, label: 'R2 Floor Pivot' },
      { level: swingHighResistance, label: '20-day Swing High' },
    ].filter((c) => c.level >= currentPrice);

    const bestSupport = supportCandidates.length > 0
      ? supportCandidates.reduce((prev, curr) => (curr.level > prev.level ? curr : prev))
      : { level: s1, label: 'S1 Floor Pivot' };

    const bestResistance = resistanceCandidates.length > 0
      ? resistanceCandidates.reduce((prev, curr) => (curr.level < prev.level ? curr : prev))
      : { level: r1, label: 'R1 Floor Pivot' };

    const suppDist = Number((((bestSupport.level - currentPrice) / currentPrice) * 100).toFixed(2));
    const resDist = Number((((bestResistance.level - currentPrice) / currentPrice) * 100).toFixed(2));

    return {
      floorPivots: { pivotPoint, r1, r2, s1, s2 },
      swingHighResistance,
      swingLowSupport,
      nearestSupport: { level: bestSupport.level, distancePercent: suppDist, label: bestSupport.label },
      nearestResistance: { level: bestResistance.level, distancePercent: resDist, label: bestResistance.label },
      interpretation: `Key technical floors: ${bestSupport.label} at ₹${bestSupport.level} (${suppDist}%). Key resistance ceilings: ${bestResistance.label} at ₹${bestResistance.level} (+${resDist}%). Central Pivot at ₹${pivotPoint}.`,
    };
  }

  /**
   * 6. Multi-Timeframe Candle Processing (Daily + Synthesized Weekly Bars)
   */
  processMultiTimeframe(history: StockPricePoint[], currentPrice: number): MultiTimeframeSummary {
    const validPoints = (history || []).filter((p) => p.close != null);

    if (validPoints.length < 5) {
      return {
        dailyTrend: 'NEUTRAL',
        weeklyTrend: 'NEUTRAL',
        alignment: 'CONFLICTING_TIMEFRAMES',
        interpretation: 'Insufficient price history for multi-timeframe candle synthesis.',
      };
    }

    // Daily Trend: 20-day SMA slope or price vs 20-day SMA
    const dailySlice = validPoints.slice(-20);
    const dailySma = dailySlice.reduce((sum, p) => sum + p.close, 0) / dailySlice.length;
    const dailyTrend: TimeframeTrend = currentPrice > dailySma * 1.005 ? 'BULLISH' : currentPrice < dailySma * 0.995 ? 'BEARISH' : 'NEUTRAL';

    // Synthesize Weekly Candles (chunk history into 5-day trading weeks)
    const weeklyCloses: number[] = [];
    for (let i = 0; i < validPoints.length; i += 5) {
      const weekChunk = validPoints.slice(i, i + 5);
      if (weekChunk.length > 0) {
        weeklyCloses.push(weekChunk[weekChunk.length - 1].close);
      }
    }

    let weeklyTrend: TimeframeTrend = 'NEUTRAL';
    if (weeklyCloses.length >= 4) {
      const recentWeekly = weeklyCloses.slice(-4);
      const weeklySma = recentWeekly.reduce((sum, c) => sum + c, 0) / recentWeekly.length;
      weeklyTrend = currentPrice > weeklySma * 1.01 ? 'BULLISH' : currentPrice < weeklySma * 0.99 ? 'BEARISH' : 'NEUTRAL';
    } else {
      weeklyTrend = dailyTrend;
    }

    let alignment: 'ALIGNED_BULLISH' | 'ALIGNED_BEARISH' | 'CONFLICTING_TIMEFRAMES' = 'CONFLICTING_TIMEFRAMES';
    let alignmentDesc = 'Daily and weekly momentum exhibit divergent signals, indicating short-term counter-trend consolidation.';

    if (dailyTrend === 'BULLISH' && weeklyTrend === 'BULLISH') {
      alignment = 'ALIGNED_BULLISH';
      alignmentDesc = 'Daily and weekly timeframes are synchronized in an upward trend, indicating structural bullish continuation.';
    } else if (dailyTrend === 'BEARISH' && weeklyTrend === 'BEARISH') {
      alignment = 'ALIGNED_BEARISH';
      alignmentDesc = 'Daily and weekly timeframes are synchronized in a downward trend, reflecting systemic selling pressure.';
    }

    return {
      dailyTrend,
      weeklyTrend,
      alignment,
      interpretation: alignmentDesc,
    };
  }

  /**
   * 7. Confluence Scoring & Rating Engine
   */
  private deriveConfluence(
    symbol: string,
    currentPrice: number,
    atr: AtrResult,
    bb: BollingerBandsResult,
    stoch: StochasticResult,
    vwap: VwapResult,
    sr: SupportResistanceResult,
    mtf: MultiTimeframeSummary,
  ): { confluenceScore: number; rating: TechnicalRating; keyTakeaways: string[] } {
    let score = 50; // Baseline neutral score
    const takeaways: string[] = [];

    // Bollinger Band positioning
    if (bb.percentB > 0.8) {
      score += 8;
      takeaways.push(`Bollinger %B at ${bb.percentB} indicates upper-band expansion and active buying interest.`);
    } else if (bb.percentB < 0.2) {
      score -= 8;
      takeaways.push(`Bollinger %B at ${bb.percentB} indicates pressure along the lower envelope.`);
    }

    if (bb.squeezeStatus === 'SQUEEZE_CONTRACTION') {
      takeaways.push(`Volatility squeeze detected (${bb.bandwidthPercent}% bandwidth) — watch for an imminent directional breakout.`);
    }

    // Stochastic Oscillator
    if (stoch.status === 'OVERSOLD' || stoch.crossoverSignal === 'BULLISH_CROSS') {
      score += 10;
      takeaways.push(`Stochastic oscillator shows constructive momentum turnaround (%K: ${stoch.kValue}, %D: ${stoch.dValue}).`);
    } else if (stoch.status === 'OVERBOUGHT' || stoch.crossoverSignal === 'BEARISH_CROSS') {
      score -= 10;
      takeaways.push(`Stochastic oscillator reflects overbought conditions (%K: ${stoch.kValue}) with potential exhaustion.`);
    }

    // VWAP Institutional Bias
    if (vwap.bias === 'BUYER_CONTROL') {
      score += 10;
      takeaways.push(`Price is trading +${vwap.differencePercent}% above VWAP (₹${vwap.vwap}), confirming buyer control.`);
    } else if (vwap.bias === 'SELLER_CONTROL') {
      score -= 10;
      takeaways.push(`Price is trading ${vwap.differencePercent}% below VWAP (₹${vwap.vwap}), indicating institutional supply.`);
    }

    // Multi-Timeframe Alignment
    if (mtf.alignment === 'ALIGNED_BULLISH') {
      score += 14;
      takeaways.push('Daily and weekly trend structures are bullishly aligned.');
    } else if (mtf.alignment === 'ALIGNED_BEARISH') {
      score -= 14;
      takeaways.push('Daily and weekly trend structures are bearishly aligned.');
    }

    // Support / Resistance Buffer
    if (sr.nearestSupport && Math.abs(sr.nearestSupport.distancePercent) <= 2.5) {
      score += 5;
      takeaways.push(`Proximity to key floor (${sr.nearestSupport.label} at ₹${sr.nearestSupport.level}) offers defined risk.`);
    }

    // Clamp score to [5, 95]
    const clampedScore = Math.max(5, Math.min(95, score));

    let rating: TechnicalRating = 'NEUTRAL';
    if (clampedScore >= 80) {
      rating = 'STRONG_BULLISH';
    } else if (clampedScore >= 60) {
      rating = 'BULLISH';
    } else if (clampedScore >= 40) {
      rating = 'NEUTRAL';
    } else if (clampedScore >= 20) {
      rating = 'BEARISH';
    } else {
      rating = 'STRONG_BEARISH';
    }

    // Add trailing stop guidance
    takeaways.push(`Dynamic volatility-adjusted trailing stop recommended at ₹${atr.stopLossBuffer.recommendedStopPrice} (1.5x ATR buffer: ₹${atr.stopLossBuffer.multiplier1_5}).`);

    return {
      confluenceScore: clampedScore,
      rating,
      keyTakeaways: takeaways,
    };
  }
}
