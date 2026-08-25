import { Module } from '@nestjs/common';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';
import { WatchlistRepository } from './watchlist.repository';
import { PrismaService } from '../prisma/prisma.service';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [MarketModule],
  controllers: [WatchlistController],
  providers: [WatchlistService, WatchlistRepository, PrismaService],
  exports: [WatchlistService],
})
export class WatchlistModule {}
