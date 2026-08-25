import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { PortfolioRepository } from './portfolio.repository';
import { PrismaService } from '../prisma/prisma.service';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [MarketModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioRepository, PrismaService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
