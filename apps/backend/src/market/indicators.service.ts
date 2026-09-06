import { Inject, Injectable, Logger } from '@nestjs/common';
import { TechnicalIndicators, StockPricePoint } from '@finpilot/shared-types';
import { MARKET_DATA_PROVIDER, MarketDataProvider } from './providers/market-data-provider.interface';

@Injectable()
export class IndicatorsService {
  private readonly logger = new Logger(IndicatorsService.name);

  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly marketDataProvider: MarketDataProvider,
  ) {}

  async calculateIndicators(
    symbol: string,
    providedHistory?: StockPricePoint[],
    providedCurrentPrice?: number,
  ): Promise<TechnicalIndicators> {
    const cleanSymbol = symbol.toUpperCase();

    // Use provided snapshot if available to guarantee consistent OHLCV data across engines in a single query;
    // otherwise fetch quote and 1-year history from the market data provider.
    const [quote, history] = await Promise.all([
      providedCurrentPrice !== undefined
        ? Promise.resolve({ currentPrice: providedCurrentPrice })
        : this.marketDataProvider.getQuote(cleanSymbol),
      providedHistory !== undefined
        ? Promise.resolve(providedHistory)
        : this.marketDataProvider.getHistory(cleanSymbol, '1y'),
    ]);

    const currentPrice = quote.currentPrice || 1000;
    const closes = history.map((p) => p.close).filter((c) => c != null && !isNaN(c));

    // 1. Calculate RSI (14-period)
    const rsiResult = this.computeRSI(closes, 14);

    // 2. Calculate 50-day and 200-day SMAs
    const sma50Value = this.computeSMA(closes, 50, currentPrice);
    const sma200Value = this.computeSMA(closes, 200, currentPrice);

    const sma50Diff = sma50Value !== 0 ? Number((((currentPrice - sma50Value) / sma50Value) * 100).toFixed(2)) : 0;
    const sma200Diff = sma200Value !== 0 ? Number((((currentPrice - sma200Value) / sma200Value) * 100).toFixed(2)) : 0;

    // Moving average crossover assessment
    let crossoverStatus: 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'BULLISH_ALIGNMENT' | 'BEARISH_ALIGNMENT' | 'NEUTRAL' = 'NEUTRAL';
    let crossoverInterpretation = 'Moving averages are within normal convergence bands.';

    if (sma50Value > sma200Value) {
      crossoverStatus = 'BULLISH_ALIGNMENT';
      crossoverInterpretation = `50-day SMA (₹${sma50Value.toFixed(2)}) is above 200-day SMA (₹${sma200Value.toFixed(2)}), reflecting prevailing upward trend support.`;
    } else if (sma50Value < sma200Value) {
      crossoverStatus = 'BEARISH_ALIGNMENT';
      crossoverInterpretation = `50-day SMA (₹${sma50Value.toFixed(2)}) is below 200-day SMA (₹${sma200Value.toFixed(2)}), indicating medium-term resistance pressure.`;
    }

    // 3. Calculate MACD (12, 26, 9)
    const macdResult = this.computeMACD(closes);

    return {
      symbol: cleanSymbol,
      rsi: rsiResult,
      sma50: {
        value: Number(sma50Value.toFixed(2)),
        differencePercent: sma50Diff,
      },
      sma200: {
        value: Number(sma200Value.toFixed(2)),
        differencePercent: sma200Diff,
      },
      maCrossover: {
        status: crossoverStatus,
        interpretation: crossoverInterpretation,
      },
      macd: macdResult,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Compute 14-period RSI using Wilder's smoothing technique
   */
  private computeRSI(prices: number[], period: number = 14): { value: number; period: number; interpretation: string } {
    if (prices.length <= period) {
      return {
        value: 50.0,
        period,
        interpretation: 'Insufficient price history for complete 14-period RSI calculation (Neutral estimate).',
      };
    }

    let gains = 0;
    let losses = 0;

    // First period change calculation
    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) {
        gains += diff;
      } else {
        losses += Math.abs(diff);
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Smoothed average for subsequent periods
    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    let rsi = 50;
    if (avgLoss === 0) {
      rsi = 100;
    } else if (avgGain === 0) {
      rsi = 0;
    } else {
      const rs = avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
    }

    const rsiFormatted = Number(Math.max(0, Math.min(100, rsi)).toFixed(2));

    let interpretation = 'Neutral momentum with balanced buying and selling pressure.';
    if (rsiFormatted >= 70) {
      interpretation = `RSI is ${rsiFormatted} (Above 70) — approaching overbought territory; price may encounter short-term resistance.`;
    } else if (rsiFormatted >= 60) {
      interpretation = `RSI is ${rsiFormatted} — solid bullish momentum with active buyer interest.`;
    } else if (rsiFormatted <= 30) {
      interpretation = `RSI is ${rsiFormatted} (Below 30) — deeply oversold territory; selling momentum may be decelerating.`;
    } else if (rsiFormatted <= 40) {
      interpretation = `RSI is ${rsiFormatted} — subdued momentum with cautious market participation.`;
    }

    return {
      value: rsiFormatted,
      period,
      interpretation,
    };
  }

  /**
   * Compute Simple Moving Average (SMA)
   */
  private computeSMA(prices: number[], period: number, fallbackPrice: number): number {
    if (prices.length === 0) return fallbackPrice;

    const sliceLength = Math.min(prices.length, period);
    const slice = prices.slice(prices.length - sliceLength);
    const sum = slice.reduce((acc, val) => acc + val, 0);

    return sum / sliceLength;
  }

  /**
   * Compute MACD (12, 26, 9)
   */
  private computeMACD(prices: number[]): { macdLine: number; signalLine: number; histogram: number; interpretation: string } {
    if (prices.length < 26) {
      return {
        macdLine: 0.0,
        signalLine: 0.0,
        histogram: 0.0,
        interpretation: 'Limited historical data for full 26-period MACD convergence analysis.',
      };
    }

    const ema12Series = this.computeEMASeries(prices, 12);
    const ema26Series = this.computeEMASeries(prices, 26);

    // MACD line is difference between EMA 12 and EMA 26
    const macdSeries: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      macdSeries.push(ema12Series[i] - ema26Series[i]);
    }

    // Signal line is 9-period EMA of the MACD series
    const signalSeries = this.computeEMASeries(macdSeries, 9);

    const latestMacd = macdSeries[macdSeries.length - 1];
    const latestSignal = signalSeries[signalSeries.length - 1];
    const latestHistogram = latestMacd - latestSignal;

    const macdLine = Number(latestMacd.toFixed(2));
    const signalLine = Number(latestSignal.toFixed(2));
    const histogram = Number(latestHistogram.toFixed(2));

    let interpretation = 'MACD and signal lines are converging near equilibrium.';
    if (histogram > 0) {
      interpretation = `MACD histogram is +${histogram} (Bullish momentum) — short-term moving average expanding above long-term trend.`;
    } else if (histogram < 0) {
      interpretation = `MACD histogram is ${histogram} (Bearish momentum) — short-term moving average contracting below long-term trend.`;
    }

    return {
      macdLine,
      signalLine,
      histogram,
      interpretation,
    };
  }

  /**
   * Helper to compute Exponential Moving Average (EMA) series
   */
  private computeEMASeries(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray: number[] = [];

    // Initialize with SMA for first `period` points
    let initialSum = 0;
    const initialCount = Math.min(values.length, period);
    for (let i = 0; i < initialCount; i++) {
      initialSum += values[i];
      emaArray.push(initialSum / (i + 1));
    }

    let prevEma = emaArray[emaArray.length - 1];
    for (let i = period; i < values.length; i++) {
      const currentEma = values[i] * k + prevEma * (1 - k);
      emaArray.push(currentEma);
      prevEma = currentEma;
    }

    return emaArray;
  }
}
