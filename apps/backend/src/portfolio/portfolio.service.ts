import { Inject, Injectable } from '@nestjs/common';
import { PortfolioRepository } from './portfolio.repository';
import { MARKET_DATA_PROVIDER, MarketDataProvider } from '../market/providers/market-data-provider.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  Portfolio,
  PortfolioHolding,
  Transaction,
  PortfolioAnalysis,
  SectorAllocation,
} from '@finpilot/shared-types';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    @Inject(MARKET_DATA_PROVIDER) private readonly marketDataProvider: MarketDataProvider,
  ) {}

  async getPortfolio(userId: string): Promise<Portfolio> {
    const portfolioRecord = await this.portfolioRepository.getPortfolioWithHoldings(userId);

    if (!portfolioRecord) {
      const created = await this.portfolioRepository.findOrCreateDefaultPortfolio(userId);
      return {
        id: created.id,
        userId: created.userId,
        name: created.name,
        totalValue: 0,
        dayChange: 0,
        dayChangePercent: 0,
        holdings: [],
      };
    }

    const holdingsWithLiveQuotes: PortfolioHolding[] = await Promise.all(
      portfolioRecord.holdings.map(async (h) => {
        let liveQuote;
        try {
          liveQuote = await this.marketDataProvider.getQuote(h.stock.symbol);
        } catch {
          liveQuote = {
            id: h.stock.id,
            symbol: h.stock.symbol,
            name: h.stock.name,
            sector: h.stock.sector,
            industry: h.stock.industry,
            exchange: h.stock.exchange,
            currency: h.stock.currency,
            currentPrice: h.avgBuyPrice,
            change: 0,
            changePercent: 0,
          };
        }

        const currentPrice = liveQuote.currentPrice || h.avgBuyPrice;
        const currentValue = Number((h.quantity * currentPrice).toFixed(2));
        const totalCost = Number((h.quantity * h.avgBuyPrice).toFixed(2));
        const totalReturn = Number((currentValue - totalCost).toFixed(2));
        const totalReturnPercent = totalCost > 0 ? Number(((totalReturn / totalCost) * 100).toFixed(2)) : 0;

        return {
          id: h.id,
          portfolioId: h.portfolioId,
          stock: {
            id: h.stock.id,
            symbol: h.stock.symbol,
            name: liveQuote.name || h.stock.name,
            sector: liveQuote.sector || h.stock.sector,
            industry: liveQuote.industry || h.stock.industry,
            exchange: liveQuote.exchange || h.stock.exchange,
            currency: liveQuote.currency || h.stock.currency,
            currentPrice,
            change: liveQuote.change,
            changePercent: liveQuote.changePercent,
          },
          quantity: h.quantity,
          avgBuyPrice: h.avgBuyPrice,
          currentValue,
          totalReturn,
          totalReturnPercent,
        };
      }),
    );

    const totalValue = Number(
      holdingsWithLiveQuotes.reduce((acc, h) => acc + h.currentValue, 0).toFixed(2),
    );

    const totalDayChange = Number(
      holdingsWithLiveQuotes
        .reduce((acc, h) => acc + h.quantity * (h.stock.change || 0), 0)
        .toFixed(2),
    );

    const prevValue = totalValue - totalDayChange;
    const dayChangePercent = prevValue > 0 ? Number(((totalDayChange / prevValue) * 100).toFixed(2)) : 0;

    return {
      id: portfolioRecord.id,
      userId: portfolioRecord.userId,
      name: portfolioRecord.name,
      totalValue,
      dayChange: totalDayChange,
      dayChangePercent,
      holdings: holdingsWithLiveQuotes,
    };
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    const rawTransactions = await this.portfolioRepository.getTransactions(userId);

    return rawTransactions.map((tx) => ({
      id: tx.id,
      portfolioId: tx.portfolioId,
      stock: {
        id: tx.stock.id,
        symbol: tx.stock.symbol,
        name: tx.stock.name,
        sector: tx.stock.sector,
        industry: tx.stock.industry,
        exchange: tx.stock.exchange,
        currency: tx.stock.currency,
      },
      type: tx.type as 'BUY' | 'SELL',
      quantity: tx.quantity,
      price: tx.price,
      executedAt: tx.executedAt.toISOString(),
    }));
  }

  async createTransaction(userId: string, dto: CreateTransactionDto) {
    let stockInfo;
    try {
      const quote = await this.marketDataProvider.getQuote(dto.symbol);
      stockInfo = {
        name: quote.name,
        sector: quote.sector,
        industry: quote.industry,
        exchange: quote.exchange,
        currency: quote.currency,
      };
    } catch {
      stockInfo = undefined;
    }

    const transaction = await this.portfolioRepository.executeTransaction(userId, {
      symbol: dto.symbol,
      type: dto.type,
      quantity: dto.quantity,
      price: dto.price,
      portfolioId: dto.portfolioId,
      stockInfo,
    });

    return {
      message: 'Transaction executed successfully',
      transaction: {
        id: transaction.id,
        portfolioId: transaction.portfolioId,
        symbol: transaction.stock.symbol,
        type: transaction.type,
        quantity: transaction.quantity,
        price: transaction.price,
        executedAt: transaction.executedAt.toISOString(),
      },
    };
  }

  async getAnalysis(userId: string): Promise<PortfolioAnalysis> {
    const portfolio = await this.getPortfolio(userId);
    const holdings = portfolio.holdings;

    if (holdings.length === 0) {
      return {
        totalInvestment: 0,
        currentValue: 0,
        totalProfit: 0,
        totalProfitPercent: 0,
        diversificationScore: 0,
        sectorAllocation: [],
        holdingsCount: 0,
      };
    }

    const totalInvestment = Number(
      holdings.reduce((acc, h) => acc + h.quantity * h.avgBuyPrice, 0).toFixed(2),
    );
    const currentValue = portfolio.totalValue;
    const totalProfit = Number((currentValue - totalInvestment).toFixed(2));
    const totalProfitPercent = totalInvestment > 0 ? Number(((totalProfit / totalInvestment) * 100).toFixed(2)) : 0;

    // Sector Allocation computation
    const sectorMap = new Map<string, number>();
    for (const h of holdings) {
      const sector = h.stock.sector || 'Diversified';
      const existingVal = sectorMap.get(sector) || 0;
      sectorMap.set(sector, existingVal + h.currentValue);
    }

    const sectorAllocation: SectorAllocation[] = Array.from(sectorMap.entries())
      .map(([sector, val]) => ({
        sector,
        value: Number(val.toFixed(2)),
        percentage: currentValue > 0 ? Number(((val / currentValue) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Diversification Score computation (0-100)
    // 1. Asset count component (max 40 pts)
    const assetScore = Math.min(holdings.length * 8, 40);
    // 2. Sector spread component (max 40 pts)
    const sectorScore = Math.min(sectorAllocation.length * 10, 40);
    // 3. Concentration balance component (max 20 pts)
    const maxSectorPercentage = sectorAllocation.length > 0 ? sectorAllocation[0].percentage : 100;
    const balanceScore = maxSectorPercentage <= 30 ? 20 : maxSectorPercentage <= 50 ? 12 : 5;

    const diversificationScore = Math.min(Math.max(assetScore + sectorScore + balanceScore, 10), 100);

    return {
      totalInvestment,
      currentValue,
      totalProfit,
      totalProfitPercent,
      diversificationScore,
      sectorAllocation,
      holdingsCount: holdings.length,
    };
  }
}
