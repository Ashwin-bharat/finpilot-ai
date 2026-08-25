import { Stock, StockPricePoint, MarketIndex, GainerLoserItem } from '@finpilot/shared-types';

export const MARKET_DATA_PROVIDER = 'MARKET_DATA_PROVIDER';

export interface TopMoversResponse {
  indices: MarketIndex[];
  gainers: GainerLoserItem[];
  losers: GainerLoserItem[];
}

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<Stock>;
  getHistory(symbol: string, range?: string): Promise<StockPricePoint[]>;
  getTopMovers(): Promise<TopMoversResponse>;
}
