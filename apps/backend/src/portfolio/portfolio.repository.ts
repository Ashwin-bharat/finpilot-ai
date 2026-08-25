import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Portfolio, Transaction, Holding, Stock, TransactionType } from '@prisma/client';

export interface CreateTransactionParams {
  symbol: string;
  type: TransactionType;
  quantity: number;
  price: number;
  portfolioId?: string;
  stockInfo?: {
    name?: string;
    sector?: string;
    industry?: string;
    exchange?: string;
    currency?: string;
  };
}

@Injectable()
export class PortfolioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateDefaultPortfolio(userId: string): Promise<Portfolio> {
    let portfolio = await this.prisma.portfolio.findFirst({
      where: { userId },
    });

    if (!portfolio) {
      portfolio = await this.prisma.portfolio.create({
        data: {
          userId,
          name: 'Main Portfolio',
        },
      });
    }

    return portfolio;
  }

  async getPortfolioWithHoldings(userId: string) {
    const defaultPortfolio = await this.findOrCreateDefaultPortfolio(userId);

    return this.prisma.portfolio.findUnique({
      where: { id: defaultPortfolio.id },
      include: {
        holdings: {
          include: {
            stock: true,
          },
        },
      },
    });
  }

  async getTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: {
        portfolio: {
          userId,
        },
      },
      include: {
        stock: true,
      },
      orderBy: {
        executedAt: 'desc',
      },
    });
  }

  async findOrCreateStock(
    symbol: string,
    stockInfo?: { name?: string; sector?: string; industry?: string; exchange?: string; currency?: string },
  ): Promise<Stock> {
    const cleanSymbol = symbol.toUpperCase();
    const existing = await this.prisma.stock.findUnique({
      where: { symbol: cleanSymbol },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.stock.create({
      data: {
        symbol: cleanSymbol,
        name: stockInfo?.name || cleanSymbol,
        sector: stockInfo?.sector || 'Diversified',
        industry: stockInfo?.industry || 'General',
        exchange: stockInfo?.exchange || 'NSE',
        currency: stockInfo?.currency || 'INR',
      },
    });
  }

  async executeTransaction(userId: string, params: CreateTransactionParams) {
    let targetPortfolioId = params.portfolioId;
    if (!targetPortfolioId) {
      const defaultPortfolio = await this.findOrCreateDefaultPortfolio(userId);
      targetPortfolioId = defaultPortfolio.id;
    } else {
      const verified = await this.prisma.portfolio.findFirst({
        where: { id: targetPortfolioId, userId },
      });
      if (!verified) {
        throw new NotFoundException('Portfolio not found');
      }
    }

    const stock = await this.findOrCreateStock(params.symbol, params.stockInfo);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Transaction record
      const transaction = await tx.transaction.create({
        data: {
          portfolioId: targetPortfolioId!,
          stockId: stock.id,
          type: params.type,
          quantity: params.quantity,
          price: params.price,
        },
        include: {
          stock: true,
        },
      });

      // 2. Lookup existing holding
      const existingHolding = await tx.holding.findFirst({
        where: {
          portfolioId: targetPortfolioId!,
          stockId: stock.id,
        },
      });

      if (params.type === TransactionType.BUY) {
        if (existingHolding) {
          const totalQty = existingHolding.quantity + params.quantity;
          const weightedTotalCost =
            existingHolding.quantity * existingHolding.avgBuyPrice + params.quantity * params.price;
          const newAvgPrice = Number((weightedTotalCost / totalQty).toFixed(2));

          await tx.holding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: totalQty,
              avgBuyPrice: newAvgPrice,
            },
          });
        } else {
          await tx.holding.create({
            data: {
              portfolioId: targetPortfolioId!,
              stockId: stock.id,
              quantity: params.quantity,
              avgBuyPrice: params.price,
            },
          });
        }
      } else if (params.type === TransactionType.SELL) {
        if (!existingHolding || existingHolding.quantity < params.quantity) {
          throw new BadRequestException(
            `Insufficient holdings to execute SELL. Current shares held: ${existingHolding?.quantity || 0}`,
          );
        }

        const remainingQty = existingHolding.quantity - params.quantity;
        if (remainingQty <= 0.0001) {
          await tx.holding.delete({
            where: { id: existingHolding.id },
          });
        } else {
          await tx.holding.update({
            where: { id: existingHolding.id },
            data: {
              quantity: Number(remainingQty.toFixed(4)),
            },
          });
        }
      }

      return transaction;
    });
  }
}
