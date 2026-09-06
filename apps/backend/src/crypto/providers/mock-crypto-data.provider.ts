import { Injectable } from '@nestjs/common';
import { CryptoDataProvider } from './crypto-data-provider.interface';
import {
  CryptoAsset,
  CryptoAssetQuote,
  CryptoPricePoint,
  CryptoTopMoversResponse,
  MarketIndex,
  GainerLoserItem,
} from '@finpilot/shared-types';

interface BaselineCoin {
  symbol: string;
  name: string;
  category: string;
  basePriceInr: number;
  changePercent: number;
}

const BASELINE_COINS: BaselineCoin[] = [
  { symbol: 'BTC', name: 'Bitcoin', category: 'Layer 1', basePriceInr: 7950000, changePercent: 1.45 },
  { symbol: 'ETH', name: 'Ethereum', category: 'Layer 1', basePriceInr: 252000, changePercent: -0.82 },
  { symbol: 'SOL', name: 'Solana', category: 'Layer 1', basePriceInr: 16800, changePercent: 3.25 },
  { symbol: 'BNB', name: 'BNB', category: 'Layer 1', basePriceInr: 54500, changePercent: 0.40 },
  { symbol: 'XRP', name: 'XRP', category: 'Payment / Settlement', basePriceInr: 195, changePercent: -1.15 },
  { symbol: 'ADA', name: 'Cardano', category: 'Layer 1', basePriceInr: 68, changePercent: 2.10 },
  { symbol: 'DOGE', name: 'Dogecoin', category: 'Meme', basePriceInr: 22.5, changePercent: 5.40 },
  { symbol: 'AVAX', name: 'Avalanche', category: 'Layer 1', basePriceInr: 2450, changePercent: -2.30 },
  { symbol: 'LINK', name: 'Chainlink', category: 'Oracle / Infra', basePriceInr: 1520, changePercent: 1.85 },
  { symbol: 'SUI', name: 'Sui', category: 'Layer 1', basePriceInr: 285, changePercent: 4.15 },
  { symbol: 'DOT', name: 'Polkadot', category: 'Layer 0', basePriceInr: 540, changePercent: -0.95 },
  { symbol: 'NEAR', name: 'NEAR Protocol', category: 'Layer 1', basePriceInr: 475, changePercent: 2.80 },
  { symbol: 'UNI', name: 'Uniswap', category: 'DeFi', basePriceInr: 910, changePercent: -1.40 },
  { symbol: 'LTC', name: 'Litecoin', category: 'Payment', basePriceInr: 9400, changePercent: 0.65 },
  { symbol: 'BCH', name: 'Bitcoin Cash', category: 'Payment', basePriceInr: 38500, changePercent: -1.75 },
  { symbol: 'MATIC', name: 'Polygon', category: 'Layer 2', basePriceInr: 38.5, changePercent: 1.20 },
  { symbol: 'APT', name: 'Aptos', category: 'Layer 1', basePriceInr: 780, changePercent: -0.45 },
  { symbol: 'ICP', name: 'Internet Computer', category: 'Infrastructure', basePriceInr: 890, changePercent: 3.10 },
  { symbol: 'ATOM', name: 'Cosmos', category: 'Layer 0', basePriceInr: 520, changePercent: -2.15 },
  { symbol: 'ARB', name: 'Arbitrum', category: 'Layer 2', basePriceInr: 72, changePercent: 1.05 },
  { symbol: 'OP', name: 'Optimism', category: 'Layer 2', basePriceInr: 145, changePercent: -1.60 },
  { symbol: 'INJ', name: 'Injective', category: 'DeFi / Layer 1', basePriceInr: 1950, changePercent: 4.80 },
  { symbol: 'FIL', name: 'Filecoin', category: 'Storage', basePriceInr: 360, changePercent: -0.75 },
  { symbol: 'XLM', name: 'Stellar', category: 'Payment', basePriceInr: 32, changePercent: 0.35 },
  { symbol: 'AAVE', name: 'Aave', category: 'DeFi', basePriceInr: 14200, changePercent: 3.65 },
  { symbol: 'RENDER', name: 'Render Network', category: 'AI / Compute', basePriceInr: 660, changePercent: 6.25 },
  { symbol: 'FET', name: 'Artificial Superintelligence Alliance', category: 'AI', basePriceInr: 118, changePercent: -3.40 },
  { symbol: 'TIA', name: 'Celestia', category: 'Modular Infra', basePriceInr: 440, changePercent: -2.85 },
  { symbol: 'STX', name: 'Stacks', category: 'Bitcoin Layer 2', basePriceInr: 165, changePercent: 2.45 },
];

@Injectable()
export class MockCryptoDataProvider implements CryptoDataProvider {
  async getQuote(symbol: string): Promise<CryptoAssetQuote> {
    const cleanSym = symbol.toUpperCase().trim();
    const coin = BASELINE_COINS.find((c) => c.symbol === cleanSym) || {
      symbol: cleanSym,
      name: `${cleanSym} Token`,
      category: 'Cryptocurrency',
      basePriceInr: 100,
      changePercent: 1.25,
    };

    const currentPrice = coin.basePriceInr;
    const change = currentPrice * (coin.changePercent / 100);

    return {
      id: cleanSym,
      symbol: cleanSym,
      name: coin.name,
      category: coin.category,
      currentPrice: Number(currentPrice.toFixed(currentPrice < 10 ? 4 : 2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(coin.changePercent.toFixed(2)),
      high24h: Number((currentPrice * 1.03).toFixed(2)),
      low24h: Number((currentPrice * 0.97).toFixed(2)),
      volume24h: Number((currentPrice * 2500).toFixed(2)),
      bid: Number((currentPrice * 0.999).toFixed(2)),
      ask: Number((currentPrice * 1.001).toFixed(2)),
      timestamp: Date.now(),
    };
  }

  async getHistory(symbol: string, range: string = '1M'): Promise<CryptoPricePoint[]> {
    const cleanSym = symbol.toUpperCase().trim();
    const coin = BASELINE_COINS.find((c) => c.symbol === cleanSym) || {
      symbol: cleanSym,
      name: `${cleanSym} Token`,
      category: 'Cryptocurrency',
      basePriceInr: 100,
      changePercent: 1.25,
    };

    let days = 30;
    if (range === '1D') days = 1;
    else if (range === '1W') days = 7;
    else if (range === '1M') days = 30;
    else if (range === '1Y') days = 365;
    else if (range === '5Y') days = 1000;

    const points: CryptoPricePoint[] = [];
    const now = Date.now();
    let currentPrice = coin.basePriceInr * 0.85; // simulate trend towards today

    for (let i = days; i >= 0; i--) {
      const timestamp = new Date(now - i * 24 * 60 * 60 * 1000).toISOString();
      const dailyChange = (Math.sin(i * 0.4) * 0.03 + (Math.random() - 0.48) * 0.04);
      const open = currentPrice;
      const close = open * (1 + dailyChange);
      const high = Math.max(open, close) * (1 + Math.random() * 0.02);
      const low = Math.min(open, close) * (1 - Math.random() * 0.02);
      const volume = (open * 1500) * (0.8 + Math.random() * 0.4);

      points.push({
        timestamp,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Number(volume.toFixed(2)),
      });

      currentPrice = close;
    }

    return points;
  }

  async getTopMovers(): Promise<CryptoTopMoversResponse> {
    const mappedCoins: CryptoAsset[] = BASELINE_COINS.map((c) => {
      const change = c.basePriceInr * (c.changePercent / 100);
      return {
        id: c.symbol,
        symbol: c.symbol,
        name: c.name,
        category: c.category,
        currentPrice: c.basePriceInr,
        change: Number(change.toFixed(2)),
        changePercent: c.changePercent,
        high24h: Number((c.basePriceInr * 1.03).toFixed(2)),
        low24h: Number((c.basePriceInr * 0.97).toFixed(2)),
        volume24h: Number((c.basePriceInr * 2500).toFixed(2)),
      };
    });

    const keyCoins = ['BTC', 'ETH', 'SOL', 'BNB'];
    const indices: MarketIndex[] = keyCoins.map((sym) => {
      const c = mappedCoins.find((coin) => coin.symbol === sym)!;
      const isPos = (c.changePercent || 0) >= 0;
      return {
        name: `${c.symbol} / INR`,
        value: `₹${c.currentPrice!.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        change: `${isPos ? '+' : ''}₹${Math.abs(c.change || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
        percent: `${isPos ? '+' : ''}${(c.changePercent || 0).toFixed(2)}%`,
        isPositive: isPos,
      };
    });

    const sorted = [...mappedCoins].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));

    const gainers: GainerLoserItem[] = sorted.slice(0, 5).map((c) => ({
      symbol: c.symbol,
      name: c.name,
      price: c.currentPrice || 0,
      changePercent: c.changePercent || 0,
    }));

    const losers: GainerLoserItem[] = [...sorted].reverse().slice(0, 5).map((c) => ({
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
    return BASELINE_COINS.filter(
      (c) => c.symbol.includes(q) || c.name.toUpperCase().includes(q),
    ).map((c) => ({
      id: c.symbol,
      symbol: c.symbol,
      name: c.name,
      category: c.category,
      currentPrice: c.basePriceInr,
      changePercent: c.changePercent,
    }));
  }
}
