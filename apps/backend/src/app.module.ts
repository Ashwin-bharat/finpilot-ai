import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MarketModule } from './market/market.module';
import { UsersModule } from './users/users.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { NewsModule } from './news/news.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [AuthModule, MarketModule, UsersModule, PortfolioModule, WatchlistModule, NewsModule, AiModule],
})
export class AppModule {}
