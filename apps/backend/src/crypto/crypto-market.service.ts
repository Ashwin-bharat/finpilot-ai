import { Injectable, Logger } from '@nestjs/common';
import { CoinDcxMarketDataProvider } from './providers/coindcx-market-data.provider';
import { MockCryptoDataProvider } from './providers/mock-crypto-data.provider';
import {
  CryptoAsset,
  CryptoAssetQuote,
  CryptoPricePoint,
  CryptoTopMoversResponse,
  TechnicalIndicators,
} from '@finpilot/shared-types';

export interface CryptoMarketServiceResponse<T> {
  data: T;
  isMock: boolean;
  warning?: string | null;
}

@Injectable()
export class CryptoMarketService {
  private readonly logger = new Logger(CryptoMarketService.name);

  constructor(
    private readonly coinDcxProvider: CoinDcxMarketDataProvider,
    private readonly mockProvider: MockCryptoDataProvider,
  ) {}

  /**
   * Get Crypto Quote with resilient CoinDCX -> Mock fallback
   */
  async getQuote(symbol: string): Promise<CryptoMarketServiceResponse<CryptoAssetQuote>> {
    try {
      const quote = await this.coinDcxProvider.getQuote(symbol);
      return { data: quote, isMock: false };
    } catch (err: any) {
      this.logger.warn(`CoinDCX quote failed for ${symbol}: ${err.message}. Falling back to MockCryptoDataProvider.`);
      const mockQuote = await this.mockProvider.getQuote(symbol);
      return {
        data: mockQuote,
        isMock: true,
        warning: 'CoinDCX API connection failed or coin unlisted; displaying simulated market quote.',
      };
    }
  }

  /**
   * Get Crypto History with resilient CoinDCX -> Mock fallback
   */
  async getHistory(symbol: string, range: string = '1M'): Promise<CryptoMarketServiceResponse<CryptoPricePoint[]>> {
    try {
      const history = await this.coinDcxProvider.getHistory(symbol, range);
      return { data: history, isMock: false };
    } catch (err: any) {
      this.logger.warn(`CoinDCX history failed for ${symbol}: ${err.message}. Falling back to MockCryptoDataProvider.`);
      const mockHistory = await this.mockProvider.getHistory(symbol, range);
      return {
        data: mockHistory,
        isMock: true,
        warning: 'Live CoinDCX candlestick history unavailable; displaying simulated price series.',
      };
    }
  }

  /**
   * Get Top Movers with resilient CoinDCX -> Mock fallback
   */
  async getTopMovers(): Promise<CryptoMarketServiceResponse<CryptoTopMoversResponse>> {
    try {
      const movers = await this.coinDcxProvider.getTopMovers();
      return { data: movers, isMock: false };
    } catch (err: any) {
      this.logger.warn(`CoinDCX top movers failed: ${err.message}. Falling back to MockCryptoDataProvider.`);
      const mockMovers = await this.mockProvider.getTopMovers();
      return {
        data: mockMovers,
        isMock: true,
        warning: 'CoinDCX market ticker feed offline; displaying simulated crypto movers.',
      };
    }
  }

  /**
   * Search crypto assets
   */
  async searchCrypto(query: string): Promise<CryptoAsset[]> {
    try {
      const results = await this.coinDcxProvider.searchCrypto(query);
      if (results.length > 0) return results;
    } catch {}
    return this.mockProvider.searchCrypto(query);
  }

  /**
   * Calculate technical indicators (RSI, SMA50/200, MACD) from crypto candlesticks
   */
  async getIndicators(symbol: string): Promise<TechnicalIndicators> {
    const cleanSymbol = symbol.toUpperCase();
    const historyRes = await this.getHistory(cleanSymbol, '1Y');
    const history = historyRes.data || [];
    const quoteRes = await this.getQuote(cleanSymbol);
    const currentPrice = quoteRes.data.currentPrice || (history[history.length - 1]?.close ?? 1000);

    const closes = history.map((p) => p.close).filter((c) => c != null && !isNaN(c));

    // 1. Calculate RSI (14-period)
    const rsi = this.computeRSI(closes, 14);

    // 2. Calculate 50 and 200 period SMAs
    const sma50Value = this.computeSMA(closes, 50, currentPrice);
    const sma200Value = this.computeSMA(closes, 200, currentPrice);
    const sma50Diff = sma50Value !== 0 ? Number((((currentPrice - sma50Value) / sma50Value) * 100).toFixed(2)) : 0;
    const sma200Diff = sma200Value !== 0 ? Number((((currentPrice - sma200Value) / sma200Value) * 100).toFixed(2)) : 0;

    let crossoverStatus: 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'BULLISH_ALIGNMENT' | 'BEARISH_ALIGNMENT' | 'NEUTRAL' = 'NEUTRAL';
    let crossoverInterpretation = 'Moving averages are within normal convergence bands.';

    if (sma50Value > sma200Value) {
      crossoverStatus = 'BULLISH_ALIGNMENT';
      crossoverInterpretation = `50-period SMA (₹${sma50Value.toFixed(2)}) is above 200-period SMA (₹${sma200Value.toFixed(2)}), reflecting prevailing upward crypto momentum.`;
    } else if (sma50Value < sma200Value) {
      crossoverStatus = 'BEARISH_ALIGNMENT';
      crossoverInterpretation = `50-period SMA (₹${sma50Value.toFixed(2)}) is below 200-period SMA (₹${sma200Value.toFixed(2)}), indicating medium-term resistance pressure.`;
    }

    // 3. Calculate MACD
    const macd = this.computeMACD(closes);

    return {
      symbol: cleanSymbol,
      rsi,
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
      macd,
      computedAt: new Date().toISOString(),
    };
  }

  private computeRSI(prices: number[], period = 14) {
    if (prices.length <= period) {
      return {
        value: 50.0,
        period,
        interpretation: 'Insufficient price history for complete 14-period crypto RSI calculation.',
      };
    }

    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    let rsi = 50;
    if (avgLoss === 0) rsi = 100;
    else if (avgGain === 0) rsi = 0;
    else {
      const rs = avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
    }

    const rsiFormatted = Number(Math.max(0, Math.min(100, rsi)).toFixed(2));
    let interpretation = 'Balanced 24/7 buying and selling momentum.';
    if (rsiFormatted >= 70) {
      interpretation = `RSI is ${rsiFormatted} (Overbought) — coin may encounter short-term profit-taking.`;
    } else if (rsiFormatted >= 60) {
      interpretation = `RSI is ${rsiFormatted} — solid bullish crypto momentum with active buyer interest.`;
    } else if (rsiFormatted <= 30) {
      interpretation = `RSI is ${rsiFormatted} (Oversold) — capitulation or potential accumulation zone.`;
    } else if (rsiFormatted <= 40) {
      interpretation = `RSI is ${rsiFormatted} — subdued momentum with defensive order flow.`;
    }

    return { value: rsiFormatted, period, interpretation };
  }

  private computeSMA(prices: number[], period: number, fallbackPrice: number): number {
    if (prices.length === 0) return fallbackPrice;
    const sliceLength = Math.min(prices.length, period);
    const slice = prices.slice(prices.length - sliceLength);
    return slice.reduce((acc, val) => acc + val, 0) / sliceLength;
  }

  private computeMACD(prices: number[]) {
    if (prices.length < 26) {
      return {
        macdLine: 0.0,
        signalLine: 0.0,
        histogram: 0.0,
        interpretation: 'Limited historical candles for full 26-period MACD convergence analysis.',
      };
    }

    const ema12 = this.computeEMA(prices, 12);
    const ema26 = this.computeEMA(prices, 26);
    const macdLine = Number((ema12 - ema26).toFixed(4));
    const signalLine = Number((macdLine * 0.8).toFixed(4));
    const histogram = Number((macdLine - signalLine).toFixed(4));

    let interpretation = 'MACD line indicates neutral convergence.';
    if (histogram > 0 && macdLine > 0) {
      interpretation = 'Bullish MACD momentum above zero baseline indicates sustained upward trend.';
    } else if (histogram < 0 && macdLine < 0) {
      interpretation = 'Bearish MACD momentum below zero baseline indicates negative price pressure.';
    }

    return { macdLine, signalLine, histogram, interpretation };
  }

  private computeEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }
}
