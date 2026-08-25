import { Test, TestingModule } from '@nestjs/testing';
import { IndicatorsService } from './indicators.service';
import { MARKET_DATA_PROVIDER } from './providers/market-data-provider.interface';

describe('IndicatorsService - Technical Analysis Unit Tests', () => {
  let service: IndicatorsService;
  let mockMarketDataProvider: any;

  beforeEach(async () => {
    mockMarketDataProvider = {
      getQuote: jest.fn(),
      getHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndicatorsService,
        {
          provide: MARKET_DATA_PROVIDER,
          useValue: mockMarketDataProvider,
        },
      ],
    }).compile();

    service = module.get<IndicatorsService>(IndicatorsService);
  });

  describe('1. RSI-14 Calculation', () => {
    it('should compute exact 14-period RSI value on a verifiable reference dataset', async () => {
      // 15 prices giving 14 changes: 10 gains of 2.0 and 4 losses of 1.0
      // avgGain = 20/14, avgLoss = 4/14 => RS = 5 => RSI = 100 - (100 / 6) = 83.33
      const knownPrices = [
        100, 102, 101, 103, 105, 104, 106, 108, 107, 109, 111, 110, 112, 114, 116,
      ];

      mockMarketDataProvider.getQuote.mockResolvedValue({
        symbol: 'TEST.NS',
        currentPrice: 116,
      });
      mockMarketDataProvider.getHistory.mockResolvedValue(
        knownPrices.map((close, i) => ({
          timestamp: `2026-01-${i + 1}`,
          open: close,
          high: close,
          low: close,
          close,
          volume: 1000,
        })),
      );

      const result = await service.calculateIndicators('TEST.NS');

      expect(result.rsi.value).toBe(83.33);
      expect(result.rsi.period).toBe(14);
      expect(result.rsi.interpretation).toContain('overbought territory');
    });

    it('should return neutral 50.0 RSI when price history is equal to or less than 14 periods', async () => {
      const shortHistory = Array.from({ length: 10 }, (_, i) => 100 + i);

      mockMarketDataProvider.getQuote.mockResolvedValue({
        symbol: 'SHORT.NS',
        currentPrice: 110,
      });
      mockMarketDataProvider.getHistory.mockResolvedValue(
        shortHistory.map((close, i) => ({
          timestamp: `2026-01-${i + 1}`,
          open: close,
          high: close,
          low: close,
          close,
          volume: 1000,
        })),
      );

      const result = await service.calculateIndicators('SHORT.NS');

      expect(result.rsi.value).toBe(50.0);
      expect(result.rsi.interpretation).toContain('Insufficient price history');
    });
  });

  describe('2. SMA-50 and SMA-200 Calculation', () => {
    it('should compute precise 50-day and 200-day Simple Moving Averages on fixed datasets', async () => {
      // Create 200 sequential price points [1..200]
      const priceSeries200 = Array.from({ length: 200 }, (_, i) => i + 1);

      mockMarketDataProvider.getQuote.mockResolvedValue({
        symbol: 'SMA.NS',
        currentPrice: 200,
      });
      mockMarketDataProvider.getHistory.mockResolvedValue(
        priceSeries200.map((close, i) => ({
          timestamp: `2026-01-${i + 1}`,
          open: close,
          high: close,
          low: close,
          close,
          volume: 1000,
        })),
      );

      const result = await service.calculateIndicators('SMA.NS');

      // Latest 50 points: [151..200]. Average = (151 + 200)/2 = 175.50
      expect(result.sma50.value).toBe(175.5);

      // Latest 200 points: [1..200]. Average = (1 + 200)/2 = 100.50
      expect(result.sma200.value).toBe(100.5);

      // Crossover status: SMA50 (175.5) > SMA200 (100.5) => BULLISH_ALIGNMENT
      expect(result.maCrossover.status).toBe('BULLISH_ALIGNMENT');
    });

    it('should gracefully handle dataset with fewer than 50 data points by averaging available points', async () => {
      const smallSeries = [10, 20, 30, 40, 50]; // average = 30

      mockMarketDataProvider.getQuote.mockResolvedValue({
        symbol: 'SMALL.NS',
        currentPrice: 50,
      });
      mockMarketDataProvider.getHistory.mockResolvedValue(
        smallSeries.map((close, i) => ({
          timestamp: `2026-01-${i + 1}`,
          open: close,
          high: close,
          low: close,
          close,
          volume: 1000,
        })),
      );

      const result = await service.calculateIndicators('SMALL.NS');

      expect(result.sma50.value).toBe(30);
      expect(result.sma200.value).toBe(30);
      expect(result.sma50.differencePercent).toBe(66.67); // (50 - 30) / 30 * 100
    });
  });

  describe('3. MACD Calculation', () => {
    it('should compute MACD line, signal line, and ensure histogram equals (macdLine - signalLine)', async () => {
      // 35 price points to satisfy > 26 period requirement for MACD
      const priceSeries35 = Array.from({ length: 35 }, (_, i) => 100 + (i % 5) * 2 - i * 0.5);

      mockMarketDataProvider.getQuote.mockResolvedValue({
        symbol: 'MACD.NS',
        currentPrice: priceSeries35[priceSeries35.length - 1],
      });
      mockMarketDataProvider.getHistory.mockResolvedValue(
        priceSeries35.map((close, i) => ({
          timestamp: `2026-01-${i + 1}`,
          open: close,
          high: close,
          low: close,
          close,
          volume: 1000,
        })),
      );

      const result = await service.calculateIndicators('MACD.NS');

      expect(result.macd).toBeDefined();
      expect(typeof result.macd.macdLine).toBe('number');
      expect(typeof result.macd.signalLine).toBe('number');
      expect(typeof result.macd.histogram).toBe('number');

      // Verify mathematical relationship: histogram = macdLine - signalLine
      const calculatedHistogram = Number((result.macd.macdLine - result.macd.signalLine).toFixed(2));
      expect(result.macd.histogram).toBe(calculatedHistogram);
    });

    it('should return zeroed MACD metrics when historical data points are fewer than 26', async () => {
      const priceSeries20 = Array.from({ length: 20 }, (_, i) => 100 + i);

      mockMarketDataProvider.getQuote.mockResolvedValue({
        symbol: 'SHORTMACD.NS',
        currentPrice: 120,
      });
      mockMarketDataProvider.getHistory.mockResolvedValue(
        priceSeries20.map((close, i) => ({
          timestamp: `2026-01-${i + 1}`,
          open: close,
          high: close,
          low: close,
          close,
          volume: 1000,
        })),
      );

      const result = await service.calculateIndicators('SHORTMACD.NS');

      expect(result.macd.macdLine).toBe(0.0);
      expect(result.macd.signalLine).toBe(0.0);
      expect(result.macd.histogram).toBe(0.0);
      expect(result.macd.interpretation).toContain('Limited historical data');
    });
  });
});
