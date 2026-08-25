import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { WatchlistRepository } from './watchlist.repository';
import { MARKET_DATA_PROVIDER, MarketDataProvider } from '../market/providers/market-data-provider.interface';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { AddWatchlistItemDto } from './dto/add-item.dto';
import { Watchlist, WatchlistItem, Stock } from '@finpilot/shared-types';

@Injectable()
export class WatchlistService {
  constructor(
    private readonly watchlistRepository: WatchlistRepository,
    @Inject(MARKET_DATA_PROVIDER) private readonly marketDataProvider: MarketDataProvider,
  ) {}

  async getWatchlists(userId: string): Promise<Watchlist[]> {
    const rawWatchlists = await this.watchlistRepository.getWatchlists(userId);

    return Promise.all(
      rawWatchlists.map(async (wl) => {
        const enrichedItems: WatchlistItem[] = await Promise.all(
          wl.items.map(async (item) => {
            let quote: Stock;
            try {
              quote = await this.marketDataProvider.getQuote(item.stock.symbol);
            } catch {
              quote = {
                id: item.stock.id,
                symbol: item.stock.symbol,
                name: item.stock.name,
                sector: item.stock.sector,
                industry: item.stock.industry,
                exchange: item.stock.exchange,
                currency: item.stock.currency,
              };
            }

            return {
              id: item.id,
              stock: {
                id: item.stock.id,
                symbol: item.stock.symbol,
                name: quote.name || item.stock.name,
                sector: quote.sector || item.stock.sector,
                industry: quote.industry || item.stock.industry,
                exchange: quote.exchange || item.stock.exchange,
                currency: quote.currency || item.stock.currency,
                currentPrice: quote.currentPrice,
                change: quote.change,
                changePercent: quote.changePercent,
              },
              addedAt: item.addedAt.toISOString(),
            };
          }),
        );

        return {
          id: wl.id,
          userId: wl.userId,
          name: wl.name,
          type: wl.type as 'CUSTOM' | 'AI_GENERATED',
          items: enrichedItems,
        };
      }),
    );
  }

  async createWatchlist(userId: string, dto: CreateWatchlistDto) {
    const created = await this.watchlistRepository.createWatchlist(userId, dto.name, dto.type);
    return {
      id: created.id,
      userId: created.userId,
      name: created.name,
      type: created.type,
      items: [],
    };
  }

  async addItem(userId: string, watchlistId: string, dto: AddWatchlistItemDto) {
    const watchlist = await this.watchlistRepository.findById(watchlistId);
    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    if (watchlist.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this watchlist');
    }

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

    const stock = await this.watchlistRepository.findOrCreateStock(dto.symbol, stockInfo);
    const item = await this.watchlistRepository.addItem(watchlistId, stock.id);

    return {
      message: `Stock ${stock.symbol} added to watchlist`,
      item: {
        id: item.id,
        watchlistId,
        stockId: stock.id,
        symbol: stock.symbol,
      },
    };
  }

  async removeItem(userId: string, watchlistId: string, stockIdOrSymbol: string) {
    const watchlist = await this.watchlistRepository.findById(watchlistId);
    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    if (watchlist.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this watchlist');
    }

    // Match by stockId or stock.symbol
    const matchingItem = watchlist.items.find(
      (item) => item.stockId === stockIdOrSymbol || item.stock.symbol.toUpperCase() === stockIdOrSymbol.toUpperCase(),
    );

    if (matchingItem) {
      await this.watchlistRepository.removeItem(watchlistId, matchingItem.stockId);
    } else {
      await this.watchlistRepository.removeItem(watchlistId, stockIdOrSymbol);
    }

    return { message: 'Stock removed from watchlist successfully' };
  }
}
