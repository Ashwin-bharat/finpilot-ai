import { Injectable, NotFoundException } from '@nestjs/common';
import { Stock, StockPricePoint, MarketIndex, GainerLoserItem } from '@finpilot/shared-types';
import { MarketDataProvider, TopMoversResponse } from './market-data-provider.interface';

@Injectable()
export class MockMarketDataProvider implements MarketDataProvider {
  private indices: MarketIndex[] = [
    { name: 'NIFTY 50', value: '24,835.40', change: '+142.30', percent: '+0.58%', isPositive: true },
    { name: 'SENSEX', value: '81,332.15', change: '+418.90', percent: '+0.52%', isPositive: true },
    { name: 'BANK NIFTY', value: '52,240.80', change: '-85.40', percent: '-0.16%', isPositive: false },
    { name: 'NIFTY IT', value: '41,120.60', change: '+512.10', percent: '+1.26%', isPositive: true },
  ];

  private gainers: GainerLoserItem[] = [
    { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Ltd.', price: 998.75, changePercent: 3.54 },
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd.', price: 1450.30, changePercent: 1.55 },
    { symbol: 'INFY.NS', name: 'Infosys Limited', price: 1542.80, changePercent: 1.22 },
  ];

  private losers: GainerLoserItem[] = [
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd.', price: 2980.10, changePercent: -0.42 },
  ];

  private mockStocks: Stock[] = [
    {
      id: '1',
      symbol: 'TCS.NS',
      name: 'Tata Consultancy Services Ltd.',
      sector: 'Information Technology',
      industry: 'IT Services',
      exchange: 'NSE',
      currency: 'INR',
      currentPrice: 3892.45,
      change: 45.20,
      changePercent: 1.18,
    },
    {
      id: '2',
      symbol: 'RELIANCE.NS',
      name: 'Reliance Industries Ltd.',
      sector: 'Energy',
      industry: 'Oil & Gas / Retail',
      exchange: 'NSE',
      currency: 'INR',
      currentPrice: 2980.10,
      change: -12.50,
      changePercent: -0.42,
    },
    {
      id: '3',
      symbol: 'INFY.NS',
      name: 'Infosys Limited',
      sector: 'Information Technology',
      industry: 'IT Services',
      exchange: 'NSE',
      currency: 'INR',
      currentPrice: 1542.80,
      change: 18.60,
      changePercent: 1.22,
    },
    {
      id: '4',
      symbol: 'HDFCBANK.NS',
      name: 'HDFC Bank Ltd.',
      sector: 'Financial Services',
      industry: 'Private Bank',
      exchange: 'NSE',
      currency: 'INR',
      currentPrice: 1450.30,
      change: 22.10,
      changePercent: 1.55,
    },
    {
      id: '5',
      symbol: 'TATAMOTORS.NS',
      name: 'Tata Motors Ltd.',
      sector: 'Automobile',
      industry: 'Passenger Vehicles & Commercial',
      exchange: 'NSE',
      currency: 'INR',
      currentPrice: 998.75,
      change: 34.15,
      changePercent: 3.54,
    },
  ];

  async getQuote(symbol: string): Promise<Stock> {
    const stock = this.mockStocks.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
    if (!stock) {
      throw new NotFoundException(`Stock quote for symbol ${symbol} not found`);
    }
    return stock;
  }

  async getHistory(symbol: string, range: string = '1m'): Promise<StockPricePoint[]> {
    const stock = this.mockStocks.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
    const basePrice = stock ? stock.currentPrice || 1000 : 1000;

    const normalizedRange = range.toLowerCase();
    let pointsCount = 30;
    if (normalizedRange === '1d') pointsCount = 24;
    else if (normalizedRange === '1w') pointsCount = 7;
    else if (normalizedRange === '1m') pointsCount = 30;
    else if (normalizedRange === '1y') pointsCount = 250;
    else if (normalizedRange === '5y') pointsCount = 500;

    return Array.from({ length: pointsCount }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (pointsCount - i));
      const variation = (Math.sin(i) * 0.03 + Math.sin(i * 2) * 0.01) * basePrice;
      const close = Number((basePrice - variation).toFixed(2));
      return {
        timestamp: normalizedRange === '1d' ? d.toISOString() : d.toISOString().split('T')[0],
        open: Number((close * 0.995).toFixed(2)),
        high: Number((close * 1.01).toFixed(2)),
        low: Number((close * 0.99).toFixed(2)),
        close,
        volume: Math.floor(1000000 + Math.random() * 5000000),
      };
    });
  }

  async getTopMovers(): Promise<TopMoversResponse> {
    return {
      indices: this.indices,
      gainers: this.gainers,
      losers: this.losers,
    };
  }
}
