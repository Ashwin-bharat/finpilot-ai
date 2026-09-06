import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoMarketService } from './crypto-market.service';
import {
  CryptoPortfolio,
  CryptoHolding,
  CryptoTransaction,
} from '@finpilot/shared-types';
import { TransactionType } from '@prisma/client';

export interface CreateCryptoTransactionDto {
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
}

@Injectable()
export class CryptoPortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoMarketService: CryptoMarketService,
  ) {}

  /**
   * Find or create default crypto portfolio for user
   */
  async findOrCreateDefaultPortfolio(userId: string) {
    let portfolio = await this.prisma.cryptoPortfolio.findFirst({
      where: { userId },
    });

    if (!portfolio) {
      portfolio = await this.prisma.cryptoPortfolio.create({
        data: {
          userId,
          name: 'Main Crypto Portfolio',
        },
      });
    }

    return portfolio;
  }

  /**
   * Get user's crypto portfolio with live quotes and valuation metrics
   * STRICT SEPARATION: Tracked in crypto_portfolios / crypto_holdings, distinct from equities.
   */
  async getPortfolio(userId: string): Promise<CryptoPortfolio> {
    const portfolioRecord = await this.findOrCreateDefaultPortfolio(userId);

    const fullRecord = await this.prisma.cryptoPortfolio.findUnique({
      where: { id: portfolioRecord.id },
      include: {
        holdings: {
          include: {
            cryptoAsset: true,
          },
        },
      },
    });

    if (!fullRecord || fullRecord.holdings.length === 0) {
      return {
        id: portfolioRecord.id,
        userId: portfolioRecord.userId,
        name: portfolioRecord.name,
        totalValue: 0,
        dayChange: 0,
        dayChangePercent: 0,
        holdings: [],
      };
    }

    const holdingsWithLiveQuotes: CryptoHolding[] = await Promise.all(
      fullRecord.holdings.map(async (h) => {
        let livePrice = h.avgBuyPrice;
        let change = 0;
        let changePercent = 0;

        try {
          const quoteRes = await this.cryptoMarketService.getQuote(h.cryptoAsset.symbol);
          if (quoteRes.data.currentPrice) {
            livePrice = quoteRes.data.currentPrice;
            change = quoteRes.data.change || 0;
            changePercent = quoteRes.data.changePercent || 0;
          }
        } catch {
          // Keep avgBuyPrice fallback
        }

        const currentValue = Number((h.quantity * livePrice).toFixed(2));
        const totalCost = Number((h.quantity * h.avgBuyPrice).toFixed(2));
        const totalReturn = Number((currentValue - totalCost).toFixed(2));
        const totalReturnPercent =
          totalCost > 0 ? Number(((totalReturn / totalCost) * 100).toFixed(2)) : 0;

        return {
          id: h.id,
          cryptoPortfolioId: h.cryptoPortfolioId,
          cryptoAssetId: h.cryptoAssetId,
          cryptoAsset: {
            id: h.cryptoAsset.id,
            symbol: h.cryptoAsset.symbol,
            name: h.cryptoAsset.name,
            category: h.cryptoAsset.category,
            currentPrice: livePrice,
            change,
            changePercent,
          },
          quantity: h.quantity,
          avgBuyPrice: h.avgBuyPrice,
          currentValue,
          totalReturn,
          totalReturnPercent,
          createdAt: h.createdAt.toISOString(),
          updatedAt: h.updatedAt.toISOString(),
        };
      }),
    );

    const totalValue = Number(
      holdingsWithLiveQuotes.reduce((acc, h) => acc + h.currentValue, 0).toFixed(2),
    );

    const totalDayChange = Number(
      holdingsWithLiveQuotes
        .reduce((acc, h) => acc + h.quantity * (h.cryptoAsset.change || 0), 0)
        .toFixed(2),
    );

    const prevValue = totalValue - totalDayChange;
    const dayChangePercent =
      prevValue > 0 ? Number(((totalDayChange / prevValue) * 100).toFixed(2)) : 0;

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

  /**
   * Get user's crypto transaction history
   */
  async getTransactions(userId: string): Promise<CryptoTransaction[]> {
    const portfolio = await this.findOrCreateDefaultPortfolio(userId);

    const records = await this.prisma.cryptoTransaction.findMany({
      where: { cryptoPortfolioId: portfolio.id },
      include: { cryptoAsset: true },
      orderBy: { executedAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      cryptoPortfolioId: r.cryptoPortfolioId,
      cryptoAssetId: r.cryptoAssetId,
      cryptoAsset: {
        id: r.cryptoAsset.id,
        symbol: r.cryptoAsset.symbol,
        name: r.cryptoAsset.name,
        category: r.cryptoAsset.category,
      },
      type: r.type as 'BUY' | 'SELL',
      quantity: r.quantity,
      price: r.price,
      executedAt: r.executedAt.toISOString(),
    }));
  }

  /**
   * Find or create crypto asset record in DB
   */
  async findOrCreateCryptoAsset(symbol: string) {
    const cleanSym = symbol.toUpperCase().trim();
    let asset = await this.prisma.cryptoAsset.findUnique({
      where: { symbol: cleanSym },
    });

    if (!asset) {
      asset = await this.prisma.cryptoAsset.create({
        data: {
          symbol: cleanSym,
          name: `${cleanSym} Token`,
          category: 'Cryptocurrency',
        },
      });
    }

    return asset;
  }

  /**
   * Execute Crypto Transaction (Paper / Manual fill)
   */
  async executeTransaction(userId: string, dto: CreateCryptoTransactionDto) {
    const portfolio = await this.findOrCreateDefaultPortfolio(userId);
    const asset = await this.findOrCreateCryptoAsset(dto.symbol);

    let price = dto.price;
    if (!price || price <= 0) {
      const quoteRes = await this.cryptoMarketService.getQuote(asset.symbol);
      price = quoteRes.data.currentPrice || 100;
    }

    const txType = dto.type === 'BUY' ? TransactionType.BUY : TransactionType.SELL;

    return this.prisma.$transaction(async (tx) => {
      // 1. Record transaction
      const transaction = await tx.cryptoTransaction.create({
        data: {
          cryptoPortfolioId: portfolio.id,
          cryptoAssetId: asset.id,
          type: txType,
          quantity: dto.quantity,
          price,
        },
        include: { cryptoAsset: true },
      });

      // 2. Lookup existing holding
      const existingHolding = await tx.cryptoHolding.findFirst({
        where: {
          cryptoPortfolioId: portfolio.id,
          cryptoAssetId: asset.id,
        },
      });

      if (txType === TransactionType.BUY) {
        if (existingHolding) {
          const totalQty = existingHolding.quantity + dto.quantity;
          const weightedCost =
            existingHolding.quantity * existingHolding.avgBuyPrice + dto.quantity * price;
          const newAvgPrice = Number((weightedCost / totalQty).toFixed(2));

          await tx.cryptoHolding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: totalQty,
              avgBuyPrice: newAvgPrice,
            },
          });
        } else {
          await tx.cryptoHolding.create({
            data: {
              cryptoPortfolioId: portfolio.id,
              cryptoAssetId: asset.id,
              quantity: dto.quantity,
              avgBuyPrice: price,
            },
          });
        }
      } else if (txType === TransactionType.SELL) {
        if (!existingHolding || existingHolding.quantity < dto.quantity) {
          throw new BadRequestException(
            `Insufficient crypto holdings to execute SELL. Current balance: ${existingHolding?.quantity || 0} ${asset.symbol}`,
          );
        }

        const remaining = existingHolding.quantity - dto.quantity;
        if (remaining <= 0.000001) {
          await tx.cryptoHolding.delete({
            where: { id: existingHolding.id },
          });
        } else {
          await tx.cryptoHolding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: Number(remaining.toFixed(6)),
            },
          });
        }
      }

      return transaction;
    });
  }
}
