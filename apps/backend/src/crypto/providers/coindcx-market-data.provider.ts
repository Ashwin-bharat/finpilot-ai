import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoDataProvider } from './crypto-data-provider.interface';
import {
  CryptoAsset,
  CryptoAssetQuote,
  CryptoPricePoint,
  CryptoTopMoversResponse,
  MarketIndex,
  GainerLoserItem,
} from '@finpilot/shared-types';

interface CoinDcxTickerItem {
  market: string;
  change_24_hour?: string;
  high?: string;
  low?: string;
  volume?: string;
  last_price?: string;
  bid?: string;
  ask?: string;
  timestamp?: number;
}

interface CoinDcxCandleItem {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

@Injectable()
export class CoinDcxMarketDataProvider implements CryptoDataProvider {
  private readonly logger = new Logger(CoinDcxMarketDataProvider.name);
  private cachedTickers: CoinDcxTickerItem[] = [];
  private lastTickerFetchTime = 0;
  private readonly TICKER_CACHE_TTL_MS = 15000; // 15s cache to prevent rate limiting

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch all CoinDCX tickers (with short 15-second TTL cache)
   */
  private async fetchTickers(): Promise<CoinDcxTickerItem[]> {
    const now = Date.now();
    if (this.cachedTickers.length > 0 && now - this.lastTickerFetchTime < this.TICKER_CACHE_TTL_MS) {
      return this.cachedTickers;
    }

    try {
      const res = await fetch('https://api.coindcx.com/exchange/ticker', {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`CoinDCX ticker API returned status ${res.status}`);
      }
      const data: CoinDcxTickerItem[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        this.cachedTickers = data;
        this.lastTickerFetchTime = now;
        return data;
      }
      throw new Error('CoinDCX ticker response was empty or invalid format');
    } catch (err: any) {
      this.logger.error(`Failed to fetch CoinDCX tickers: ${err.message}`);
      if (this.cachedTickers.length > 0) {
        return this.cachedTickers;
      }
      throw err;
    }
  }

  /**
   * Find ticker for symbol, prioritizing INR pairs (e.g. BTCINR) then USDT pairs (e.g. BTCUSDT)
   */
  private findTickerForSymbol(tickers: CoinDcxTickerItem[], rawSymbol: string): { ticker: CoinDcxTickerItem | null; currency: string } {
    const cleanSym = rawSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // 1. Try INR pair
    const inrMarket = `${cleanSym}INR`;
    const inrTicker = tickers.find((t) => t.market.toUpperCase() === inrMarket);
    if (inrTicker) {
      return { ticker: inrTicker, currency: 'INR' };
    }

    // 2. Try USDT pair
    const usdtMarket = `${cleanSym}USDT`;
    const usdtTicker = tickers.find((t) => t.market.toUpperCase() === usdtMarket);
    if (usdtTicker) {
      return { ticker: usdtTicker, currency: 'USDT' };
    }

    // 3. Substring match if exact match not found
    const loose = tickers.find(
      (t) =>
        t.market.toUpperCase().startsWith(cleanSym) &&
        (t.market.toUpperCase().endsWith('INR') || t.market.toUpperCase().endsWith('USDT')),
    );
    if (loose) {
      const curr = loose.market.toUpperCase().endsWith('INR') ? 'INR' : 'USDT';
      return { ticker: loose, currency: curr };
    }

    return { ticker: null, currency: 'INR' };
  }

  async getQuote(symbol: string): Promise<CryptoAssetQuote> {
    const cleanSymbol = symbol.toUpperCase().trim();
    const [tickers, assetRecord] = await Promise.all([
      this.fetchTickers(),
      this.prisma.cryptoAsset.findUnique({ where: { symbol: cleanSymbol } }),
    ]);

    const { ticker, currency } = this.findTickerForSymbol(tickers, cleanSymbol);
    if (!ticker) {
      throw new Error(`Market quote for crypto asset ${cleanSymbol} not available on CoinDCX`);
    }

    const currentPrice = parseFloat(ticker.last_price || '0');
    const changePercent = parseFloat(ticker.change_24_hour || '0');
    const high24h = parseFloat(ticker.high || '0');
    const low24h = parseFloat(ticker.low || '0');
    const volume24h = parseFloat(ticker.volume || '0');
    const bid = ticker.bid ? parseFloat(ticker.bid) : undefined;
    const ask = ticker.ask ? parseFloat(ticker.ask) : undefined;

    // Approximate change in price currency
    const change = currentPrice * (changePercent / 100);

    return {
      id: assetRecord?.id || cleanSymbol,
      symbol: cleanSymbol,
      name: assetRecord?.name || cleanSymbol,
      category: assetRecord?.category || 'Cryptocurrency',
      currentPrice: Number(currentPrice.toFixed(currentPrice < 10 ? 4 : 2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      high24h,
      low24h,
      volume24h,
      bid,
      ask,
      timestamp: ticker.timestamp ? ticker.timestamp * 1000 : Date.now(),
    };
  }

  async getHistory(symbol: string, range: string = '1M'): Promise<CryptoPricePoint[]> {
    const cleanSymbol = symbol.toUpperCase().trim();

    // Map range to interval & limit
    let interval = '1d';
    let limit = 30;

    switch (range.toUpperCase()) {
      case '1D':
        interval = '5m';
        limit = 288;
        break;
      case '1W':
        interval = '1h';
        limit = 168;
        break;
      case '1M':
        interval = '1d';
        limit = 30;
        break;
      case '1Y':
        interval = '1d';
        limit = 365;
        break;
      case '5Y':
        interval = '1d';
        limit = 1000;
        break;
      default:
        interval = '1d';
        limit = 60;
        break;
    }

    // Try INR pair candle endpoint first (e.g. I-BTC_INR)
    const inrPair = `I-${cleanSymbol}_INR`;
    const usdtPair = `B-${cleanSymbol}_USDT`;

    let candles: CoinDcxCandleItem[] | null = null;

    try {
      const url = `https://public.coindcx.com/market_data/candles?pair=${inrPair}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          candles = data;
        }
      }
    } catch {
      // Fallback to USDT pair
    }

    if (!candles) {
      try {
        const url = `https://public.coindcx.com/market_data/candles?pair=${usdtPair}&interval=${interval}&limit=${limit}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            candles = data;
          }
        }
      } catch (err: any) {
        this.logger.warn(`USDT candle fetch error for ${cleanSymbol}: ${err.message}`);
      }
    }

    if (!candles || candles.length === 0) {
      throw new Error(`No historical candle data found for crypto asset ${cleanSymbol}`);
    }

    // CoinDCX returns candles descending (latest first). We sort ascending (oldest first).
    const sorted = [...candles].sort((a, b) => a.time - b.time);

    return sorted.map((c) => ({
      timestamp: new Date(c.time).toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  async getTopMovers(): Promise<CryptoTopMoversResponse> {
    const [tickers, assets] = await Promise.all([
      this.fetchTickers(),
      this.prisma.cryptoAsset.findMany(),
    ]);

    const assetMap = new Map(assets.map((a) => [a.symbol.toUpperCase(), a]));

    // Match tickers to verified assets in our database
    const mappedCoins: CryptoAsset[] = [];

    for (const asset of assets) {
      const { ticker } = this.findTickerForSymbol(tickers, asset.symbol);
      if (ticker) {
        const currentPrice = parseFloat(ticker.last_price || '0');
        const changePercent = parseFloat(ticker.change_24_hour || '0');
        const change = currentPrice * (changePercent / 100);
        mappedCoins.push({
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          category: asset.category,
          currentPrice: Number(currentPrice.toFixed(currentPrice < 10 ? 4 : 2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          high24h: parseFloat(ticker.high || '0'),
          low24h: parseFloat(ticker.low || '0'),
          volume24h: parseFloat(ticker.volume || '0'),
        });
      }
    }

    // Benchmark Indices (Key coins representing major crypto sectors)
    const keyCoins = ['BTC', 'ETH', 'SOL', 'BNB'];
    const indices: MarketIndex[] = keyCoins
      .map((sym) => {
        const coin = mappedCoins.find((c) => c.symbol === sym);
        if (!coin || coin.currentPrice == null) return null;
        const isPos = (coin.changePercent || 0) >= 0;
        return {
          name: `${coin.symbol} / INR`,
          value: `₹${coin.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          change: `${isPos ? '+' : ''}₹${Math.abs(coin.change || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          percent: `${isPos ? '+' : ''}${(coin.changePercent || 0).toFixed(2)}%`,
          isPositive: isPos,
        };
      })
      .filter((x): x is MarketIndex => x !== null);

    // Sort by changePercent
    const sortedByChange = [...mappedCoins].sort(
      (a, b) => (b.changePercent || 0) - (a.changePercent || 0),
    );

    const gainers: GainerLoserItem[] = sortedByChange
      .filter((c) => (c.changePercent || 0) > 0)
      .slice(0, 5)
      .map((c) => ({
        symbol: c.symbol,
        name: c.name,
        price: c.currentPrice || 0,
        changePercent: c.changePercent || 0,
      }));

    const losers: GainerLoserItem[] = [...sortedByChange]
      .reverse()
      .filter((c) => (c.changePercent || 0) < 0)
      .slice(0, 5)
      .map((c) => ({
        symbol: c.symbol,
        name: c.name,
        price: c.currentPrice || 0,
        changePercent: c.changePercent || 0,
      }));

    return {
      indices,
      gainers,
      losers,
      topCoins: mappedCoins.slice(0, 20),
    };
  }

  async searchCrypto(query: string): Promise<CryptoAsset[]> {
    const q = query.trim().toUpperCase();
    if (!q) return [];

    const matched = await this.prisma.cryptoAsset.findMany({
      where: {
        OR: [
          { symbol: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
    });

    return matched.map((m) => ({
      id: m.id,
      symbol: m.symbol,
      name: m.name,
      category: m.category,
    }));
  }
}
