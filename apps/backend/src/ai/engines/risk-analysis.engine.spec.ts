import { RiskAnalysisEngine } from './risk-analysis.engine';
import { StockPricePoint, StockFundamentals } from '@finpilot/shared-types';

describe('RiskAnalysisEngine', () => {
  let engine: RiskAnalysisEngine;

  beforeEach(() => {
    engine = new RiskAnalysisEngine();
  });

  // Helper to generate synthetic daily OHLCV series
  function generatePriceSeries(
    basePrice: number,
    dailyChanges: number[],
    startDate: string = '2025-01-01',
  ): StockPricePoint[] {
    const points: StockPricePoint[] = [];
    let current = basePrice;
    const start = new Date(startDate);

    for (let i = 0; i < dailyChanges.length; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const close = Number((current * (1 + dailyChanges[i])).toFixed(2));
      points.push({
        timestamp: d.toISOString(),
        open: current,
        high: Math.max(current, close) * 1.01,
        low: Math.min(current, close) * 0.99,
        close,
        volume: 100000,
      });
      current = close;
    }
    return points;
  }

  describe('calculateVolatility', () => {
    it('should compute annualized standard deviation of daily returns over 60 trading days', () => {
      // 60 days of small 1% swings
      const changes = Array(60)
        .fill(0)
        .map((_, i) => (i % 2 === 0 ? 0.01 : -0.01));
      const history = generatePriceSeries(1000, changes);

      const result = engine.calculateVolatility(history, 60);

      expect(result.windowDays).toBe(60);
      expect(result.dailyVolatilityPercent).toBeGreaterThan(0);
      expect(result.annualizedVolatilityPercent).toBeGreaterThan(0);
      // Daily std dev ~ 1%, annualized = 1% * sqrt(252) ≈ 15.87%
      expect(result.annualizedVolatilityPercent).toBeCloseTo(15.87, 0);
      expect(['LOW', 'MODERATE', 'HIGH', 'EXTREME']).toContain(result.interpretation);
    });

    it('should handle flat constant prices with 0% volatility', () => {
      const flatPoints = Array(35)
        .fill(0)
        .map((_, i) => ({
          timestamp: `2025-01-${String(i + 1).padStart(2, '0')}`,
          open: 100,
          high: 100,
          low: 100,
          close: 100,
          volume: 5000,
        }));

      const result = engine.calculateVolatility(flatPoints, 30);
      expect(result.dailyVolatilityPercent).toBe(0);
      expect(result.annualizedVolatilityPercent).toBe(0);
      expect(result.interpretation).toBe('LOW');
    });

    it('should return 0 volatility for insufficient price points (<2)', () => {
      const result = engine.calculateVolatility([], 60);
      expect(result.dailyVolatilityPercent).toBe(0);
      expect(result.annualizedVolatilityPercent).toBe(0);
    });
  });

  describe('calculateBeta', () => {
    it('should compute Beta = Cov(stock, benchmark) / Var(benchmark) accurately against NIFTY 50', () => {
      const days = 40;
      // Benchmark has 1% changes
      const benchChanges = Array(days)
        .fill(0)
        .map((_, i) => (i % 2 === 0 ? 0.01 : -0.01));
      // Stock moves 1.5x in same direction (Beta should be ~ 1.5)
      const stockChanges = benchChanges.map((c) => c * 1.5);

      const stockHistory = generatePriceSeries(2000, stockChanges);
      const benchHistory = generatePriceSeries(24000, benchChanges);

      const beta = engine.calculateBeta(stockHistory, benchHistory, 35);

      expect(beta.status).toBe('AVAILABLE');
      expect(beta.benchmarkSymbol).toBe('^NSEI');
      expect(beta.value).toBeCloseTo(1.5, 1);
      expect(beta.interpretation).toBe('AGGRESSIVE');
    });

    it('should return INSUFFICIENT_DATA when benchmark series is unavailable (null/undefined)', () => {
      const stockHistory = generatePriceSeries(1000, Array(40).fill(0.01));
      const beta = engine.calculateBeta(stockHistory, null, 60);

      expect(beta.status).toBe('INSUFFICIENT_DATA');
      expect(beta.value).toBeNull();
      expect(beta.reason).toContain('benchmark data unavailable');
    });

    it('should return INSUFFICIENT_DATA when overlapping history is under 30 days', () => {
      const stockHistory = generatePriceSeries(1000, Array(15).fill(0.01));
      const benchHistory = generatePriceSeries(24000, Array(15).fill(0.01));

      const beta = engine.calculateBeta(stockHistory, benchHistory, 60);

      expect(beta.status).toBe('INSUFFICIENT_DATA');
      expect(beta.value).toBeNull();
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should find largest peak-to-trough decline with actual dates and prices', () => {
      // Create series: 100 -> 150 (peak) -> 90 (trough, -40% dd) -> 120
      const history: StockPricePoint[] = [
        { timestamp: '2025-01-01', open: 100, high: 105, low: 95, close: 100, volume: 1000 },
        { timestamp: '2025-01-02', open: 100, high: 155, low: 100, close: 150, volume: 1000 }, // Peak
        { timestamp: '2025-01-03', open: 150, high: 150, low: 110, close: 110, volume: 1000 },
        { timestamp: '2025-01-04', open: 110, high: 110, low: 88, close: 90, volume: 1000 },   // Trough (-40%)
        { timestamp: '2025-01-05', open: 90, high: 125, low: 90, close: 120, volume: 1000 },
      ];

      const mdd = engine.calculateMaxDrawdown(history, 10);

      expect(mdd.status).toBe('AVAILABLE');
      expect(mdd.peakPrice).toBe(150);
      expect(mdd.peakDate).toBe('2025-01-02');
      expect(mdd.troughPrice).toBe(90);
      expect(mdd.troughDate).toBe('2025-01-04');
      expect(mdd.drawdownPercent).toBe(-40);
      expect(mdd.recoveryStatus).toBe('IN_DRAWDOWN');
    });

    it('should detect RECOVERED status if price re-attains or exceeds previous peak', () => {
      const history: StockPricePoint[] = [
        { timestamp: '2025-01-01', open: 100, high: 120, low: 100, close: 120, volume: 1000 },
        { timestamp: '2025-01-02', open: 120, high: 120, low: 96, close: 96, volume: 1000 }, // -20% dd
        { timestamp: '2025-01-03', open: 96, high: 130, low: 96, close: 125, volume: 1000 }, // New peak
      ];

      const mdd = engine.calculateMaxDrawdown(history, 10);
      expect(mdd.recoveryStatus).toBe('RECOVERED');
    });
  });

  describe('calculateVaR', () => {
    it('should calculate 95% Historical Simulation VaR from empirical daily return distribution', () => {
      // 40 daily returns with known negative tail: -5%, -4%, -3%, -2%, -1%, rest 0%
      const changes = [
        -0.05, -0.04, -0.03, -0.02, -0.01,
        ...Array(35).fill(0.005),
      ];
      const history = generatePriceSeries(1000, changes);

      const varResult = engine.calculateVaR(history, 1000, 40);

      expect(varResult.status).toBe('AVAILABLE');
      expect(varResult.method).toBe('HISTORICAL_SIMULATION');
      expect(varResult.methodDescription).toContain('Historical simulation');
      expect(varResult.confidenceLevelPercent).toBe(95);
      expect(varResult.varPercent).toBeGreaterThan(0);
      expect(varResult.varRupees).toBeGreaterThan(0);
    });

    it('should return INSUFFICIENT_DATA if history is under 15 days', () => {
      const history = generatePriceSeries(1000, [0.01, -0.01, 0.02]);
      const varResult = engine.calculateVaR(history, 1000, 10);

      expect(varResult.status).toBe('INSUFFICIENT_DATA');
      expect(varResult.varPercent).toBe(0);
    });
  });

  describe('calculateCompositeRiskScore', () => {
    it('should calculate transparent weighted composite score with fundamentals', () => {
      const vol = {
        windowDays: 60,
        dailyVolatilityPercent: 1.5,
        annualizedVolatilityPercent: 23.8,
        interpretation: 'MODERATE' as const,
      };
      const mdd = {
        drawdownPercent: -18.5,
        peakPrice: 1200,
        peakDate: '2025-01-10',
        troughPrice: 978,
        troughDate: '2025-02-15',
        recoveryStatus: 'IN_DRAWDOWN' as const,
        status: 'AVAILABLE' as const,
      };
      const funds: StockFundamentals = {
        peRatio: 28.5,
        debtToEquity: 0.1,
      };

      const score = engine.calculateCompositeRiskScore(vol, mdd, funds);

      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(score.components.volatilityScore).toBeGreaterThan(0);
      expect(score.components.drawdownScore).toBeGreaterThan(0);
      expect(score.components.valuationScore).toBeGreaterThan(0);
      expect(score.weightingFormula).toContain('35% weight');
      expect(score.disclaimer).toContain('do not represent a guarantee');
    });

    it('should re-weight to 50/50 when fundamentals/PE are missing', () => {
      const vol = {
        windowDays: 60,
        dailyVolatilityPercent: 2.0,
        annualizedVolatilityPercent: 31.7,
        interpretation: 'HIGH' as const,
      };
      const mdd = {
        drawdownPercent: -25.0,
        peakPrice: 1000,
        peakDate: '2025-01-01',
        troughPrice: 750,
        troughDate: '2025-01-20',
        recoveryStatus: 'IN_DRAWDOWN' as const,
        status: 'AVAILABLE' as const,
      };

      const score = engine.calculateCompositeRiskScore(vol, mdd, null);

      expect(score.components.valuationScore).toBe(0);
      expect(score.weightingFormula).toContain('50% weight');
    });

    it('should calibrate composite risk score specifically for crypto assets', () => {
      const vol = {
        windowDays: 60,
        dailyVolatilityPercent: 3.5,
        annualizedVolatilityPercent: 66.8, // 66.8% is MODERATE in crypto
        interpretation: 'MODERATE' as const,
      };
      const mdd = {
        drawdownPercent: -30.0,
        peakPrice: 8000000,
        peakDate: '2025-01-01',
        troughPrice: 5600000,
        troughDate: '2025-01-20',
        recoveryStatus: 'IN_DRAWDOWN' as const,
        status: 'AVAILABLE' as const,
      };

      const score = engine.calculateCompositeRiskScore(vol, mdd, null, true);

      expect(score.score).toBeGreaterThan(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(score.components.valuationScore).toBe(0);
      expect(score.weightingFormula).toContain('Cryptocurrency Composite Risk Score');
      expect(score.weightingFormula).toContain('100% cap');
    });
  });

  describe('Crypto Volatility & Benchmark Recalibration', () => {
    it('uses 365-day annualization factor and calibrated crypto thresholds', () => {
      // 60 days with 3% daily swings
      const changes = Array(60)
        .fill(0)
        .map((_, i) => (i % 2 === 0 ? 0.03 : -0.03));
      const history = generatePriceSeries(8000000, changes);

      const cryptoVol = engine.calculateVolatility(history, 60, true);
      const equityVol = engine.calculateVolatility(history, 60, false);

      // Crypto annualization uses sqrt(365) vs equity sqrt(252)
      expect(cryptoVol.annualizedVolatilityPercent).toBeGreaterThan(equityVol.annualizedVolatilityPercent);
      // For ~57% annualized volatility, equity would be EXTREME (>45%), but crypto is MODERATE (40-75%)
      expect(cryptoVol.interpretation).toBe('MODERATE');
      expect(equityVol.interpretation).toBe('EXTREME');
    });

    it('references Bitcoin (BTC) as the benchmark for crypto beta', () => {
      const btcSeries = generatePriceSeries(8000000, Array(40).fill(0.01));
      const solSeries = generatePriceSeries(16000, Array(40).fill(0.015));

      const beta = engine.calculateBeta(solSeries, btcSeries, 30, 'BTC', true);

      expect(beta.benchmarkSymbol).toBe('BTC');
      expect(beta.status).toBe('AVAILABLE');
      expect(beta.value).toBeDefined();
    });
  });
});
