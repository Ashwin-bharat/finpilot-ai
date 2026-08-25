import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Watchlist, WatchlistType, Stock } from '@prisma/client';

@Injectable()
export class WatchlistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateDefaultWatchlist(userId: string): Promise<Watchlist> {
    let watchlist = await this.prisma.watchlist.findFirst({
      where: { userId },
    });

    if (!watchlist) {
      watchlist = await this.prisma.watchlist.create({
        data: {
          userId,
          name: 'My Watchlist',
          type: WatchlistType.CUSTOM,
        },
      });
    }

    return watchlist;
  }

  async getWatchlists(userId: string) {
    const list = await this.prisma.watchlist.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            stock: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (list.length === 0) {
      const defaultList = await this.findOrCreateDefaultWatchlist(userId);
      return this.prisma.watchlist.findMany({
        where: { id: defaultList.id },
        include: {
          items: {
            include: {
              stock: true,
            },
          },
        },
      });
    }

    return list;
  }

  async findById(id: string) {
    return this.prisma.watchlist.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            stock: true,
          },
        },
      },
    });
  }

  async createWatchlist(userId: string, name: string, type: WatchlistType = WatchlistType.CUSTOM) {
    return this.prisma.watchlist.create({
      data: {
        userId,
        name,
        type,
      },
      include: {
        items: {
          include: {
            stock: true,
          },
        },
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

  async addItem(watchlistId: string, stockId: string) {
    const existing = await this.prisma.watchlistItem.findFirst({
      where: {
        watchlistId,
        stockId,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.watchlistItem.create({
      data: {
        watchlistId,
        stockId,
      },
      include: {
        stock: true,
      },
    });
  }

  async removeItem(watchlistId: string, stockId: string) {
    return this.prisma.watchlistItem.deleteMany({
      where: {
        watchlistId,
        stockId,
      },
    });
  }
}
