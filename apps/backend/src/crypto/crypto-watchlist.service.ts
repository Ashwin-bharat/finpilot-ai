import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoMarketService } from './crypto-market.service';
import { CryptoWatchlist, CryptoWatchlistItem } from '@finpilot/shared-types';

@Injectable()
export class CryptoWatchlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoMarketService: CryptoMarketService,
  ) {}

  /**
   * Find or create default crypto watchlist for user
   */
  async findOrCreateDefaultWatchlist(userId: string) {
    let watchlist = await this.prisma.cryptoWatchlist.findFirst({
      where: { userId },
    });

    if (!watchlist) {
      watchlist = await this.prisma.cryptoWatchlist.create({
        data: {
          userId,
          name: 'My Crypto Watchlist',
        },
      });

      // Seed with initial top 3 coins
      const topSymbols = ['BTC', 'ETH', 'SOL'];
      for (const sym of topSymbols) {
        const asset = await this.prisma.cryptoAsset.findUnique({ where: { symbol: sym } });
        if (asset) {
          await this.prisma.cryptoWatchlistItem.create({
            data: {
              cryptoWatchlistId: watchlist.id,
              cryptoAssetId: asset.id,
            },
          });
        }
      }
    }

    return watchlist;
  }

  /**
   * Get all crypto watchlists for a user with live price quotes
   * Distinct from equity watchlists.
   */
  async getWatchlists(userId: string): Promise<CryptoWatchlist[]> {
    await this.findOrCreateDefaultWatchlist(userId);

    const watchlists = await this.prisma.cryptoWatchlist.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            cryptoAsset: true,
          },
          orderBy: { addedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      watchlists.map(async (wl) => {
        const enrichedItems: CryptoWatchlistItem[] = await Promise.all(
          wl.items.map(async (item) => {
            let quote;
            try {
              const qRes = await this.cryptoMarketService.getQuote(item.cryptoAsset.symbol);
              quote = qRes.data;
            } catch {
              quote = {
                currentPrice: 0,
                change: 0,
                changePercent: 0,
              };
            }

            return {
              id: item.id,
              cryptoWatchlistId: item.cryptoWatchlistId,
              cryptoAssetId: item.cryptoAssetId,
              cryptoAsset: {
                id: item.cryptoAsset.id,
                symbol: item.cryptoAsset.symbol,
                name: item.cryptoAsset.name,
                category: item.cryptoAsset.category,
                currentPrice: quote.currentPrice,
                change: quote.change,
                changePercent: quote.changePercent,
                high24h: quote.high24h,
                low24h: quote.low24h,
                volume24h: quote.volume24h,
              },
              addedAt: item.addedAt.toISOString(),
            };
          }),
        );

        return {
          id: wl.id,
          userId: wl.userId,
          name: wl.name,
          type: wl.type,
          createdAt: wl.createdAt.toISOString(),
          items: enrichedItems,
        };
      }),
    );
  }

  /**
   * Add a crypto asset to watchlist
   */
  async addItem(userId: string, watchlistId: string, symbol: string) {
    const cleanSym = symbol.toUpperCase().trim();
    const watchlist = await this.prisma.cryptoWatchlist.findFirst({
      where: { id: watchlistId, userId },
    });

    if (!watchlist) {
      throw new NotFoundException('Crypto watchlist not found');
    }

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

    const existing = await this.prisma.cryptoWatchlistItem.findUnique({
      where: {
        cryptoWatchlistId_cryptoAssetId: {
          cryptoWatchlistId: watchlist.id,
          cryptoAssetId: asset.id,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`${cleanSym} is already in this watchlist`);
    }

    return this.prisma.cryptoWatchlistItem.create({
      data: {
        cryptoWatchlistId: watchlist.id,
        cryptoAssetId: asset.id,
      },
      include: { cryptoAsset: true },
    });
  }

  /**
   * Remove item from watchlist
   */
  async removeItem(userId: string, watchlistId: string, cryptoAssetId: string) {
    const watchlist = await this.prisma.cryptoWatchlist.findFirst({
      where: { id: watchlistId, userId },
    });

    if (!watchlist) {
      throw new NotFoundException('Crypto watchlist not found');
    }

    const item = await this.prisma.cryptoWatchlistItem.findFirst({
      where: {
        cryptoWatchlistId: watchlist.id,
        OR: [
          { cryptoAssetId },
          { cryptoAsset: { symbol: cryptoAssetId.toUpperCase() } },
        ],
      },
    });

    if (!item) {
      throw new NotFoundException('Crypto item not found in watchlist');
    }

    return this.prisma.cryptoWatchlistItem.delete({
      where: { id: item.id },
    });
  }
}
