import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { AiResponseValidator } from './ai-response-validator';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MarketModule } from '../market/market.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [MarketModule, PortfolioModule, NewsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiToolsService,
    AiResponseValidator,
    AiRateLimitGuard,
    PrismaService,
  ],
  exports: [AiService],
})
export class AiModule {}
