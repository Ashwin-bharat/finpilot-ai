import { MarketStructureEngine } from './market-structure.engine';
import { StockPricePoint, SwingPoint } from '@finpilot/shared-types';

describe('MarketStructureEngine', () => {
  let engine: MarketStructureEngine;

  beforeEach(() => {
    engine = new MarketStructureEngine();
  });

  function generateCandles(
    count: number,
    startPrice: number,
    drift: number = 0,
    volatility: number = 10,
  ): StockPricePoint[] {
    const candles: StockPricePoint[] = [];
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      price = Math.max(10, price + drift + (i % 2 === 0 ? volatility : -volatility * 0.7));
      const open = Number((price - 2).toFixed(2));
      const close = Number((price + 2).toFixed(2));
      const high = Number((Math.max(open, close) + volatility).toFixed(2));
      const low = Number((Math.min(open, close) - volatility).toFixed(2));
      const volume = 150000 + i * 2000;

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

  describe('1. Fractal Swing Point Identification', () => {
    it('detects 5-candle fractal swing highs and lows and assigns HH/HL/LH/LL labels', () => {
      // Create a wave structure: up, peak, down, valley, up higher
      const candles: StockPricePoint[] = [
        { timestamp: '1', open: 100, high: 105, low: 95, close: 102, volume: 100 },
        { timestamp: '2', open: 102, high: 115, low: 100, close: 110, volume: 100 },
        { timestamp: '3', open: 110, high: 140, low: 108, close: 135, volume: 100 }, // Swing High at index 2 (high: 140)
        { timestamp: '4', open: 135, high: 125, low: 115, close: 120, volume: 100 },
        { timestamp: '5', open: 120, high: 118, low: 105, close: 112, volume: 100 },
        { timestamp: '6', open: 112, high: 110, low: 85, close: 90, volume: 100 },   // Swing Low at index 5 (low: 85)
        { timestamp: '7', open: 90, high: 115, low: 88, close: 110, volume: 100 },
        { timestamp: '8', open: 110, high: 125, low: 105, close: 122, volume: 100 },
      ];

      const swings = engine.identifySwingPoints(candles);

      expect(swings.length).toBeGreaterThanOrEqual(1);
      const swingHigh = swings.find((s) => s.type === 'SWING_HIGH');
      expect(swingHigh).toBeDefined();
      expect(swingHigh?.price).toBe(140);
      expect(swingHigh?.label).toBe('HH');
    });

    it('returns empty array if history has fewer than 5 candles', () => {
      const swings = engine.identifySwingPoints(generateCandles(4, 100));
      expect(swings).toEqual([]);
    });
  });

  describe('2. Trend Classification & Structure Shifts (BOS / CHoCH)', () => {
    it('classifies BULLISH_EXPANSION when price breaks above recent swing high', () => {
      const swings: SwingPoint[] = [
        { index: 2, timestamp: '1', type: 'SWING_HIGH', price: 1500, label: 'HH' },
        { index: 5, timestamp: '2', type: 'SWING_LOW', price: 1420, label: 'HL' },
        { index: 8, timestamp: '3', type: 'SWING_HIGH', price: 1580, label: 'HH' },
      ];

      const { trend, lastStructureShift } = engine.classifyTrendAndStructure(swings, 1600);

      expect(trend).toBe('BULLISH_EXPANSION');
      expect(lastStructureShift).toContain('Break of Structure');
    });

    it('classifies BEARISH_EXPANSION when price breaks below recent swing low', () => {
      const swings: SwingPoint[] = [
        { index: 2, timestamp: '1', type: 'SWING_HIGH', price: 1600, label: 'LH' },
        { index: 5, timestamp: '2', type: 'SWING_LOW', price: 1450, label: 'LL' },
        { index: 8, timestamp: '3', type: 'SWING_HIGH', price: 1520, label: 'LH' },
        { index: 11, timestamp: '4', type: 'SWING_LOW', price: 1400, label: 'LL' },
      ];

      const { trend, lastStructureShift } = engine.classifyTrendAndStructure(swings, 1380);

      expect(trend).toBe('BEARISH_EXPANSION');
      expect(lastStructureShift).toContain('Bearish Break of Structure');
    });
  });

  describe('3. Institutional Order Blocks', () => {
    it('identifies bullish demand order block before an aggressive impulse candle', () => {
      const candles: StockPricePoint[] = [
        { timestamp: '1', open: 100, high: 102, low: 98, close: 101, volume: 1000 },
        { timestamp: '2', open: 101, high: 103, low: 99, close: 100, volume: 1000 },
        { timestamp: '3', open: 100, high: 101, low: 97, close: 98, volume: 1000 },  // Bearish origin candle
        { timestamp: '4', open: 98, high: 125, low: 98, close: 124, volume: 5000 },   // Massive Bullish Impulse (body: 26)
        { timestamp: '5', open: 124, high: 126, low: 120, close: 125, volume: 2000 },
        { timestamp: '6', open: 125, high: 128, low: 122, close: 127, volume: 2000 },
      ];

      const obs = engine.detectOrderBlocks(candles, 127);

      expect(obs.length).toBeGreaterThanOrEqual(1);
      const demandOb = obs.find((o) => o.type === 'BULLISH_DEMAND');
      expect(demandOb).toBeDefined();
      expect(demandOb?.high).toBe(100); // max(open, close) of origin candle
      expect(demandOb?.mitigated).toBe(false); // Candles 4, 5, 6 stayed above 100
    });

    it('marks order block as mitigated when price later trades into its zone', () => {
      const candles: StockPricePoint[] = [
        { timestamp: '1', open: 100, high: 102, low: 98, close: 101, volume: 1000 },
        { timestamp: '2', open: 100, high: 101, low: 97, close: 98, volume: 1000 },  // Origin
        { timestamp: '3', open: 98, high: 125, low: 98, close: 124, volume: 5000 },   // Impulse
        { timestamp: '4', open: 124, high: 124, low: 99, close: 110, volume: 2000 },  // Dips to 99 (into OB zone 97-100)
      ];

      const obs = engine.detectOrderBlocks(candles, 110);
      const demandOb = obs.find((o) => o.type === 'BULLISH_DEMAND');
      expect(demandOb).toBeDefined();
      expect(demandOb?.mitigated).toBe(true);
    });
  });

  describe('4. Fair Value Gaps (FVG) / Imbalances', () => {
    it('detects 3-candle bullish fair value gap when Candle 3 low > Candle 1 high', () => {
      const candles: StockPricePoint[] = [
        { timestamp: '1', open: 100, high: 105, low: 98, close: 104, volume: 1000 }, // c1 high: 105
        { timestamp: '2', open: 104, high: 120, low: 104, close: 119, volume: 4000 },
        { timestamp: '3', open: 119, high: 125, low: 112, close: 124, volume: 2000 }, // c3 low: 112 > c1 high: 105
      ];

      const fvgs = engine.detectFairValueGaps(candles, 124);

      expect(fvgs.length).toBe(1);
      expect(fvgs[0].type).toBe('BULLISH_IMBALANCE');
      expect(fvgs[0].bottom).toBe(105);
      expect(fvgs[0].top).toBe(112);
      expect(fvgs[0].size).toBe(7);
      expect(fvgs[0].filled).toBe(false);
    });

    it('tracks filled FVG when subsequent candles rebalance the gap', () => {
      const candles: StockPricePoint[] = [
        { timestamp: '1', open: 100, high: 105, low: 98, close: 104, volume: 1000 },
        { timestamp: '2', open: 104, high: 120, low: 104, close: 119, volume: 4000 },
        { timestamp: '3', open: 119, high: 125, low: 112, close: 124, volume: 2000 },
        { timestamp: '4', open: 124, high: 124, low: 103, close: 106, volume: 3000 }, // Low drops to 103 (<= 105)
      ];

      const fvgs = engine.detectFairValueGaps(candles, 106);
      expect(fvgs[0].filled).toBe(true);
    });
  });

  describe('5. Liquidity Sweep Detection', () => {
    it('detects buyside liquidity sweep when wick probes above swing high and closes back below', () => {
      const swings: SwingPoint[] = [
        { index: 2, timestamp: '1', type: 'SWING_HIGH', price: 1500, label: 'HH' },
      ];

      const candles: StockPricePoint[] = [
        { timestamp: '1', open: 1480, high: 1495, low: 1475, close: 1490, volume: 100 },
        { timestamp: '2', open: 1490, high: 1515, low: 1485, close: 1488, volume: 300 }, // High: 1515 > 1500, Close: 1488 < 1500
      ];

      const sweeps = engine.detectLiquiditySweeps(candles, swings);

      expect(sweeps.length).toBeGreaterThanOrEqual(1);
      expect(sweeps[0].type).toBe('BUYSIDE_LIQUIDITY_SWEEP');
      expect(sweeps[0].sweepPrice).toBe(1515);
      expect(sweeps[0].swingPrice).toBe(1500);
      expect(sweeps[0].interpretation).toContain('Buyside liquidity sweep');
    });
  });

  describe('6. Dealing Range & Equilibrium (Premium vs. Discount)', () => {
    it('calculates 50% equilibrium and identifies DISCOUNT zone when price is below EQ', () => {
      const swings: SwingPoint[] = [
        { index: 5, timestamp: '1', type: 'SWING_HIGH', price: 2000, label: 'HH' },
        { index: 10, timestamp: '2', type: 'SWING_LOW', price: 1000, label: 'HL' },
      ];

      const currentPrice = 1300; // Range: 1000 - 2000, EQ: 1500. 1300 is 30% (DISCOUNT)
      const range = engine.calculateDealingRange(swings, [], currentPrice);

      expect(range.rangeHigh).toBe(2000);
      expect(range.rangeLow).toBe(1000);
      expect(range.equilibrium).toBe(1500);
      expect(range.currentZone).toBe('DISCOUNT');
      expect(range.relativePositionPercent).toBe(30.0);
      expect(range.optimalTradeEntry.fib618).toBe(1382.0); // 2000 - 0.618*1000
    });

    it('identifies PREMIUM zone when price is above EQ (> 53%)', () => {
      const swings: SwingPoint[] = [
        { index: 5, timestamp: '1', type: 'SWING_HIGH', price: 2000, label: 'HH' },
        { index: 10, timestamp: '2', type: 'SWING_LOW', price: 1000, label: 'HL' },
      ];

      const currentPrice = 1750; // 75% of range -> PREMIUM
      const range = engine.calculateDealingRange(swings, [], currentPrice);

      expect(range.currentZone).toBe('PREMIUM');
      expect(range.relativePositionPercent).toBe(75.0);
    });
  });

  describe('7. Master analyze() Method & Institutional SMC Synthesis', () => {
    it('aggregates all SMC components into complete MarketStructureResult', () => {
      const candles = generateCandles(60, 2400, 5, 20);
      const currentPrice = 2650;

      const result = engine.analyze('TCS.NS', currentPrice, candles);

      expect(result.symbol).toBe('TCS.NS');
      expect(result.currentPrice).toBe(2650);
      expect(['BULLISH_EXPANSION', 'BEARISH_EXPANSION', 'RANGE_ACCUMULATION', 'STRUCTURE_SHIFT_BULLISH', 'STRUCTURE_SHIFT_BEARISH']).toContain(result.trend);
      expect(Array.isArray(result.swingPoints)).toBe(true);
      expect(Array.isArray(result.orderBlocks)).toBe(true);
      expect(Array.isArray(result.activeOrderBlocks)).toBe(true);
      expect(Array.isArray(result.fairValueGaps)).toBe(true);
      expect(Array.isArray(result.unfilledFvgs)).toBe(true);
      expect(Array.isArray(result.liquiditySweeps)).toBe(true);
      expect(result.dealingRange.equilibrium).toBeGreaterThan(0);
      expect(['STRONG_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'STRONG_BEARISH']).toContain(result.structureRating);
      expect(result.institutionalNarrative).toContain('TCS.NS');
      expect(result.keyStructureTakeaways.length).toBeGreaterThanOrEqual(2);
      expect(result.computedAt).toBeDefined();
    });
  });
});
