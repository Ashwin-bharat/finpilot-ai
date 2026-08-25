import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MARKET_DATA_PROVIDER, MarketDataProvider } from './providers/market-data-provider.interface';
import { IndicatorsService } from './indicators.service';
import { StockFundamentals, StockDetail } from '@finpilot/shared-types';

@Injectable()
export class MarketService {
  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly marketDataProvider: MarketDataProvider,
    private readonly prisma: PrismaService,
    private readonly indicatorsService: IndicatorsService,
  ) {}

  async getStocks(query?: string) {
    const allQuotes = await Promise.all(
      ['TCS.NS', 'RELIANCE.NS', 'INFY.NS', 'HDFCBANK.NS', 'TATAMOTORS.NS'].map((s) =>
        this.marketDataProvider.getQuote(s),
      ),
    );

    if (!query) return allQuotes;
    const q = query.toLowerCase();
    return allQuotes.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }

  async getStockBySymbol(symbol: string): Promise<StockDetail> {
    const cleanSymbol = symbol.toUpperCase();
    const stock = await this.marketDataProvider.getQuote(cleanSymbol);
    const priceHistory = await this.marketDataProvider.getHistory(cleanSymbol, '1m');

    // Query real fundamentals from DB
    const dbStock = this.prisma?.stock
      ? await this.prisma.stock.findUnique({
          where: { symbol: cleanSymbol },
          include: {
            fundamentals: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        })
      : null;

    let fundamentals: StockFundamentals | null = null;
    if (dbStock && dbStock.fundamentals && dbStock.fundamentals.length > 0) {
      const f = dbStock.fundamentals[0];
      fundamentals = {
        peRatio: f.peRatio,
        pbRatio: f.pbRatio,
        roe: f.roe,
        roce: f.roce,
        eps: f.eps,
        debtToEquity: f.debtToEquity,
        marketCap: f.marketCap,
        fiscalPeriod: f.fiscalPeriod,
      };
    }

    return {
      ...stock,
      priceHistory,
      fundamentals,
    };
  }

  async getHistory(symbol: string, range: string = '1m') {
    return this.marketDataProvider.getHistory(symbol, range);
  }

  async getIndicators(symbol: string) {
    return this.indicatorsService.calculateIndicators(symbol);
  }

  async getTopMovers() {
    return this.marketDataProvider.getTopMovers();
  }

  async getTopGainers() {
    const movers = await this.marketDataProvider.getTopMovers();
    return movers.gainers;
  }

  async getTopLosers() {
    const movers = await this.marketDataProvider.getTopMovers();
    return movers.losers;
  }

  async getTrending() {
    return Promise.all(
      ['TCS.NS', 'RELIANCE.NS', 'INFY.NS', 'HDFCBANK.NS', 'TATAMOTORS.NS'].map((s) =>
        this.marketDataProvider.getQuote(s),
      ),
    );
  }
}
