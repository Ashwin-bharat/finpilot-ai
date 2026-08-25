import { Injectable, Logger } from '@nestjs/common';
import { Stock, StockPricePoint, MarketIndex, GainerLoserItem } from '@finpilot/shared-types';
import { MarketDataProvider, TopMoversResponse } from './market-data-provider.interface';
import { MockMarketDataProvider } from './mock-market-data.provider';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const SECTOR_MAP: Record<string, { name: string; sector: string; industry: string }> = {
  'TCS.NS': { name: 'Tata Consultancy Services Ltd.', sector: 'Information Technology', industry: 'IT Services' },
  'RELIANCE.NS': { name: 'Reliance Industries Ltd.', sector: 'Energy', industry: 'Oil & Gas / Retail' },
  'INFY.NS': { name: 'Infosys Limited', sector: 'Information Technology', industry: 'IT Services' },
  'HDFCBANK.NS': { name: 'HDFC Bank Ltd.', sector: 'Financial Services', industry: 'Private Bank' },
  'TATAMOTORS.NS': { name: 'Tata Motors Ltd.', sector: 'Automobile', industry: 'Automobiles' },
  'ICICIBANK.NS': { name: 'ICICI Bank Ltd.', sector: 'Financial Services', industry: 'Private Bank' },
  'SBIN.NS': { name: 'State Bank of India', sector: 'Financial Services', industry: 'Public Bank' },
  'BHARTIARTL.NS': { name: 'Bharti Airtel Ltd.', sector: 'Telecommunication', industry: 'Telecom Services' },
  'ITC.NS': { name: 'ITC Limited', sector: 'Consumer Goods', industry: 'FMCG' },
  'LT.NS': { name: 'Larsen & Toubro Ltd.', sector: 'Construction', industry: 'Engineering & Construction' },
};

@Injectable()
export class YahooMarketDataProvider implements MarketDataProvider {
  private readonly logger = new Logger(YahooMarketDataProvider.name);
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL
  private readonly REQUEST_TIMEOUT_MS = 4000; // 4 seconds timeout

  constructor(private readonly fallbackProvider: MockMarketDataProvider) {}

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCached<T>(key: string, data: T, ttlMs: number = this.CACHE_TTL_MS): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private async fetchWithTimeout(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Yahoo Finance API responded with HTTP status ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async getQuote(symbol: string): Promise<Stock> {
    const cacheKey = `quote:${symbol.toUpperCase()}`;
    const cached = this.getCached<Stock>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const data = await this.fetchWithTimeout(url);

      const result = data?.chart?.result?.[0];
      if (!result || !result.meta) {
        throw new Error(`No chart meta returned for symbol ${symbol}`);
      }

      const meta = result.meta;
      const currentPrice = meta.regularMarketPrice ?? meta.previousClose ?? 0;
      const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? currentPrice;
      const change = Number((currentPrice - previousClose).toFixed(2));
      const changePercent = previousClose !== 0 ? Number(((change / previousClose) * 100).toFixed(2)) : 0;

      const known = SECTOR_MAP[symbol.toUpperCase()];
      const stock: Stock = {
        id: symbol.toUpperCase(),
        symbol: symbol.toUpperCase(),
        name: known?.name || meta.shortName || meta.symbol || symbol,
        sector: known?.sector || 'Diversified',
        industry: known?.industry || 'General',
        exchange: meta.exchangeName || 'NSE',
        currency: meta.currency || 'INR',
        currentPrice,
        change,
        changePercent,
      };

      this.setCached(cacheKey, stock, 60 * 1000);
      return stock;
    } catch (err: any) {
      this.logger.warn(
        `YahooMarketDataProvider.getQuote failed for ${symbol}: ${err.message}. Falling back to MockMarketDataProvider.`,
      );
      return this.fallbackProvider.getQuote(symbol);
    }
  }

  async getHistory(symbol: string, range: string = '1m'): Promise<StockPricePoint[]> {
    const normalizedRange = range.toLowerCase();
    const cacheKey = `history:${symbol.toUpperCase()}:${normalizedRange}`;
    const cached = this.getCached<StockPricePoint[]>(cacheKey);
    if (cached) {
      return cached;
    }

    let yahooRange = '1mo';
    let interval = '1d';
    let ttlMs = 15 * 60 * 1000; // 15 mins default

    if (normalizedRange === '1d') {
      yahooRange = '1d';
      interval = '5m';
      ttlMs = 60 * 1000; // 60s for 1d
    } else if (normalizedRange === '1w') {
      yahooRange = '5d';
      interval = '15m';
      ttlMs = 5 * 60 * 1000; // 5m for 1w
    } else if (normalizedRange === '1m') {
      yahooRange = '1mo';
      interval = '1d';
      ttlMs = 15 * 60 * 1000; // 15m for 1m
    } else if (normalizedRange === '1y') {
      yahooRange = '1y';
      interval = '1d';
      ttlMs = 60 * 60 * 1000; // 1h for 1y
    } else if (normalizedRange === '5y') {
      yahooRange = '5y';
      interval = '1wk';
      ttlMs = 60 * 60 * 1000; // 1h for 5y
    }

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${yahooRange}`;
      const data = await this.fetchWithTimeout(url);

      const result = data?.chart?.result?.[0];
      if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
        throw new Error(`Invalid history structure for symbol ${symbol}`);
      }

      const timestamps: number[] = result.timestamp;
      const quote = result.indicators.quote[0];
      const points: StockPricePoint[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const close = quote.close?.[i];
        if (close != null && !isNaN(close)) {
          const d = new Date(timestamps[i] * 1000);
          const timestampStr = normalizedRange === '1d' || normalizedRange === '1w'
            ? d.toISOString()
            : d.toISOString().split('T')[0];

          points.push({
            timestamp: timestampStr,
            open: Number((quote.open?.[i] ?? close).toFixed(2)),
            high: Number((quote.high?.[i] ?? close).toFixed(2)),
            low: Number((quote.low?.[i] ?? close).toFixed(2)),
            close: Number(close.toFixed(2)),
            volume: Math.floor(quote.volume?.[i] ?? 100000),
          });
        }
      }

      if (points.length === 0) {
        throw new Error(`Empty history data points for symbol ${symbol}`);
      }

      this.setCached(cacheKey, points, ttlMs);
      return points;
    } catch (err: any) {
      this.logger.warn(
        `YahooMarketDataProvider.getHistory failed for ${symbol}: ${err.message}. Falling back to MockMarketDataProvider.`,
      );
      return this.fallbackProvider.getHistory(symbol, range);
    }
  }

  async getTopMovers(): Promise<TopMoversResponse> {
    const cacheKey = 'top_movers';
    const cached = this.getCached<TopMoversResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // 1. Fetch Key Market Indices
      const indexSymbols = [
        { symbol: '^NSEI', name: 'NIFTY 50' },
        { symbol: '^BSESN', name: 'SENSEX' },
        { symbol: '^NSEBANK', name: 'BANK NIFTY' },
        { symbol: '^CNXIT', name: 'NIFTY IT' },
      ];

      const indices: MarketIndex[] = await Promise.all(
        indexSymbols.map(async ({ symbol, name }) => {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
            const data = await this.fetchWithTimeout(url);
            const meta = data?.chart?.result?.[0]?.meta;
            if (!meta) throw new Error('No index meta');

            const current = meta.regularMarketPrice ?? meta.previousClose ?? 0;
            const prev = meta.chartPreviousClose ?? meta.previousClose ?? current;
            const changeVal = Number((current - prev).toFixed(2));
            const changePct = prev !== 0 ? Number(((changeVal / prev) * 100).toFixed(2)) : 0;
            const isPositive = changeVal >= 0;

            return {
              name,
              value: current.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
              change: `${isPositive ? '+' : ''}${changeVal.toFixed(2)}`,
              percent: `${isPositive ? '+' : ''}${changePct.toFixed(2)}%`,
              isPositive,
            };
          } catch {
            return {
              name,
              value: '24,835.40',
              change: '+142.30',
              percent: '+0.58%',
              isPositive: true,
            };
          }
        }),
      );

      // 2. Fetch Stock Basket for Gainers / Losers
      const stockSymbols = [
        'TATAMOTORS.NS',
        'HDFCBANK.NS',
        'INFY.NS',
        'RELIANCE.NS',
        'TCS.NS',
        'ICICIBANK.NS',
        'SBIN.NS',
        'BHARTIARTL.NS',
        'ITC.NS',
        'LT.NS',
      ];

      const stockQuotes = await Promise.all(
        stockSymbols.map(async (sym) => {
          try {
            return await this.getQuote(sym);
          } catch {
            return null;
          }
        }),
      );

      const validStocks = stockQuotes.filter((s): s is Stock => s !== null && s.currentPrice !== undefined);

      const sortedByChange = [...validStocks].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));

      const gainers: GainerLoserItem[] = sortedByChange
        .filter((s) => (s.changePercent ?? 0) >= 0)
        .slice(0, 3)
        .map((s) => ({
          symbol: s.symbol,
          name: s.name,
          price: s.currentPrice || 0,
          changePercent: s.changePercent || 0,
        }));

      const losers: GainerLoserItem[] = [...sortedByChange]
        .reverse()
        .filter((s) => (s.changePercent ?? 0) < 0)
        .slice(0, 3)
        .map((s) => ({
          symbol: s.symbol,
          name: s.name,
          price: s.currentPrice || 0,
          changePercent: s.changePercent || 0,
        }));

      const response: TopMoversResponse = {
        indices,
        gainers: gainers.length > 0 ? gainers : (await this.fallbackProvider.getTopMovers()).gainers,
        losers: losers.length > 0 ? losers : (await this.fallbackProvider.getTopMovers()).losers,
      };

      this.setCached(cacheKey, response);
      return response;
    } catch (err: any) {
      this.logger.warn(
        `YahooMarketDataProvider.getTopMovers failed: ${err.message}. Falling back to MockMarketDataProvider.`,
      );
      return this.fallbackProvider.getTopMovers();
    }
  }
}
