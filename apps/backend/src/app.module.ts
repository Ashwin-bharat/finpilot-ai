import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MarketModule } from './market/market.module';
import { UsersModule } from './users/users.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { NewsModule } from './news/news.module';
import { AiModule } from './ai/ai.module';
import { BrokerModule } from './broker/broker.module';
import { WalletModule } from './wallet/wallet.module';
import { CryptoModule } from './crypto/crypto.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    AuthModule,
    MarketModule,
    UsersModule,
    PortfolioModule,
    WatchlistModule,
    NewsModule,
    AiModule,
    BrokerModule,
    WalletModule,
    CryptoModule,
    MailModule,
  ],
})
export class AppModule {}
