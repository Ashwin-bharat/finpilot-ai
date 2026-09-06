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

import { IntentDetectorService } from './orchestrator/intent-detector.service';
import { EntityResolverService } from './orchestrator/entity-resolver.service';
import { FinPilotOrchestrator } from './orchestrator/finpilot-orchestrator.service';
import { TechnicalAnalysisEngine } from './engines/technical-analysis.engine';
import { MarketStructureEngine } from './engines/market-structure.engine';
import { FundamentalAnalysisEngine } from './engines/fundamental-analysis.engine';
import { RiskAnalysisEngine } from './engines/risk-analysis.engine';
import { NewsIntelligenceEngine } from './engines/news-intelligence.engine';
import { PortfolioIntelligenceEngine } from './engines/portfolio-intelligence.engine';
import { CrossEngineSynthesisEngine } from './engines/cross-engine-synthesis.engine';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [MarketModule, PortfolioModule, NewsModule, CryptoModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiToolsService,
    AiResponseValidator,
    AiRateLimitGuard,
    IntentDetectorService,
    EntityResolverService,
    FinPilotOrchestrator,
    TechnicalAnalysisEngine,
    MarketStructureEngine,
    FundamentalAnalysisEngine,
    RiskAnalysisEngine,
    NewsIntelligenceEngine,
    PortfolioIntelligenceEngine,
    CrossEngineSynthesisEngine,
    PrismaService,
  ],
  exports: [
    AiService,
    FinPilotOrchestrator,
    IntentDetectorService,
    EntityResolverService,
    TechnicalAnalysisEngine,
    MarketStructureEngine,
    FundamentalAnalysisEngine,
    RiskAnalysisEngine,
    NewsIntelligenceEngine,
    PortfolioIntelligenceEngine,
    CrossEngineSynthesisEngine,
  ],
})
export class AiModule {}



