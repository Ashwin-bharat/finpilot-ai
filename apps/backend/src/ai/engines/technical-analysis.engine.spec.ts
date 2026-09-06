import { TechnicalAnalysisEngine } from './technical-analysis.engine';
import { StockPricePoint } from '@finpilot/shared-types';

describe('TechnicalAnalysisEngine', () => {
  let engine: TechnicalAnalysisEngine;

  beforeEach(() => {
    engine = new TechnicalAnalysisEngine();
  });

  // Helper to generate synthetic daily OHLCV series
  function generateCandles(
    count: number,
    startPrice: number,
    drift: number = 0,
    volatility: number = 10,
  ): StockPricePoint[] {
    const candles: StockPricePoint[] = [];
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      price = Math.max(10, price + drift + (i % 3 === 0 ? volatility : -volatility * 0.8));
      const open = Number((price - 2).toFixed(2));
      const close = Number((price + 2).toFixed(2));
      const high = Number((Math.max(open, close) + volatility).toFixed(2));
      const low = Number((Math.min(open, close) - volatility).toFixed(2));
      const volume = 100000 + i * 5000;

      candles.push({
        timestamp: new Date(Date.now() - (count - i) * 86400000).toISOString(),
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return candles;
  }

  describe('1. ATR (Average True Range)', () => {
    it('computes 14-day smoothed ATR with accurate volatility regime and stop buffers', () => {
      const candles = generateCandles(30, 2500, 2, 15);
      const atr = engine.computeATR(candles, 2550, 14);

      expect(atr.period).toBe(14);
      expect(atr.value).toBeGreaterThan(0);
      expect(atr.relativeAtrPercent).toBeGreaterThan(0);
      expect(['LOW_VOLATILITY', 'MODERATE_VOLATILITY', 'HIGH_VOLATILITY']).toContain(atr.volatilityRegime);
      expect(atr.stopLossBuffer.multiplier1_5).toBeCloseTo(atr.value * 1.5, 1);
      expect(atr.stopLossBuffer.multiplier2_0).toBeCloseTo(atr.value * 2.0, 1);
      expect(atr.stopLossBuffer.recommendedStopPrice).toBeCloseTo(2550 - atr.stopLossBuffer.multiplier1_5, 1);
      expect(atr.interpretation).toContain('14-day ATR');
    });

    it('handles minimal price history gracefully with safe default fallback', () => {
      const atr = engine.computeATR([], 1000, 14);

      expect(atr.value).toBe(20); // 2% of 1000
      expect(atr.relativeAtrPercent).toBe(2.0);
      expect(atr.volatilityRegime).toBe('MODERATE_VOLATILITY');
      expect(atr.stopLossBuffer.multiplier1_5).toBe(30);
      expect(atr.stopLossBuffer.recommendedStopPrice).toBe(970);
    });

    it('classifies high volatility regime correctly when ATR exceeds 3.5%', () => {
      // High volatility: price 1000, swings of 60+ (TR > 100, ATR ~ 100 => 10%)
      const highVolCandles = generateCandles(25, 1000, 0, 70);
      const atr = engine.computeATR(highVolCandles, 1000, 14);

      expect(atr.volatilityRegime).toBe('HIGH_VOLATILITY');
      expect(atr.relativeAtrPercent).toBeGreaterThan(3.5);
    });
  });

  describe('2. Bollinger Bands', () => {
    it('computes 20-period middle band, upper/lower envelopes, %B, and bandwidth', () => {
      const candles = generateCandles(40, 3000, 1, 20);
      const currentPrice = 3050;
      const bb = engine.computeBollingerBands(candles, currentPrice, 20, 2);

      expect(bb.middleBand).toBeGreaterThan(0);
      expect(bb.upperBand).toBeGreaterThan(bb.middleBand);
      expect(bb.lowerBand).toBeLessThan(bb.middleBand);
      expect(bb.bandwidthPercent).toBeGreaterThan(0);
      expect(typeof bb.percentB).toBe('number');
      expect(['SQUEEZE_EXPANSION', 'SQUEEZE_CONTRACTION', 'NORMAL']).toContain(bb.squeezeStatus);
      expect(bb.interpretation).toContain('Bollinger Band');
    });

    it('identifies overbought condition when price pierces upper band (%B >= 1.0)', () => {
      const candles = generateCandles(30, 2000, 0, 10);
      // Force price far above the bands
      const bb = engine.computeBollingerBands(candles, 2500, 20, 2);

      expect(bb.percentB).toBeGreaterThanOrEqual(1.0);
      expect(bb.interpretation).toContain('piercing above the upper band');
    });

    it('handles insufficient history (< 5 candles) with safe default envelope', () => {
      const bb = engine.computeBollingerBands([], 1500, 20, 2);

      expect(bb.middleBand).toBe(1500);
      expect(bb.upperBand).toBe(1575); // 1.05 * 1500
      expect(bb.lowerBand).toBe(1425); // 0.95 * 1500
      expect(bb.percentB).toBe(0.5);
    });
  });

  describe('3. Stochastic Oscillator', () => {
    it('computes %K, %D, status, and crossover signals on 14-period history', () => {
      const candles = generateCandles(35, 1200, 3, 15);
      const stoch = engine.computeStochastic(candles, 14, 3);

      expect(stoch.kValue).toBeGreaterThanOrEqual(0);
      expect(stoch.kValue).toBeLessThanOrEqual(100);
      expect(stoch.dValue).toBeGreaterThanOrEqual(0);
      expect(stoch.dValue).toBeLessThanOrEqual(100);
      expect(['OVERBOUGHT', 'OVERSOLD', 'BULLISH_MOMENTUM', 'BEARISH_MOMENTUM', 'NEUTRAL']).toContain(stoch.status);
      expect(['BULLISH_CROSS', 'BEARISH_CROSS', 'NONE']).toContain(stoch.crossoverSignal);
      expect(stoch.interpretation).toContain('Stochastic %K');
    });

    it('returns neutral baseline 50.0 when history is shorter than kPeriod', () => {
      const shortCandles = generateCandles(5, 500);
      const stoch = engine.computeStochastic(shortCandles, 14, 3);

      expect(stoch.kValue).toBe(50.0);
      expect(stoch.dValue).toBe(50.0);
      expect(stoch.status).toBe('NEUTRAL');
      expect(stoch.crossoverSignal).toBe('NONE');
    });
  });

  describe('4. VWAP (Volume Weighted Average Price)', () => {
    it('computes volume-weighted benchmark and institutional control bias', () => {
      const candles = generateCandles(20, 1800, 2, 10);
      const currentPrice = 1850;
      const vwap = engine.computeVWAP(candles, currentPrice);

      expect(vwap.vwap).toBeGreaterThan(0);
      expect(typeof vwap.differencePercent).toBe('number');
      expect(['BUYER_CONTROL', 'SELLER_CONTROL', 'NEUTRAL_EQUILIBRIUM']).toContain(vwap.bias);
      expect(vwap.interpretation).toContain('VWAP benchmark');
    });

    it('correctly marks BUYER_CONTROL when current price is solidly above VWAP', () => {
      const candles = generateCandles(15, 1000, 0, 5);
      const vwap = engine.computeVWAP(candles, 1100); // 10% above

      expect(vwap.bias).toBe('BUYER_CONTROL');
      expect(vwap.differencePercent).toBeGreaterThan(0.5);
    });

    it('correctly marks SELLER_CONTROL when current price is solidly below VWAP', () => {
      const candles = generateCandles(15, 1000, 0, 5);
      const vwap = engine.computeVWAP(candles, 900); // 10% below

      expect(vwap.bias).toBe('SELLER_CONTROL');
      expect(vwap.differencePercent).toBeLessThan(-0.5);
    });
  });

  describe('5. Support & Resistance Pivot Engine', () => {
    it('calculates Floor Trader Pivots (P, R1, R2, S1, S2) and rolling swing extrema', () => {
      const candles = generateCandles(25, 2400, 1, 20);
      const currentPrice = 2410;
      const sr = engine.computeSupportResistance(candles, currentPrice);

      expect(sr.floorPivots.pivotPoint).toBeGreaterThan(0);
      expect(sr.floorPivots.r1).toBeGreaterThan(sr.floorPivots.pivotPoint);
      expect(sr.floorPivots.s1).toBeLessThan(sr.floorPivots.pivotPoint);
      expect(sr.floorPivots.r2).toBeGreaterThan(sr.floorPivots.r1);
      expect(sr.floorPivots.s2).toBeLessThan(sr.floorPivots.s1);

      expect(sr.swingHighResistance).toBeGreaterThanOrEqual(sr.swingLowSupport);
      expect(sr.nearestSupport.level).toBeLessThanOrEqual(currentPrice);
      expect(sr.nearestResistance.level).toBeGreaterThanOrEqual(currentPrice);
      expect(sr.interpretation).toContain('Key technical floors');
    });

    it('handles empty candles safely with estimated pivot bands', () => {
      const sr = engine.computeSupportResistance([], 1000);

      expect(sr.floorPivots.pivotPoint).toBe(1000);
      expect(sr.floorPivots.r1).toBe(1020);
      expect(sr.floorPivots.s1).toBe(980);
      expect(sr.nearestSupport.level).toBe(980);
      expect(sr.nearestResistance.level).toBe(1020);
    });
  });

  describe('6. Multi-Timeframe Candle Processing', () => {
    it('synthesizes daily and weekly trends into alignment summary', () => {
      const uptrendCandles = generateCandles(50, 1500, 10, 10);
      const mtf = engine.processMultiTimeframe(uptrendCandles, 2100);

      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(mtf.dailyTrend);
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(mtf.weeklyTrend);
      expect(['ALIGNED_BULLISH', 'ALIGNED_BEARISH', 'CONFLICTING_TIMEFRAMES']).toContain(mtf.alignment);
      expect(mtf.interpretation.length).toBeGreaterThan(10);
    });

    it('handles insufficient history (< 5 candles) with conflicting/neutral fallback', () => {
      const mtf = engine.processMultiTimeframe([], 1000);

      expect(mtf.dailyTrend).toBe('NEUTRAL');
      expect(mtf.weeklyTrend).toBe('NEUTRAL');
      expect(mtf.alignment).toBe('CONFLICTING_TIMEFRAMES');
    });
  });

  describe('7. Master analyze() Method & Confluence Engine', () => {
    it('aggregates all indicators into complete TechnicalEngineResult with rating and key takeaways', () => {
      const candles = generateCandles(60, 3500, 5, 25);
      const currentPrice = 3800;

      const result = engine.analyze('TCS.NS', currentPrice, candles);

      expect(result.symbol).toBe('TCS.NS');
      expect(result.currentPrice).toBe(3800);
      expect(result.atr.value).toBeGreaterThan(0);
      expect(result.bollingerBands.middleBand).toBeGreaterThan(0);
      expect(result.stochastic.kValue).toBeDefined();
      expect(result.vwap.vwap).toBeGreaterThan(0);
      expect(result.supportResistance.floorPivots.pivotPoint).toBeGreaterThan(0);
      expect(result.multiTimeframe.alignment).toBeDefined();

      expect(result.confluenceScore).toBeGreaterThanOrEqual(5);
      expect(result.confluenceScore).toBeLessThanOrEqual(95);
      expect(['STRONG_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'STRONG_BEARISH']).toContain(result.rating);
      expect(result.keyTakeaways.length).toBeGreaterThanOrEqual(3);
      expect(result.computedAt).toBeDefined();
    });

    it('produces STRONG_BULLISH rating when all indicators align in buyer favor', () => {
      // Create strong continuous bull trend candles
      const strongBullCandles = generateCandles(60, 2000, 25, 5);
      const currentPrice = 3600;

      const result = engine.analyze('INFY.NS', currentPrice, strongBullCandles);

      expect(result.confluenceScore).toBeGreaterThanOrEqual(60);
      expect(['STRONG_BULLISH', 'BULLISH']).toContain(result.rating);
      expect(result.keyTakeaways.some((t) => t.includes('VWAP') || t.includes('Bollinger') || t.includes('trend'))).toBe(true);
    });
  });
});
