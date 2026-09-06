import { Module } from '@nestjs/common';
import { BrokerService } from './broker.service';
import { BrokerController } from './broker.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MarketModule } from '../market/market.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [MarketModule, PortfolioModule, WalletModule],
  controllers: [BrokerController],
  providers: [BrokerService, PrismaService],
  exports: [BrokerService],
})
export class BrokerModule {}
