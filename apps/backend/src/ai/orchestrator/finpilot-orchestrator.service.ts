import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../prisma/prisma.service';
import { AiToolsService } from '../ai-tools.service';
import { AiResponseValidator } from '../ai-response-validator';
import { MarketService } from '../../market/market.service';
import { IntentDetectorService } from './intent-detector.service';
import { EntityResolverService } from './entity-resolver.service';
import {
  QueryIntent,
  StructuredAiRecommendation,
  EntityResolutionResult,
  TechnicalEngineResult,
  MarketStructureResult,
  FundamentalAnalysisResult,
  RiskAnalysisResult,
  NewsIntelligenceResult,
  PortfolioIntelligenceResult,
  CrossEngineSynthesisResult,
} from '@finpilot/shared-types';
import { CrossEngineSynthesisEngine } from '../engines/cross-engine-synthesis.engine';
import { CryptoMarketService } from '../../crypto/crypto-market.service';

export interface OrchestratorResult {
  intent: QueryIntent;
  entities: EntityResolutionResult;
  toolsFired: string[];
  recommendation: StructuredAiRecommendation;
}

const SYSTEM_PROMPT = `You are FinPilot AI, an elite financial intelligence co-pilot specializing in Indian equities (NSE/BSE) and portfolio diversification.
CRITICAL RULES:
1. Ground all commentary strictly in the provided verified data. Never invent or hallucinate metrics.
2. Frame all conclusions probabilistically. Never use deterministic certainty phrases like "guaranteed", "will definitely", "certain to rise", or "risk-free".
3. Conclude with complete analysis adhering to schema.`;

function formatMacdMomentum(hist: number | undefined | null): string {
  if (hist === undefined || hist === null || isNaN(hist)) return 'neutral momentum';
  if (hist > 1) return 'expanding upward buyer momentum';
  if (hist > 0) return 'mild positive buyer momentum';
  if (hist === 0) return 'neutral momentum at the centerline';
  if (hist < -1) return 'accelerating downward selling pressure';
  return 'mild negative momentum bias';
}

@Injectable()
export class FinPilotOrchestrator {
  private readonly logger = new Logger(FinPilotOrchestrator.name);
  private geminiClient: GoogleGenerativeAI | null = null;
  private readonly modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  constructor(
    private readonly prisma: PrismaService,
    private readonly intentDetector: IntentDetectorService,
    private readonly entityResolver: EntityResolverService,
    private readonly toolsService: AiToolsService,
    private readonly validator: AiResponseValidator,
    private readonly marketService: MarketService,
    private readonly crossEngineSynthesisEngine: CrossEngineSynthesisEngine,
    private readonly cryptoMarketService: CryptoMarketService,
  ) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim() !== '' && geminiKey !== 'your-gemini-api-key') {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }
  }

  /**
   * Main Entry Point:
   * Query -> Intent Detection -> Entity Resolution -> Conditional Data Fetching -> Synthesis -> Validation
   */
  async processQuery(
    userId: string,
    message: string,
    symbolContext?: string,
    explanationStyleOverride?: 'BEGINNER' | 'ADVANCED',
  ): Promise<OrchestratorResult> {
    const toolsFired: string[] = [];

    // Resolve explanation style preference: explicit override > user profile in DB > default 'BEGINNER'
    let explanationStyle: 'BEGINNER' | 'ADVANCED' = explanationStyleOverride || 'BEGINNER';
    if (!explanationStyleOverride && userId) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { explanationStyle: true },
        });
        if (user?.explanationStyle) {
          explanationStyle = user.explanationStyle as 'BEGINNER' | 'ADVANCED';
        }
      } catch (err: any) {
        // Fallback to 'BEGINNER' if user lookup fails or in test environments
      }
    }

    // 1. Detect Intent
    const { intent } = await this.intentDetector.detectIntent(message, symbolContext);
    this.logger.log(`[FinPilotOrchestrator] Detected Intent: ${intent} for query: "${message}"`);

    // 2. Resolve Entities against Security Master
    const entities = await this.entityResolver.resolveEntities(message, symbolContext);
    this.logger.log(
      `[FinPilotOrchestrator] Resolved Entities status: ${entities.status}, symbols: [${entities.symbols.join(', ')}]`,
    );

    // 3. Handle Ambiguous Entities (Disambiguation Required)
    if (entities.status === 'AMBIGUOUS') {
      this.logger.log(`[FinPilotOrchestrator] Ambiguous entity detected. Returning disambiguation prompt.`);
      const disambiguationRecommendation: StructuredAiRecommendation = {
        summary: entities.disambiguationPrompt || 'Multiple matching securities were identified. Please clarify your query.',
        technicalAnalysis: 'Technical indicator calculation is on hold pending security selection.',
        fundamentalAnalysis: 'Balance sheet and valuation multiples are on hold pending security selection.',
        positives: [
          `Identified ${entities.matchedEntities?.length || 2} distinct securities matching your input query.`,
          'Precision routing prevents evaluating incorrect tickers or asset classes.',
        ],
        negatives: [
          'Query requires exact ticker or exchange specification to proceed with live data calculation.',
        ],
        riskLevel: 'MEDIUM',
        confidenceScore: 50,
        sources: [
          { type: 'Security Master', description: 'Dual-listing & company alias disambiguation' },
        ],
      };

      const validated = this.validator.validate(disambiguationRecommendation);
      return {
        intent,
        entities,
        toolsFired,
        recommendation: validated.valid ? disambiguationRecommendation : this.validator.createSafeFallback(message),
      };
    }

    // 4. Handle Not Found Entities for Stock-specific queries
    if (
      entities.status === 'NOT_FOUND' &&
      ['STOCK_ANALYSIS', 'TECHNICAL_ANALYSIS', 'FUNDAMENTAL_ANALYSIS', 'STOCK_COMPARISON'].includes(intent)
    ) {
      this.logger.warn(`[FinPilotOrchestrator] Requested stock not found in Security Master.`);
      const notFoundRecommendation: StructuredAiRecommendation = {
        summary: entities.disambiguationPrompt || `The security specified in your query was not located in the official NSE or BSE Security Master.`,
        technicalAnalysis: 'Mathematical chart momentum cannot be evaluated without confirmed exchange market data.',
        fundamentalAnalysis: 'Audited financial filings are unavailable for unverified tickers.',
        positives: ['Security Master verified across 7,270+ active Indian equities.'],
        negatives: ['Unable to retrieve price history or verified exchange disclosures for this symbol.'],
        riskLevel: 'HIGH',
        confidenceScore: 25,
        sources: [{ type: 'Security Master', description: 'NSE & BSE database index scan' }],
      };

      return {
        intent,
        entities,
        toolsFired,
        recommendation: notFoundRecommendation,
      };
    }

    // 5. Conditional Data Fetching based on Detected Intent
    const fetchedData: Record<string, any> = {};
    const sourcesGathered: { type: string; description: string }[] = [];

    const targetSymbol = entities.primarySymbol || (entities.symbols.length > 0 ? entities.symbols[0] : 'TCS.NS');

    const isCrypto =
      entities.primaryAssetType === 'CRYPTO' ||
      entities.assetType === 'CRYPTO' ||
      entities.matchedEntities?.[0]?.assetType === 'CRYPTO' ||
      entities.matchedEntities?.[0]?.exchange === 'COINDCX' ||
      (!targetSymbol.endsWith('.NS') &&
        !targetSymbol.endsWith('.BO') &&
        Boolean(await this.prisma.cryptoAsset.findUnique({ where: { symbol: targetSymbol } })));

    fetchedData.isCrypto = isCrypto;

    // Part D: Fundamental Analysis is explicitly not applicable to cryptocurrency assets
    if (isCrypto && intent === 'FUNDAMENTAL_ANALYSIS') {
      const cryptoAsset = await this.prisma.cryptoAsset.findUnique({ where: { symbol: targetSymbol } });
      const assetName = cryptoAsset?.name || targetSymbol;
      const rec: StructuredAiRecommendation = {
        summary: `Fundamental financial models (DCF, Benjamin Graham Number, Piotroski F-Score) are not applicable to cryptocurrencies like ${assetName} (${targetSymbol}).`,
        technicalAnalysis: `Cryptocurrency evaluation relies on verifiable price momentum, 24/7 liquidity flows, and institutional smart-money concepts (SMC) rather than company balance sheets.`,
        fundamentalAnalysis: `Not applicable to cryptocurrency assets. Decentralized digital protocols do not issue corporate equity shares, statutory P&L filings, dividend policies, or debt-to-equity ratios.`,
        positives: [
          `No corporate solvency or traditional bankruptcy risk.`,
          `Continuous 24/7 global market liquidity.`,
        ],
        negatives: [
          `Traditional value investing multiples (P/E, P/B, ROE) cannot establish an intrinsic price floor.`,
        ],
        riskLevel: 'HIGH',
        confidenceScore: 95,
        sources: [
          { type: 'Asset Class Policy', description: 'Cryptocurrency Valuation Rules: Corporate accounting models excluded' },
        ],
      };
      const validated = this.validator.validate(rec);
      return {
        intent,
        entities,
        toolsFired: ['assetClassPolicy'],
        recommendation: validated.valid ? rec : this.validator.createSafeFallback(message),
      };
    }

    switch (intent) {
      case 'TECHNICAL_ANALYSIS': {
        // ONLY fetch quote, technical indicators, advanced technical models, and market structure. Do NOT fetch fundamentals or news!
        toolsFired.push('getStockQuote', 'getTechnicalIndicators', 'getAdvancedTechnicalAnalysis', 'getMarketStructure');

        // Fetch quote and 1-year OHLCV history snapshot upfront so that basic indicators, advanced models, and market structure share the identical dataset
        const [quoteRes, history] = await Promise.all([
          this.toolsService.executeTool('getStockQuote', { symbol: targetSymbol }, userId),
          isCrypto
            ? this.cryptoMarketService.getHistory(targetSymbol, '1y').then((r) => r.data)
            : this.marketService.getHistory(targetSymbol, '1y'),
        ]);
        const currentPrice = quoteRes.result?.currentPrice || 1000;

        const [indRes, advRes, msRes] = await Promise.all([
          this.toolsService.executeTool('getTechnicalIndicators', { symbol: targetSymbol, history, currentPrice }, userId),
          this.toolsService.executeTool('getAdvancedTechnicalAnalysis', { symbol: targetSymbol, history, currentPrice }, userId),
          this.toolsService.executeTool('getMarketStructure', { symbol: targetSymbol, history, currentPrice }, userId),
        ]);
        fetchedData.quote = quoteRes.result;
        fetchedData.indicators = indRes.result;
        fetchedData.advancedTechnical = advRes.result;
        fetchedData.marketStructure = msRes.result;
        if (quoteRes.sourceRecord) sourcesGathered.push(quoteRes.sourceRecord);
        if (indRes.sourceRecord) sourcesGathered.push(indRes.sourceRecord);
        if (advRes.sourceRecord) sourcesGathered.push(advRes.sourceRecord);
        if (msRes.sourceRecord) sourcesGathered.push(msRes.sourceRecord);
        break;
      }

      case 'FUNDAMENTAL_ANALYSIS': {
        // ONLY fetch quote, raw fundamentals, and fundamental valuation engine. Do NOT fetch technical indicators, market structure, or news!
        toolsFired.push('getStockQuote', 'getFundamentals', 'getFundamentalAnalysis');
        const [quoteRes, fundRes, advFundRes] = await Promise.all([
          this.toolsService.executeTool('getStockQuote', { symbol: targetSymbol }, userId),
          this.toolsService.executeTool('getFundamentals', { symbol: targetSymbol }, userId),
          this.toolsService.executeTool('getFundamentalAnalysis', { symbol: targetSymbol }, userId),
        ]);
        fetchedData.quote = quoteRes.result;
        fetchedData.fundamentals = fundRes.result;
        fetchedData.advancedFundamentals = advFundRes.result;
        if (quoteRes.sourceRecord) sourcesGathered.push(quoteRes.sourceRecord);
        if (fundRes.sourceRecord) sourcesGathered.push(fundRes.sourceRecord);
        if (advFundRes.sourceRecord) sourcesGathered.push(advFundRes.sourceRecord);
        break;
      }

      case 'NEWS_ANALYSIS': {
        // ONLY fetch quote and news intelligence. Do NOT fetch fundamentals or indicators!
        toolsFired.push('getStockQuote', 'getNewsIntelligence');
        const [quoteRes, newsIntelRes] = await Promise.all([
          this.toolsService.executeTool('getStockQuote', { symbol: targetSymbol }, userId),
          this.toolsService.executeTool('getNewsIntelligence', { symbol: targetSymbol }, userId),
        ]);
        fetchedData.quote = quoteRes.result;
        fetchedData.newsIntelligence = newsIntelRes.result;
        if (quoteRes.sourceRecord) sourcesGathered.push(quoteRes.sourceRecord);
        if (newsIntelRes.sourceRecord) sourcesGathered.push(newsIntelRes.sourceRecord);
        break;
      }

      case 'PORTFOLIO_ANALYSIS': {
        // ONLY fetch portfolio analysis and portfolio intelligence. Do NOT fetch stock tools unless holding cross-referenced!
        toolsFired.push('getPortfolioAnalysis', 'getPortfolioIntelligence');
        const [portRes, portIntelRes] = await Promise.all([
          this.toolsService.executeTool('getPortfolioAnalysis', {}, userId),
          this.toolsService.executeTool('getPortfolioIntelligence', {}, userId),
        ]);
        fetchedData.portfolio = portRes.result;
        fetchedData.portfolioIntelligence = portIntelRes.result;
        if (portRes.sourceRecord) sourcesGathered.push(portRes.sourceRecord);
        if (portIntelRes.sourceRecord) sourcesGathered.push(portIntelRes.sourceRecord);
        break;
      }

      case 'STOCK_COMPARISON': {
        // Fetch tools for up to 2 symbols
        const sym1 = entities.symbols[0] || 'TCS.NS';
        const sym2 = entities.symbols[1] || 'INFY.NS';

        const entity1 = entities.matchedEntities?.find(e => e.symbol === sym1);
        const entity2 = entities.matchedEntities?.find(e => e.symbol === sym2);

        const isCrypto1 =
          entity1?.assetType === 'CRYPTO' ||
          entity1?.exchange === 'COINDCX' ||
          (!sym1.endsWith('.NS') && !sym1.endsWith('.BO') && Boolean(await this.prisma.cryptoAsset.findUnique({ where: { symbol: sym1 } })));

        const isCrypto2 =
          entity2?.assetType === 'CRYPTO' ||
          entity2?.exchange === 'COINDCX' ||
          (!sym2.endsWith('.NS') && !sym2.endsWith('.BO') && Boolean(await this.prisma.cryptoAsset.findUnique({ where: { symbol: sym2 } })));

        if (isCrypto1 && isCrypto2) {
          // Both are cryptocurrencies! Route strictly through crypto tool pipeline
          toolsFired.push(
            'getCryptoQuote:1',
            'getCryptoQuote:2',
            'getCryptoTechnicalIndicators:1',
            'getCryptoTechnicalIndicators:2',
            'getCryptoRiskAnalysis:1',
            'getCryptoRiskAnalysis:2',
            'assetClassPolicy',
          );

          const [q1, q2, h1Res, h2Res, btcHistoryRes] = await Promise.all([
            this.toolsService.executeTool('getStockQuote', { symbol: sym1 }, userId),
            this.toolsService.executeTool('getStockQuote', { symbol: sym2 }, userId),
            this.cryptoMarketService.getHistory(sym1, '1y'),
            this.cryptoMarketService.getHistory(sym2, '1y'),
            this.cryptoMarketService.getHistory('BTC', '1y').catch(() => ({ data: [] })),
          ]);

          const h1 = h1Res.data;
          const h2 = h2Res.data;
          const btcH = btcHistoryRes.data;
          const p1 = q1.result?.currentPrice || (h1[h1.length - 1]?.close ?? 100);
          const p2 = q2.result?.currentPrice || (h2[h2.length - 1]?.close ?? 100);

          const [ind1, ind2, r1, r2] = await Promise.all([
            this.toolsService.executeTool('getTechnicalIndicators', { symbol: sym1, history: h1, currentPrice: p1 }, userId),
            this.toolsService.executeTool('getTechnicalIndicators', { symbol: sym2, history: h2, currentPrice: p2 }, userId),
            this.toolsService.executeTool('getRiskAnalysis', { symbol: sym1, history: h1, currentPrice: p1, benchmarkHistory: btcH }, userId),
            this.toolsService.executeTool('getRiskAnalysis', { symbol: sym2, history: h2, currentPrice: p2, benchmarkHistory: btcH }, userId),
          ]);

          fetchedData.comparison = {
            isCryptoComparison: true,
            sym1,
            sym2,
            q1: q1.result,
            q2: q2.result,
            f1: { applicable: false, reason: 'Fundamental valuation models not applicable to cryptocurrencies.' },
            f2: { applicable: false, reason: 'Fundamental valuation models not applicable to cryptocurrencies.' },
            ind1: ind1.result,
            ind2: ind2.result,
            r1: r1.result,
            r2: r2.result,
          };

          if (q1.sourceRecord) sourcesGathered.push(q1.sourceRecord);
          if (q2.sourceRecord) sourcesGathered.push(q2.sourceRecord);
          if (ind1.sourceRecord) sourcesGathered.push(ind1.sourceRecord);
          if (ind2.sourceRecord) sourcesGathered.push(ind2.sourceRecord);
          if (r1.sourceRecord) sourcesGathered.push(r1.sourceRecord);
          if (r2.sourceRecord) sourcesGathered.push(r2.sourceRecord);
          sourcesGathered.push({
            type: 'Asset Class Policy',
            description: 'Fundamentals excluded for cryptocurrency comparisons',
          });
          break;
        }

        // Mixed comparison: one crypto, one equity
        if (isCrypto1 || isCrypto2) {
          toolsFired.push(
            'getStockQuote:1',
            'getStockQuote:2',
            'getTechnicalIndicators:1',
            'getTechnicalIndicators:2',
          );
          const [q1, q2] = await Promise.all([
            this.toolsService.executeTool('getStockQuote', { symbol: sym1 }, userId),
            this.toolsService.executeTool('getStockQuote', { symbol: sym2 }, userId),
          ]);
          const [f1, f2, ind1, ind2] = await Promise.all([
            isCrypto1 ? Promise.resolve({ result: { applicable: false } }) : this.toolsService.executeTool('getFundamentals', { symbol: sym1 }, userId),
            isCrypto2 ? Promise.resolve({ result: { applicable: false } }) : this.toolsService.executeTool('getFundamentals', { symbol: sym2 }, userId),
            this.toolsService.executeTool('getTechnicalIndicators', { symbol: sym1 }, userId),
            this.toolsService.executeTool('getTechnicalIndicators', { symbol: sym2 }, userId),
          ]);
          fetchedData.comparison = {
            isMixedComparison: true,
            sym1,
            sym2,
            isCrypto1,
            isCrypto2,
            q1: q1.result,
            q2: q2.result,
            f1: f1.result,
            f2: f2.result,
            ind1: ind1.result,
            ind2: ind2.result,
          };
          if (q1.sourceRecord) sourcesGathered.push(q1.sourceRecord);
          if (q2.sourceRecord) sourcesGathered.push(q2.sourceRecord);
          if (ind1.sourceRecord) sourcesGathered.push(ind1.sourceRecord);
          if (ind2.sourceRecord) sourcesGathered.push(ind2.sourceRecord);
          break;
        }

        // Standard Equity Comparison (unchanged)
        toolsFired.push(
          'getStockQuote:1',
          'getStockQuote:2',
          'getFundamentals:1',
          'getFundamentals:2',
          'getTechnicalIndicators:1',
          'getTechnicalIndicators:2',
        );
        const [q1, q2, f1, f2, ind1, ind2] = await Promise.all([
          this.toolsService.executeTool('getStockQuote', { symbol: sym1 }, userId),
          this.toolsService.executeTool('getStockQuote', { symbol: sym2 }, userId),
          this.toolsService.executeTool('getFundamentals', { symbol: sym1 }, userId),
          this.toolsService.executeTool('getFundamentals', { symbol: sym2 }, userId),
          this.toolsService.executeTool('getTechnicalIndicators', { symbol: sym1 }, userId),
          this.toolsService.executeTool('getTechnicalIndicators', { symbol: sym2 }, userId),
        ]);
        fetchedData.comparison = { sym1, sym2, q1: q1.result, q2: q2.result, f1: f1.result, f2: f2.result, ind1: ind1.result, ind2: ind2.result };
        if (q1.sourceRecord) sourcesGathered.push(q1.sourceRecord);
        if (q2.sourceRecord) sourcesGathered.push(q2.sourceRecord);
        if (ind1.sourceRecord) sourcesGathered.push(ind1.sourceRecord);
        if (ind2.sourceRecord) sourcesGathered.push(ind2.sourceRecord);
        break;
      }

      case 'MARKET_ANALYSIS': {
        // Macro market overview: Top movers & indices
        toolsFired.push('getTopMovers');
        const topMovers = await this.marketService.getTopMovers();
        fetchedData.market = topMovers;
        sourcesGathered.push({ type: 'Market Data Service', description: 'Live market indices & top movers' });
        break;
      }

      case 'GENERAL_FINANCIAL_QUESTION': {
        // Pure educational / concept question. No equity tools fired.
        sourcesGathered.push({ type: 'System Intelligence', description: 'Financial markets knowledge base' });
        break;
      }

      case 'STOCK_ANALYSIS':
      default: {
        if (isCrypto) {
          // Comprehensive Cryptocurrency Analysis: Quote + Technical + Market Structure + Crypto-calibrated Risk
          toolsFired.push(
            'getStockQuote',
            'getTechnicalIndicators',
            'getAdvancedTechnicalAnalysis',
            'getMarketStructure',
            'getRiskAnalysis',
          );

          const [qRes, history, btcHistoryRes] = await Promise.all([
            this.toolsService.executeTool('getStockQuote', { symbol: targetSymbol }, userId),
            this.cryptoMarketService.getHistory(targetSymbol, '1y').then((r) => r.data),
            this.cryptoMarketService.getHistory('BTC', '1y').then((r) => r.data).catch(() => null),
          ]);
          const currentPrice = qRes.result?.currentPrice || 100;

          const [iRes, advRes, msRes, rRes] = await Promise.all([
            this.toolsService.executeTool('getTechnicalIndicators', { symbol: targetSymbol, history, currentPrice }, userId),
            this.toolsService.executeTool('getAdvancedTechnicalAnalysis', { symbol: targetSymbol, history, currentPrice }, userId),
            this.toolsService.executeTool('getMarketStructure', { symbol: targetSymbol, history, currentPrice }, userId),
            this.toolsService.executeTool('getRiskAnalysis', { symbol: targetSymbol, history, currentPrice, benchmarkHistory: btcHistoryRes }, userId),
          ]);

          fetchedData.quote = qRes.result;
          fetchedData.fundamentals = { applicable: false, status: 'Not applicable to cryptocurrency assets' };
          fetchedData.advancedFundamentals = { applicable: false };
          fetchedData.indicators = iRes.result;
          fetchedData.advancedTechnical = advRes.result;
          fetchedData.marketStructure = msRes.result;
          fetchedData.riskAnalysis = rRes.result;

          if (qRes.sourceRecord) sourcesGathered.push(qRes.sourceRecord);
          if (iRes.sourceRecord) sourcesGathered.push(iRes.sourceRecord);
          if (advRes.sourceRecord) sourcesGathered.push(advRes.sourceRecord);
          if (msRes.sourceRecord) sourcesGathered.push(msRes.sourceRecord);
          if (rRes.sourceRecord) sourcesGathered.push(rRes.sourceRecord);
          sourcesGathered.push({
            type: 'Asset Class Policy',
            description: 'Fundamental analysis skipped for cryptocurrency (Decentralized asset)',
          });
          break;
        }

        // Full comprehensive stock analysis: Quote + Fundamentals + Fundamental Analysis + Indicators + Advanced Technical + Market Structure + Risk Analysis + News Intelligence + Cross-Engine Synthesis
        toolsFired.push(
          'getStockQuote',
          'getFundamentals',
          'getFundamentalAnalysis',
          'getTechnicalIndicators',
          'getAdvancedTechnicalAnalysis',
          'getMarketStructure',
          'getRiskAnalysis',
          'getNewsIntelligence',
          'getCrossEngineSynthesis',
        );

        // Fetch quote and single consistent 1-year OHLCV snapshot upfront so that EVERY indicator in this response shares the identical dataset
        const [qRes, history, benchmarkHistory] = await Promise.all([
          this.toolsService.executeTool('getStockQuote', { symbol: targetSymbol }, userId),
          this.marketService.getHistory(targetSymbol, '1y'),
          this.marketService.getHistory('^NSEI', '1y').catch(() => null),
        ]);
        const currentPrice = qRes.result?.currentPrice || 1000;

        const [fRes, faRes, iRes, advRes, msRes, rRes, nRes] = await Promise.all([
          this.toolsService.executeTool('getFundamentals', { symbol: targetSymbol }, userId),
          this.toolsService.executeTool('getFundamentalAnalysis', { symbol: targetSymbol }, userId),
          this.toolsService.executeTool('getTechnicalIndicators', { symbol: targetSymbol, history, currentPrice }, userId),
          this.toolsService.executeTool('getAdvancedTechnicalAnalysis', { symbol: targetSymbol, history, currentPrice }, userId),
          this.toolsService.executeTool('getMarketStructure', { symbol: targetSymbol, history, currentPrice }, userId),
          this.toolsService.executeTool('getRiskAnalysis', { symbol: targetSymbol, history, currentPrice, benchmarkHistory }, userId),
          this.toolsService.executeTool('getNewsIntelligence', { symbol: targetSymbol }, userId),
        ]);
        fetchedData.quote = qRes.result;
        fetchedData.fundamentals = fRes.result;
        fetchedData.advancedFundamentals = faRes.result;
        fetchedData.indicators = iRes.result;
        fetchedData.advancedTechnical = advRes.result;
        fetchedData.marketStructure = msRes.result;
        fetchedData.riskAnalysis = rRes.result;
        fetchedData.newsIntelligence = nRes.result;
        if (qRes.sourceRecord) sourcesGathered.push(qRes.sourceRecord);
        if (fRes.sourceRecord) sourcesGathered.push(fRes.sourceRecord);
        if (faRes.sourceRecord) sourcesGathered.push(faRes.sourceRecord);
        if (iRes.sourceRecord) sourcesGathered.push(iRes.sourceRecord);
        if (advRes.sourceRecord) sourcesGathered.push(advRes.sourceRecord);
        if (msRes.sourceRecord) sourcesGathered.push(msRes.sourceRecord);
        if (rRes.sourceRecord) sourcesGathered.push(rRes.sourceRecord);
        if (nRes.sourceRecord) sourcesGathered.push(nRes.sourceRecord);

        // Fetch User Portfolio context if authenticated
        let userHolding: any = undefined;
        if (userId) {
          try {
            const holding = await this.prisma.holding.findFirst({
              where: {
                portfolio: { userId },
                stock: { symbol: targetSymbol },
              },
              include: {
                portfolio: {
                  include: {
                    holdings: {
                      include: { stock: true },
                    },
                  },
                },
                stock: true,
              },
            });
            if (holding) {
              const currentPrice = qRes.result?.currentPrice || Number(holding.avgBuyPrice) || 0;
              const currentValue = holding.quantity * currentPrice;
              const totalCost = holding.quantity * Number(holding.avgBuyPrice);
              const unrealizedPnl = currentValue - totalCost;
              const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;
              const totalPortValue = holding.portfolio.holdings.reduce((sum, h) => {
                const hp =
                  h.stock.symbol === targetSymbol
                    ? currentPrice
                    : Number(h.avgBuyPrice);
                return sum + h.quantity * hp;
              }, 0);
              const allocationPercent = totalPortValue > 0 ? (currentValue / totalPortValue) * 100 : 0;
              userHolding = {
                shares: holding.quantity,
                avgPrice: Number(holding.avgBuyPrice),
                currentValue,
                allocationPercent,
                unrealizedPnl,
                unrealizedPnlPercent,
              };
            }
          } catch (e) {
            // Optional portfolio context
          }
        }

        // Run Cross-Engine Synthesis Engine
        const crossEngineRes = this.crossEngineSynthesisEngine.synthesize({
          symbol: targetSymbol,
          quote: qRes.result,
          indicators: iRes.result,
          advancedTechnical: advRes.result,
          marketStructure: msRes.result,
          fundamentals: fRes.result,
          advancedFundamentals: faRes.result,
          riskAnalysis: rRes.result,
          newsIntelligence: nRes.result,
          userHolding,
        });
        fetchedData.crossEngineSynthesis = crossEngineRes;
        sourcesGathered.push({
          type: 'Cross-Engine Synthesis Pipeline',
          description: `Holistic signal alignment & conflict scoring for ${targetSymbol}`,
        });
        break;
      }
    }

    // 6. Handle Missing Market Data for equity-dependent queries
    if (
      ['STOCK_ANALYSIS', 'TECHNICAL_ANALYSIS', 'FUNDAMENTAL_ANALYSIS'].includes(intent) &&
      (!fetchedData.quote || typeof fetchedData.quote.currentPrice !== 'number')
    ) {
      this.logger.warn(`[FinPilotOrchestrator] Market quote unavailable for ${targetSymbol}`);
      const unavailRecommendation: StructuredAiRecommendation = {
        summary: `Live market quote data for ${targetSymbol} is currently unavailable from exchange feeds. Probabilistic analysis requires confirmed live pricing benchmarks.`,
        technicalAnalysis: `Technical momentum indicators require active price history for ${targetSymbol}.`,
        fundamentalAnalysis: `Fundamental balance sheet ratios should be verified directly via exchange disclosures for ${targetSymbol}.`,
        positives: [`Ticker ${targetSymbol} is confirmed in the security master.`],
        negatives: [`Real-time price feed is temporarily unconfirmed by market data provider.`],
        riskLevel: 'HIGH',
        confidenceScore: 30,
        sources: sourcesGathered.length > 0 ? sourcesGathered : [{ type: 'Market Data Service', description: `Live feed status check for ${targetSymbol}` }],
      };
      return {
        intent,
        entities,
        toolsFired,
        recommendation: unavailRecommendation,
      };
    }

    // 7. Synthesis: Synthesize grounded response using conditionally fetched data
    let recommendation: StructuredAiRecommendation;

    if (this.geminiClient) {
      try {
        recommendation = await this.synthesizeWithGemini(message, intent, targetSymbol, fetchedData, sourcesGathered, explanationStyle);
      } catch (err: any) {
        this.logger.warn(`Gemini synthesis failed (${err.message}). Falling back to runGroundedAutonomousPipeline.`);
        recommendation = this.runGroundedAutonomousPipeline(intent, targetSymbol, fetchedData, sourcesGathered, message, explanationStyle);
      }
    } else {
      recommendation = this.runGroundedAutonomousPipeline(intent, targetSymbol, fetchedData, sourcesGathered, message, explanationStyle);
    }

    // 8. Validate through AiResponseValidator
    const validation = this.validator.validate(recommendation);
    if (!validation.valid) {
      this.logger.warn(`Orchestrated recommendation validation failed: ${validation.error}. Falling back to safe fallback.`);
      recommendation = this.validator.createSafeFallback(message, targetSymbol);
    }

    return {
      intent,
      entities,
      toolsFired,
      recommendation,
    };
  }

  /**
   * Grounded autonomous pipeline - no-API-key fallback.
   * Synthesizes probabilistic structured recommendation from conditionally fetched data.
   */
  runGroundedAutonomousPipeline(
    intent: QueryIntent,
    targetSymbol: string,
    data: Record<string, any>,
    sources: { type: string; description: string }[],
    query: string,
    explanationStyle: 'BEGINNER' | 'ADVANCED' = 'BEGINNER',
  ): StructuredAiRecommendation {
    return this.synthesizeAutonomous(intent, targetSymbol, data, sources, query, explanationStyle);
  }

  /**
   * Autonomous grounded synthesis using conditionally fetched data
   */
  private synthesizeAutonomous(
    intent: QueryIntent,
    targetSymbol: string,
    data: Record<string, any>,
    sources: { type: string; description: string }[],
    query: string,
    explanationStyle: 'BEGINNER' | 'ADVANCED' = 'BEGINNER',
  ): StructuredAiRecommendation {
    switch (intent) {
      case 'TECHNICAL_ANALYSIS': {
        const quote = data.quote;
        const ind = data.indicators;
        const adv = data.advancedTechnical as TechnicalEngineResult | undefined;
        const ms = data.marketStructure as MarketStructureResult | undefined;
        const rsiVal = ind?.rsi?.value ?? 50;
        const price = quote?.currentPrice ?? 'N/A';
        const maStatus = ind?.maCrossover?.status === 'BULLISH_ALIGNMENT' ? 'constructive 50/200 MA support' : 'neutral moving averages';
        const rating = adv?.rating ?? 'NEUTRAL';
        const confluence = adv?.confluenceScore ?? 50;
        const atrVal = adv?.atr?.value ?? 0;
        const vwapVal = adv?.vwap?.vwap ?? price;
        const r1 = adv?.supportResistance?.floorPivots?.r1 ?? 'N/A';
        const s1 = adv?.supportResistance?.floorPivots?.s1 ?? 'N/A';

        const activeDemandOb = ms?.activeOrderBlocks?.find((ob) => ob.type === 'BULLISH_DEMAND');
        const activeSupplyOb = ms?.activeOrderBlocks?.find((ob) => ob.type === 'BEARISH_SUPPLY');
        const freshFvg = ms?.unfilledFvgs?.[ms.unfilledFvgs.length - 1];
        const recentSweep = ms?.liquiditySweeps?.[ms.liquiditySweeps.length - 1];

        const summary = `Technical assessment for ${targetSymbol} (trading at ₹${price}) indicates a [CONFLUENCE: ${rating} ${confluence}%] rating with [STRUCTURE: ${ms?.trend ? ms.trend.replace(/_/g, ' ') : 'STABLE'}]. Price action is supported by ${maStatus}, with a 14-day ATR of ₹${atrVal}.`;

        const technicalAnalysis = [
          `**Technical Momentum & Oscillators:** 14-period RSI is currently at ${rsiVal} (${ind?.rsi?.interpretation || 'Neutral momentum'}). The 50-day SMA stands at ₹${ind?.sma50?.value ?? price}, while MACD histogram registers ${ind?.macd?.histogram ?? 0} (${formatMacdMomentum(ind?.macd?.histogram)}). ${adv?.stochastic ? `Stochastic %K is ${adv.stochastic.kValue} and %D is ${adv.stochastic.dValue} (${adv.stochastic.status}).` : ''}`,
          `**Bollinger Band & Volatility Dynamics:** ${adv?.bollingerBands ? `Price trades at %B ${adv.bollingerBands.percentB} within the ₹${adv.bollingerBands.lowerBand} – ₹${adv.bollingerBands.upperBand} Bollinger Band envelope with ${adv.bollingerBands.bandwidthPercent}% bandwidth (${adv.bollingerBands.squeezeStatus}). 14-day ATR volatility benchmark is ₹${atrVal} (${adv.atr.relativeAtrPercent}%), indicating [VOLATILITY: ${adv.atr.volatilityRegime.replace('_', ' ')}]. Dynamic trailing stop buffer is suggested at ₹${adv.atr.stopLossBuffer.recommendedStopPrice} (1.5x ATR).` : 'Volatility metrics reflect baseline consolidation.'}`,
          `**Key Support & Resistance Pivots:** Central Floor Pivot is ₹${adv?.supportResistance?.floorPivots?.pivotPoint ?? price}. Resistance ceiling [R1: ₹${r1}] and primary floor [S1: ₹${s1}] delineate the immediate trading range. Institutional VWAP benchmark stands at ₹${vwapVal} (${adv?.vwap?.bias ? adv.vwap.bias.replace('_', ' ') : 'EQUILIBRIUM'}). ${adv?.multiTimeframe ? `Multi-timeframe trend alignment is ${adv.multiTimeframe.alignment}.` : ''}`,
          `**Institutional Market Structure & Order Flow:** Structure confirms [STRUCTURE: ${ms?.trend ? ms.trend.replace(/_/g, ' ') : 'STABLE'}] (${ms?.lastStructureShift || 'regular swing cycle'}). ${ms?.dealingRange ? `Dealing range bounds are ₹${ms.dealingRange.rangeLow} – ₹${ms.dealingRange.rangeHigh} (50% Equilibrium: ₹${ms.dealingRange.equilibrium}), placing current price in the [ZONE: ${ms.dealingRange.currentZone} ${ms.dealingRange.relativePositionPercent}%] zone.` : ''} ${activeDemandOb ? `Key unmitigated demand Order Block is anchored at [DEMAND OB: ₹${activeDemandOb.low} – ₹${activeDemandOb.high}].` : activeSupplyOb ? `Key unmitigated supply Order Block sits overhead at [SUPPLY OB: ₹${activeSupplyOb.low} – ₹${activeSupplyOb.high}].` : ''} ${freshFvg ? `Unfilled 3-candle Fair Value Gap spans [UNFILLED FVG: ₹${freshFvg.bottom} – ₹${freshFvg.top}].` : ''} ${recentSweep ? recentSweep.interpretation : ''}`,
        ].join('\n\n');

        return {
          summary,
          technicalAnalysis,
          fundamentalAnalysis: data.isCrypto
            ? `Not applicable to cryptocurrency assets. Decentralized digital protocols do not issue corporate equity shares, statutory P&L filings, dividend policies, or debt-to-equity ratios.`
            : `Fundamental balance sheet ratios were omitted for this targeted technical evaluation.`,
          positives: [
            `Technical confluence score of ${confluence}/100 (${rating}) confirms prevailing trend stability.`,
            `Key support floor established at ₹${s1} with VWAP benchmark anchor at ₹${vwapVal}.`,
            ...(ms?.dealingRange?.currentZone === 'DISCOUNT' ? [`Price trades in the institutional DISCOUNT zone (${ms.dealingRange.relativePositionPercent}% of range), presenting asymmetric value.`] : []),
            ...(adv?.keyTakeaways?.slice(0, 1) || [`RSI of ${rsiVal} indicates balanced price action.`]),
          ],
          negatives: [
            `Near-term resistance ceiling at ₹${r1} requires volume expansion to confirm a clean breakout.`,
            `Trailing risk should be managed against the dynamic 1.5x ATR stop buffer (₹${adv?.atr?.stopLossBuffer?.recommendedStopPrice ?? 'N/A'}).`,
            ...(ms?.dealingRange?.currentZone === 'PREMIUM' ? [`Price resides in the institutional PREMIUM zone (${ms.dealingRange.relativePositionPercent}% of range), where smart money frequently reduces exposure.`] : []),
          ],
          riskLevel: adv?.atr?.volatilityRegime === 'HIGH_VOLATILITY' || rsiVal >= 75 || rsiVal <= 25 ? 'HIGH' : 'MEDIUM',
          confidenceScore: Math.min(95, Math.max(60, confluence)),
          sources: sources.length > 0 ? sources : [{ type: 'Institutional Technical Engine', description: `Confluence & structure analysis for ${targetSymbol}` }],
        };
      }

      case 'FUNDAMENTAL_ANALYSIS': {
        const quote = data.quote;
        const fund = data.fundamentals;
        const advFund: FundamentalAnalysisResult | undefined = data.advancedFundamentals;

        const pe = fund?.peRatio ?? 'N/A';
        const pb = fund?.pbRatio ?? 'N/A';
        const roe = fund?.roe ?? 'N/A';
        const roce = fund?.roce ?? 'N/A';
        const eps = fund?.eps ?? 'N/A';
        const debtToEquity = fund?.debtToEquity ?? 'N/A';
        const price = quote?.currentPrice ?? 'N/A';

        const dcfStatus = advFund?.dcf ? `[VALUATION: ${advFund.dcf.valuationStatus} (${advFund.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${advFund.dcf.marginOfSafetyPercent}% MOS)]` : '';
        const piotBadge = advFund?.piotroski ? `[PIOTROSKI: ${advFund.piotroski.score}/9 (${advFund.piotroski.rating})]` : '';
        const ratingBadge = advFund?.overallRating ? `[RATING: ${advFund.overallRating}]` : '';

        const summary = `Audited fundamental audit for ${targetSymbol} (trading at ₹${price}) indicates a ${ratingBadge} assessment. Intrinsic equity valuation reflects ${dcfStatus} alongside balance sheet integrity scored at ${piotBadge}.`;

        const dcfText = advFund?.dcf
          ? `**Intrinsic Valuation & DCF Model:** Two-stage discounted cash flow model establishes an equity fair value benchmark of ₹${advFund.dcf.intrinsicValue} per share (discount rate 11.0%, terminal growth 5.0%). Relative to current price (₹${price}), this yields a Margin of Safety of ${advFund.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${advFund.dcf.marginOfSafetyPercent}%, classifying the equity as ${advFund.dcf.valuationStatus}. Projected 5-year cash flows reflect compounding from initial base owner earnings.`
          : `**Intrinsic Valuation & DCF Model:** Intrinsic DCF modeling requires positive earnings history.`;

        const grahamText = advFund?.graham?.grahamNumber
          ? `**Graham Number & Defensive Value:** Benjamin Graham defensive value formula (sqrt(22.5 * EPS * BVPS)) yields ₹${advFund.graham.grahamNumber} per share (Book Value Per Share: ₹${advFund.graham.bvps}, EPS: ₹${eps}). Current price trades at [GRAHAM: ${advFund.graham.valuationStatus} (${(advFund.graham.premiumOrDiscountPercent || 0) >= 0 ? '+' : ''}${advFund.graham.premiumOrDiscountPercent}%)].`
          : `**Graham Number & Defensive Value:** Graham defensive valuation is not applicable due to negative or unlisted parameters.`;

        const piotText = advFund?.piotroski
          ? `**Piotroski Financial Health:** Balance sheet and earnings diagnostic registers ${piotBadge}. Evaluation breakdown confirms Profitability: ${advFund.piotroski.profitabilityScore}/4, Solvency & Leverage: ${advFund.piotroski.leverageScore}/3, Operating Efficiency: ${advFund.piotroski.operatingEfficiencyScore}/2.`
          : `**Piotroski Financial Health:** Balance sheet filings reflect standard operating compliance.`;

        const efficiencyText = `**Capital Efficiency & Capital Structure:** Operating Return on Capital Employed (ROCE) is ${roce}% and Return on Equity (ROE) stands at ${roe}%. Financial leverage is anchored by a Debt-to-Equity ratio of ${debtToEquity}x [LEVERAGE: ${typeof debtToEquity === 'number' && debtToEquity <= 0.5 ? 'CONSERVATIVE' : 'MODERATE'}].`;

        const sectorText = advFund?.sectorBenchmark
          ? `**Sector Valuation Multiples (Market Reference Baseline):** Audited P/E multiple of ${pe}x trades at [BENCHMARK: ${advFund.sectorBenchmark.peComparison} (${advFund.sectorBenchmark.peVariancePercent >= 0 ? '+' : ''}${advFund.sectorBenchmark.peVariancePercent}%)] relative to the ${advFund.sectorBenchmark.sector} general market reference baseline of ${advFund.sectorBenchmark.medianPe}x. P/B multiple is ${pb}x versus market reference baseline of ${advFund.sectorBenchmark.medianPb}x.`
          : `**Sector Valuation Multiples (Market Reference Baseline):** General market reference baseline multiples confirm standard industry alignment.`;

        const fundamentalAnalysis = `${dcfText}\n\n${grahamText}\n\n${piotText}\n\n${efficiencyText}\n\n${sectorText}`;

        const positives = advFund?.strengths && advFund.strengths.length > 0
          ? advFund.strengths
          : [
              `Return on Equity of ${roe}% demonstrates disciplined capital deployment.`,
              `Debt-to-Equity ratio of ${debtToEquity} reflects manageable leverage risk.`,
            ];

        const negatives = advFund?.weaknesses && advFund.weaknesses.length > 0
          ? advFund.weaknesses
          : [
              `Valuation at ${pe}x P/E relies on ongoing quarterly earnings execution.`,
              `Macroeconomic interest rate cycles may impact sector valuations.`,
            ];

        return {
          summary,
          technicalAnalysis: `Technical indicator calculations were omitted for this targeted fundamental and valuation review.`,
          fundamentalAnalysis,
          positives,
          negatives,
          riskLevel: advFund?.riskLevel || ((typeof pe === 'number' && pe > 50) || (typeof debtToEquity === 'number' && debtToEquity > 1.5) ? 'HIGH' : 'MEDIUM'),
          confidenceScore: advFund?.confidenceScore || 87,
          sources: sources.length > 0 ? sources : [{ type: 'Fundamental Valuation Engine', description: `Valuation and financial health for ${targetSymbol}` }],
        };
      }

      case 'PORTFOLIO_ANALYSIS': {
        const p = data.portfolio;
        const pi = data.portfolioIntelligence as PortfolioIntelligenceResult | undefined;
        const divScore = pi?.diversificationScore ?? p?.diversificationScore ?? 65;
        const val = pi?.totalValue ?? p?.currentValue ?? 0;
        const count = pi?.holdingsCount ?? p?.holdingsCount ?? 0;
        const totalProfit = pi?.totalProfit ?? p?.totalProfit ?? 0;
        const totalProfitPct = pi?.totalProfitPercent ?? p?.totalProfitPercent ?? 0;

        const top = pi?.topContributors?.[0];
        const worst = pi?.worstContributors?.[0];
        const topText = top
          ? `Primary P&L driver is **${top.symbol}**, generating +₹${top.totalReturn.toLocaleString('en-IN')} (+${top.totalReturnPercent}%, representing ${top.contributionToPortfolioPnlPercent}% of net gains).`
          : 'Holding contribution data is balancing across active positions.';
        const worstText = worst && worst.symbol !== top?.symbol
          ? `Greatest return drag stems from **${worst.symbol}** (${worst.totalReturn < 0 ? '-' : '+'}₹${Math.abs(worst.totalReturn).toLocaleString('en-IN')}, ${worst.totalReturnPercent}%).`
          : '';

        const concentrationRisk = pi?.concentrationAnalysis?.hasConcentrationRisk;
        const concentrationText = concentrationRisk
          ? `Concentration alert triggered: ${[
              ...(pi?.concentrationAnalysis.holdingAlerts.map((a) => a.message) || []),
              ...(pi?.concentrationAnalysis.sectorAlerts.map((a) => a.message) || []),
            ].join(' ')}`
          : 'Concentration is comfortably balanced with no single holding or sector exceeding the 25% threshold.';

        const corrStatus = pi?.correlationMatrix?.status;
        const avgCorr = pi?.correlationMatrix?.averageCorrelation;
        const corrText =
          corrStatus === 'SINGLE_HOLDING' || corrStatus === 'EMPTY_PORTFOLIO'
            ? pi.correlationMatrix.statusMessage
            : avgCorr !== null && avgCorr !== undefined
            ? `Average pairwise return correlation between holdings is ${avgCorr} (${avgCorr > 0.6 ? 'elevated co-movement risk' : 'sound non-correlated diversification'}).`
            : pi?.correlationMatrix?.statusMessage || 'Pairwise correlation analysis requires minimum 30 trading days of aligned price history.';

        return {
          summary: `Your active portfolio comprises ${count} registered position(s) with an aggregate valuation of ₹${val.toLocaleString('en-IN')} (Net P&L: ${totalProfit >= 0 ? '+' : '-'}₹${Math.abs(totalProfit).toLocaleString('en-IN')}, ${totalProfitPct}%). Mathematical Herfindahl diversification score registers at [DIVERSIFICATION: ${divScore}/100].`,
          technicalAnalysis: [
            `**Holding Contribution & P&L Attribution:** ${topText} ${worstText}`,
            `**Constituent Co-Movement & Correlation:** ${corrText}`,
          ].join('\n\n'),
          fundamentalAnalysis: [
            `**Sector Allocation & Diversification:** Sector distribution is led by ${p?.sectorAllocation?.[0]?.sector || 'Diversified Equities'} (${p?.sectorAllocation?.[0]?.percentage || 100}%), across ${p?.sectorAllocation?.length || 1} distinct industries.`,
            `**Concentration Diagnostics:** ${concentrationText}`,
          ].join('\n\n'),
          positives: [
            `Active tracking across ${count} registered holding position(s).`,
            `Diversification score of ${divScore}/100 provides measurable concentration oversight.`,
            ...(top ? [`Top contributor ${top.symbol} delivered +₹${top.totalReturn.toLocaleString('en-IN')} (+${top.totalReturnPercent}% return).`] : []),
            ...(!concentrationRisk ? ['No single position or sector exceeds the 25% concentration risk threshold.'] : []),
          ],
          negatives: [
            ...(concentrationRisk ? ['Portfolio concentration exceeds the 25% ceiling in primary positions or sectors.'] : []),
            divScore < 60 ? 'Portfolio diversification score is below recommended multi-sector thresholds.' : 'Market volatility impacts overall equity valuation.',
            'Discretionary equity positions should be rebalanced periodically against target allocations.',
          ],
          riskLevel: concentrationRisk || divScore < 50 ? 'HIGH' : divScore < 75 ? 'MEDIUM' : 'LOW',
          confidenceScore: 92,
          sources: sources.length > 0 ? sources : [{ type: 'Portfolio Intelligence Engine', description: 'User portfolio analysis' }],
        };
      }

      case 'STOCK_COMPARISON': {
        const comp = data.comparison;
        const s1 = comp?.sym1 || 'Asset 1';
        const s2 = comp?.sym2 || 'Asset 2';
        const p1 = comp?.q1?.currentPrice ?? 'N/A';
        const p2 = comp?.q2?.currentPrice ?? 'N/A';
        const ch1 = comp?.q1?.changePercent !== undefined ? `${comp.q1.changePercent > 0 ? '+' : ''}${comp.q1.changePercent}%` : 'N/A';
        const ch2 = comp?.q2?.changePercent !== undefined ? `${comp.q2.changePercent > 0 ? '+' : ''}${comp.q2.changePercent}%` : 'N/A';
        const rsi1 = comp?.ind1?.rsi?.value ?? 50;
        const rsi2 = comp?.ind2?.rsi?.value ?? 50;
        const rsi1Interp = comp?.ind1?.rsi?.interpretation || 'neutral';
        const rsi2Interp = comp?.ind2?.rsi?.interpretation || 'neutral';

        if (comp?.isCryptoComparison) {
          const vol1 = comp?.r1?.volatility?.annualizedVolatilityPercent;
          const vol2 = comp?.r2?.volatility?.annualizedVolatilityPercent;

          return {
            summary: `Comparative evaluation of ${s1} (₹${p1}, ${ch1} 24h) versus ${s2} (₹${p2}, ${ch2} 24h) demonstrates divergence in decentralized momentum and volatility structures across both digital assets.`,
            technicalAnalysis: `${s1} registers RSI at ${rsi1} (${rsi1Interp}) with 50-day SMA at ₹${comp?.ind1?.sma50?.value ?? 'N/A'}, whereas ${s2} displays RSI at ${rsi2} (${rsi2Interp}) with 50-day SMA at ₹${comp?.ind2?.sma50?.value ?? 'N/A'}. Momentum: ${comp?.ind1?.macd?.histogram !== undefined ? (comp.ind1.macd.histogram >= 0 ? 'bullish' : 'bearish') : 'neutral'} on ${s1} vs ${comp?.ind2?.macd?.histogram !== undefined ? (comp.ind2.macd.histogram >= 0 ? 'bullish' : 'bearish') : 'neutral'} on ${s2}.`,
            fundamentalAnalysis: `Not applicable to cryptocurrency assets. Decentralized digital protocols do not issue corporate equity shares, statutory P&L filings, dividend policies, or debt-to-equity ratios.`,
            positives: [
              `${s1}: 24h liquidity flow at ₹${p1} (${ch1}) with active market participation.`,
              `${s2}: Trading at ₹${p2} (${ch2}) with distinct network adoption dynamics.`,
            ],
            negatives: [
              `High annualized crypto volatility (${s1}: ${vol1 ? vol1 + '%' : 'elevated'}, ${s2}: ${vol2 ? vol2 + '%' : 'elevated'}).`,
              'Cryptocurrency assets are subject to macro market beta risk and 24/7 liquidity swings.',
            ],
            riskLevel: 'HIGH',
            confidenceScore: 90,
            sources: sources.length > 0 ? sources : [{ type: 'CoinDCX Crypto Market Data', description: `Crypto comparison between ${s1} and ${s2}` }],
          };
        }

        if (comp?.isMixedComparison) {
          return {
            summary: `Cross-asset class comparison between ${comp.isCrypto1 ? 'cryptocurrency' : 'equity'} ${s1} (₹${p1}) and ${comp.isCrypto2 ? 'cryptocurrency' : 'equity'} ${s2} (₹${p2}).`,
            technicalAnalysis: `${s1} RSI is ${rsi1} (${rsi1Interp}), compared to ${s2} RSI at ${rsi2} (${rsi2Interp}).`,
            fundamentalAnalysis: `${comp.isCrypto1 ? `${s1}: Fundamentals not applicable (crypto).` : `${s1}: P/E ${comp?.f1?.peRatio ?? 'N/A'}x.`} ${comp.isCrypto2 ? `${s2}: Fundamentals not applicable (crypto).` : `${s2}: P/E ${comp?.f2?.peRatio ?? 'N/A'}x.`}`,
            positives: [
              `${s1}: Current valuation ₹${p1}.`,
              `${s2}: Current valuation ₹${p2}.`,
            ],
            negatives: [
              'Comparing equities and cryptocurrencies spans fundamentally different liquidity, regulatory, and valuation frameworks.',
            ],
            riskLevel: 'HIGH',
            confidenceScore: 85,
            sources: sources.length > 0 ? sources : [{ type: 'Multi-Asset Market Data', description: `Cross-asset comparison between ${s1} and ${s2}` }],
          };
        }

        const pe1 = comp?.f1?.peRatio ?? 'N/A';
        const pe2 = comp?.f2?.peRatio ?? 'N/A';

        return {
          summary: `Comparative evaluation of ${s1} (₹${p1}) versus ${s2} (₹${p2}) reflects distinct valuation multiples and technical momentum setups across both Indian enterprise leaders.`,
          technicalAnalysis: `${s1} records RSI at ${rsi1} (${rsi1Interp}), while ${s2} registers RSI at ${rsi2} (${rsi2Interp}).`,
          fundamentalAnalysis: `${s1} trades at a P/E multiple of ${pe1}x (ROE: ${comp?.f1?.roe ?? 'N/A'}%), compared to ${s2} trading at ${pe2}x (ROE: ${comp?.f2?.roe ?? 'N/A'}%).`,
          positives: [
            `${s1}: Established balance sheet strength with P/E multiple of ${pe1}x.`,
            `${s2}: Competitive positioning with live price action of ₹${p2}.`,
          ],
          negatives: [
            'Both equities face sector-specific macroeconomic cycles.',
            'Discretionary corporate spending trends may impact comparative growth.',
          ],
          riskLevel: 'MEDIUM',
          confidenceScore: 88,
          sources: sources.length > 0 ? sources : [{ type: 'Market Data Service', description: `Comparison between ${s1} and ${s2}` }],
        };
      }

      case 'NEWS_ANALYSIS': {
        const ni = data.newsIntelligence as NewsIntelligenceResult | undefined;
        const articles = ni?.articles || data.news?.articles || [];
        const topArticle = articles[0];
        const quote = data.quote;

        const isMock = ni?.status === 'MOCK_DATA';
        const isUnavailable = ni?.status === 'UNAVAILABLE_DATA' || articles.length === 0;

        let newsNarrative = '';
        if (isUnavailable) {
          newsNarrative = `No verified financial news articles were retrieved for ${targetSymbol} from active exchange feeds.`;
        } else if (isMock) {
          newsNarrative = `News feed reflects fallback demo items (${ni?.totalRawArticles || 0} items, Provider: mock). Verified live sentiment analysis is withheld per data integrity rules.`;
        } else {
          newsNarrative = `Analyzed ${ni?.uniqueArticlesCount} unique financial news stories (${ni?.duplicatesRemovedCount} near-duplicate headlines merged across multi-outlet coverage). Top headline: "${topArticle?.title}" (${topArticle?.source}). Recency decay weighting (half-life 3d) establishes a [SENTIMENT: ${ni?.temporalWeighting.weightedSentiment}] bias (score: ${ni?.temporalWeighting.weightedScore ? (ni.temporalWeighting.weightedScore > 0 ? '+' : '') + ni.temporalWeighting.weightedScore : '0.00'}).`;
        }

        const directHeadlines = articles
          .filter((a) => a.relevanceTier === 'DIRECT')
          .slice(0, 3)
          .map((a) => `• "${a.title}" — *${a.source}* (${a.sentiment})`)
          .join('\n');

        // Risk Level reflects genuine news sentiment risks (e.g. bearish headlines), NOT whether the data feed is mock!
        const newsRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
          ni?.temporalWeighting.weightedSentiment === 'BEARISH'
            ? 'HIGH'
            : ni?.temporalWeighting.weightedSentiment === 'BULLISH'
            ? 'LOW'
            : 'MEDIUM';

        const dataConfidence: 'VERIFIED_LIVE' | 'FALLBACK_MOCK' | 'UNAVAILABLE' =
          isUnavailable ? 'UNAVAILABLE' : isMock ? 'FALLBACK_MOCK' : 'VERIFIED_LIVE';

        const confidenceScore = isUnavailable ? 20 : isMock ? 50 : 88;

        const summary = isMock
          ? `Market media tracking for ${targetSymbol} reflects [NEWS SENTIMENT: ${ni?.temporalWeighting.weightedSentiment || 'NEUTRAL'}] [DATA FEED: UNVERIFIED MOCK (Data Confidence: 50%)]. Live exchange media verification is pending API key configuration.`
          : `Market media analysis for ${targetSymbol} (trading at ₹${quote?.currentPrice ?? 'N/A'}, ${quote?.changePercent ?? 0}%) reflects [NEWS SENTIMENT: ${ni?.temporalWeighting.weightedSentiment || 'NEUTRAL'}] [DATA FEED: VERIFIED LIVE]. Distribution: ${ni?.sentimentDistribution.positivePercentage || 0}% positive, ${ni?.sentimentDistribution.neutralPercentage || 0}% neutral, ${ni?.sentimentDistribution.negativePercentage || 0}% negative.`;

        return {
          summary,
          technicalAnalysis: `Technical momentum calculations were omitted for this targeted news intelligence feed.`,
          fundamentalAnalysis: [
            `**News Coverage & Relevance Breakdown:** ${newsNarrative}`,
            ...(directHeadlines ? [`**Direct Company Headlines:**\n${directHeadlines}`] : []),
          ].join('\n\n'),
          positives: [
            `Financial media coverage tracking active for ${targetSymbol}.`,
            ...(ni?.sentimentDistribution.positiveCount ? [`${ni.sentimentDistribution.positiveCount} constructive developmental disclosures indexed.`] : []),
            ...(ni?.temporalWeighting.weightedSentiment === 'BULLISH' ? ['Recent news flow carries constructive operational sentiment.'] : []),
          ],
          negatives: [
            ...(isMock ? ['Data Confidence Notice: The active news feed is utilizing synthetic mock fallback data (Data Confidence: 50%). This flags unverified feed status rather than elevated equity investment risk.'] : []),
            'Headline volatility can cause transient intraday price deviations.',
            'Media reports must be verified against formal exchange regulatory filings.',
          ],
          riskLevel: newsRiskLevel,
          confidenceScore,
          dataConfidence,
          sources: sources.length > 0 ? sources : [{ type: 'News Intelligence Engine', description: `News intelligence for ${targetSymbol}` }],
        };
      }

      case 'MARKET_ANALYSIS': {
        const movers = data.market;
        const gainers = movers?.gainers || [];
        const topG = gainers[0] ? `${gainers[0].symbol} (+${gainers[0].changePercent}%)` : 'NIFTY leaders';

        return {
          summary: `Indian benchmark indices reflect active trading across broader market sectors today. Leading top gainers include ${topG}, accompanied by steady participation across large-cap equities.`,
          technicalAnalysis: `Market breadth is supported by positive momentum across key index constituents.`,
          fundamentalAnalysis: `Sector valuations reflect steady domestic macroeconomic growth figures.`,
          positives: [
            `Broad market liquidity and institutional participation across NSE and BSE.`,
            `Constructive price action across primary benchmark sectors.`,
          ],
          negatives: [
            'Global macroeconomic interest rate sentiment may trigger intraday index swings.',
            'Volatility can impact speculative momentum assets.',
          ],
          riskLevel: 'MEDIUM',
          confidenceScore: 86,
          sources: sources.length > 0 ? sources : [{ type: 'Market Data Service', description: 'Top movers & market indices' }],
        };
      }

      case 'GENERAL_FINANCIAL_QUESTION': {
        return {
          summary: `FinPilot AI provides educational explanations for financial markets, investing principles, and portfolio risk. For asset-specific data, mention any NSE or BSE ticker (e.g. TCS.NS or BLUEJET.BO).`,
          technicalAnalysis: `Technical analysis involves evaluating historical price action, moving averages (SMA/EMA), RSI, and volume trends to identify probabilistic trading zones.`,
          fundamentalAnalysis: `Fundamental analysis examines audited financial statements, valuation multiples (P/E, P/B), capital efficiency (ROE, ROCE), and debt obligations.`,
          positives: [
            'Clear conceptual framework for risk-adjusted investing.',
            'Data-backed tools available for live validation on Indian equities.',
          ],
          negatives: [
            'General concepts must be adapted to individual risk tolerance and horizon.',
          ],
          riskLevel: 'LOW',
          confidenceScore: 92,
          sources: [{ type: 'System Intelligence', description: 'Financial markets educational knowledge base' }],
        };
      }

      case 'STOCK_ANALYSIS':
      default: {
        const quote = data.quote;
        const fund = data.fundamentals;
        const advFund = data.advancedFundamentals as FundamentalAnalysisResult | undefined;
        const ind = data.indicators;
        const adv = data.advancedTechnical as TechnicalEngineResult | undefined;
        const ms = data.marketStructure as MarketStructureResult | undefined;
        const risk = data.riskAnalysis as RiskAnalysisResult | undefined;
        const newsIntel = data.newsIntelligence as NewsIntelligenceResult | undefined;
        const cs = data.crossEngineSynthesis as CrossEngineSynthesisResult | undefined;

        const isBeginner = explanationStyle === 'BEGINNER';
        const rsiVal = ind?.rsi?.value ?? 50;
        const peVal = fund?.peRatio ?? 'N/A';
        const price = quote?.currentPrice ?? 'N/A';
        const rating = adv?.rating ?? 'NEUTRAL';
        const confluence = adv?.confluenceScore ?? 50;
        const riskScore = risk?.compositeRiskScore.score ?? 50;
        const riskLevel =
          cs?.signals.risk.label === 'AGGRESSIVE_ELEVATED'
            ? 'HIGH'
            : cs?.signals.risk.label === 'DEFENSIVE_FAVORABLE'
            ? 'LOW'
            : (risk?.compositeRiskScore.riskLevel || 'MEDIUM');

        const newsSection = newsIntel
          ? newsIntel.status === 'MOCK_DATA'
            ? isBeginner
              ? `Recent news flow relies on demonstration sample items (Provider: mock). Live sentiment analysis is paused per strict data verification rules.`
              : `Media sentiment reflects fallback demo items (Provider: mock). Live sentiment analytics withheld per zero-fabrication rules.`
            : isBeginner
            ? `Media coverage across ${newsIntel.uniqueArticlesCount} distinct stories (${newsIntel.duplicatesRemovedCount} duplicate headlines merged) shows an overall [NEWS: ${newsIntel.temporalWeighting.weightedSentiment}] tone (${newsIntel.sentimentDistribution.positivePercentage}% positive, ${newsIntel.sentimentDistribution.neutralPercentage}% neutral, ${newsIntel.sentimentDistribution.negativePercentage}% negative).`
            : `Media coverage across ${newsIntel.uniqueArticlesCount} unique stories (${newsIntel.duplicatesRemovedCount} duplicates merged) exhibits a [NEWS: ${newsIntel.temporalWeighting.weightedSentiment}] bias (distribution: ${newsIntel.sentimentDistribution.positivePercentage}% positive, ${newsIntel.sentimentDistribution.neutralPercentage}% neutral, ${newsIntel.sentimentDistribution.negativePercentage}% negative).`
          : isBeginner
          ? 'News media sentiment indicators are currently unavailable for this session.'
          : 'Media sentiment indicators unavailable for this session.';

        // Synthesize dynamic risk metrics directly into Positives & Negatives:
        const riskNegatives: string[] = [];
        if (risk?.volatility?.interpretation === 'HIGH' || (risk?.volatility?.annualizedVolatilityPercent && risk.volatility.annualizedVolatilityPercent > 30)) {
          riskNegatives.push(
            isBeginner
              ? `Elevated price swings: 60-day volatility of ${risk.volatility.annualizedVolatilityPercent}% reflects larger than usual short-term price movements.`
              : `Elevated price volatility: 60-day annualized volatility of ${risk.volatility.annualizedVolatilityPercent}% reflects substantial price swings and heightened short-term fluctuations.`,
          );
        }
        if (risk?.beta?.value !== null && risk?.beta?.value !== undefined && (risk.beta.interpretation === 'AGGRESSIVE' || risk.beta.value > 1.2)) {
          riskNegatives.push(
            isBeginner
              ? `Market sensitivity: Beta of ${risk.beta.value} vs NIFTY 50 means this stock tends to move more than the overall market — when the market swings, this stock usually swings more in the same direction.`
              : `Aggressive market sensitivity: Beta of ${risk.beta.value} vs NIFTY 50 indicates high market co-movement, amplifying broader market drawdowns.`,
          );
        }
        if (risk?.maxDrawdown?.drawdownPercent !== null && risk?.maxDrawdown?.drawdownPercent !== undefined && risk.maxDrawdown.drawdownPercent <= -10) {
          riskNegatives.push(
            isBeginner
              ? `Recent pullback: 60-day maximum price drop reached ${risk.maxDrawdown.drawdownPercent}% (falling from ₹${risk.maxDrawdown.peakPrice} to ₹${risk.maxDrawdown.troughPrice} before steadying).`
              : `Drawdown vulnerability: 60-day maximum drawdown reached ${risk.maxDrawdown.drawdownPercent}% (peak ₹${risk.maxDrawdown.peakPrice} to trough ₹${risk.maxDrawdown.troughPrice}).`,
          );
        }
        if (risk && risk.compositeRiskScore.score > 60) {
          riskNegatives.push(
            isBeginner
              ? `Overall composite risk score of ${risk.compositeRiskScore.score}/100 indicates higher overall investment risk.`
              : `Composite risk score of ${risk.compositeRiskScore.score}/100 indicates elevated overall asset risk.`,
          );
        }

        const riskPositives: string[] = [];
        if (risk?.volatility?.interpretation === 'LOW') {
          riskPositives.push(
            isBeginner
              ? `Calm price profile: 60-day volatility of ${risk.volatility.annualizedVolatilityPercent}% demonstrates steady, calm price stability.`
              : `Defensive volatility profile: 60-day annualized volatility of ${risk.volatility.annualizedVolatilityPercent}% demonstrates calm price stability.`,
          );
        }
        if (risk?.beta?.value !== null && risk?.beta?.value !== undefined && risk.beta.value <= 1.05 && risk.beta.value >= 0.7) {
          riskPositives.push(
            isBeginner
              ? `Balanced market co-movement: Beta of ${risk.beta.value} reflects stable movement alongside the market without wild price swings.`
              : `Balanced market co-movement: Beta of ${risk.beta.value} reflects stable index-correlated participation without extreme beta swings.`,
          );
        }
        if (risk?.maxDrawdown?.recoveryStatus === 'RECOVERED') {
          riskPositives.push(
            isBeginner
              ? `Pullback resilience: The stock has fully bounced back from its recent 60-day maximum drop (${risk.maxDrawdown.drawdownPercent}%).`
              : `Historical drawdown resilience: Asset has fully recovered from its 60-day maximum drawdown (${risk.maxDrawdown.drawdownPercent}%).`,
          );
        }
        if (risk && risk.compositeRiskScore.score <= 40) {
          riskPositives.push(
            isBeginner
              ? `Cautious composite risk score of ${risk.compositeRiskScore.score}/100 reflects low historical price drop severity.`
              : `Conservative composite risk score of ${risk.compositeRiskScore.score}/100 reflects low historical drawdown severity.`,
          );
        }

        const isRiskQuery =
          query.toUpperCase().includes('RISK') ||
          query.toUpperCase().includes('VOLATILITY') ||
          query.toUpperCase().includes('DRAWDOWN') ||
          query.toUpperCase().includes('BETA') ||
          query.toUpperCase().includes('VAR');

        const alignmentBadge = cs ? `[SIGNAL ALIGNMENT: ${cs.signalAlignment.replace(/_/g, ' ')}]` : `[CONFLUENCE: ${rating} ${confluence}%]`;
        const conflictBadge = cs ? `[CONFLICT SCORE: ${cs.conflictScore}/100]` : '';
        const netConfluenceBadge = cs ? `[UNIFIED CONFLUENCE: ${cs.confluenceScore}/100]` : `[CONFLUENCE: ${confluence}%]`;
        const riskScoreBadge = `[RISK: ${riskLevel} (${riskScore}/100)]`;

        const summary = isBeginner
          ? cs
            ? `Here is your plain-English overview for ${targetSymbol} (currently trading at ₹${price}, ${quote?.changePercent ?? 0}%). Our systems check both the stock's price chart and the company's financial records [SIGNAL ALIGNMENT: ${cs.signalAlignment.replace(/_/g, ' ')}]. Disagreement between the two signals is very low [CONFLICT SCORE: ${cs.conflictScore}/100], giving strong overall confidence [UNIFIED CONFLUENCE: ${cs.confluenceScore}/100]. Directional indicators show constructive price momentum [TECH: ${cs.signals.technical.label} (${cs.signals.technical.score > 0 ? '+' : ''}${cs.signals.technical.score})], strong underlying business health [FUND: ${cs.signals.fundamental.label} (${cs.signals.fundamental.score > 0 ? '+' : ''}${cs.signals.fundamental.score})], and a balanced overall risk profile [RISK: ${riskLevel} (${riskScore}/100)]. The stock's price movements and company profits are telling the same encouraging story.`
            : `Here is your plain-English overview for ${targetSymbol} (currently trading at ₹${price}, ${quote?.changePercent ?? 0}%). The stock shows balanced technical health [CONFLUENCE: ${rating} ${confluence}%] and a manageable risk level [RISK: ${riskLevel} (${riskScore}/100)], supported by ${ind?.maCrossover?.status === 'BULLISH_ALIGNMENT' ? 'steady buyer demand over recent months' : 'stable day-to-day trading'}.`
          : cs
          ? `Comprehensive cross-engine evaluation for ${targetSymbol} (trading at ₹${price}, ${quote?.changePercent ?? 0}%) establishes a ${alignmentBadge} with ${conflictBadge} and ${netConfluenceBadge}. Directional vectors reflect [TECH: ${cs.signals.technical.label} (${cs.signals.technical.score > 0 ? '+' : ''}${cs.signals.technical.score})], [FUND: ${cs.signals.fundamental.label} (${cs.signals.fundamental.score > 0 ? '+' : ''}${cs.signals.fundamental.score})], and ${riskScoreBadge}. ${cs.technicalFundamentalAlignment.narrative}`
          : `Comprehensive evaluation of ${targetSymbol} (trading at ₹${price}, ${quote?.changePercent ?? 0}%) reflects [CONFLUENCE: ${rating} ${confluence}%] positioning and ${riskScoreBadge}, supported by ${ind?.maCrossover?.status === 'BULLISH_ALIGNMENT' ? 'constructive moving average alignment' : 'balanced price consolidation'}.`;

        const crossEngineTechSection = cs
          ? isBeginner
            ? `**Cross-Engine Momentum & Tactical Playbook:** The suggested approach is [TACTICAL BIAS: ${cs.tacticalPlaybook.bias}], meaning buying thoughtfully on minor pullbacks. Watch the ₹${cs.tacticalPlaybook.keySupportToDefend} floor for protection, and look for a breakout above the ₹${cs.tacticalPlaybook.keyResistanceToBreak} ceiling. A protective safety exit (trailing stop loss) is pegged at ₹${cs.tacticalPlaybook.trailingStopLoss} (1.5x ATR). Suggested plan: ${cs.tacticalPlaybook.suggestedCondition}`
            : `**Cross-Engine Momentum & Tactical Playbook:** Tactical stance is classified as [TACTICAL BIAS: ${cs.tacticalPlaybook.bias}]. Defend immediate support floor at ₹${cs.tacticalPlaybook.keySupportToDefend} and monitor overhead resistance ceiling at ₹${cs.tacticalPlaybook.keyResistanceToBreak}. Trailing stop loss buffer is pegged at ₹${cs.tacticalPlaybook.trailingStopLoss} (1.5x ATR). Playbook condition: ${cs.tacticalPlaybook.suggestedCondition}`
          : '';

        const crossEngineFundSection = cs
          ? isBeginner
            ? `**Cross-Engine Signal Alignment & Conflict Reasoning:** Comparing the stock's price chart to its audited financial statements shows very low disagreement (Conflict Score: ${cs.conflictScore}/100). Technical momentum and fundamental business valuation are in agreement, offering reassuring clarity.`
            : `**Cross-Engine Signal Alignment & Conflict Reasoning:** Cross-engine synthesis yields a Conflict Score of ${cs.conflictScore}/100 between price momentum and audited business valuation. ${cs.technicalFundamentalAlignment.divergenceType === 'VALUE_TRAP_RISK' ? 'Value Trap Risk Alert: Audited balance sheet valuation reflects an attractive Margin of Safety, but price momentum is negative and trading below institutional VWAP. Disciplined capital allocation warrants waiting for a confirmed Market Structure Shift (MSS) before buying.' : cs.technicalFundamentalAlignment.divergenceType === 'VALUATION_COMPRESSION_RISK' ? 'Valuation Compression Alert: Strong upward price momentum is unsupported by intrinsic DCF valuation. Stretched multiples create high vulnerability to sharp downward revisions upon quarterly earnings misses.' : 'Technical momentum and fundamental valuation are in harmonic agreement, offering aligned conviction.'}`
          : '';

        const portfolioSection = cs?.portfolioContext?.isHeld
          ? isBeginner
            ? `**Portfolio Position & Concentration Diagnostic:** In your portfolio, you currently hold this stock. ${cs.portfolioContext.narrative}`
            : `**Portfolio Position & Concentration Diagnostic:** ${cs.portfolioContext.narrative}`
          : '';

        const positives = isBeginner
          ? [
              ...(cs?.strategicCatalysts?.slice(0, 2) || []),
              ...(isRiskQuery ? riskPositives : []),
              `Active tracking across ${targetSymbol} with live market valuation of ₹${price}.`,
              `Technical health score of ${confluence}/100 (${rating}) confirms steady underlying structure.`,
              `Return on Equity of ${fund?.roe ?? 'N/A'}% reflects disciplined balance sheet deployment.`,
              ...(advFund?.dcf?.valuationStatus === 'UNDERVALUED' ? [`Two-stage DCF intrinsic valuation indicates a favorable Margin of Safety (+${advFund.dcf.marginOfSafetyPercent}%).`] : []),
              ...(advFund?.piotroski && advFund.piotroski.score >= 7 ? [`Piotroski F-Score of ${advFund.piotroski.score}/9 (${advFund.piotroski.rating}) confirms balance sheet integrity.`] : []),
              ...(!isRiskQuery ? riskPositives : []),
            ]
          : [
              ...(cs?.strategicCatalysts?.slice(0, 2) || []),
              ...(isRiskQuery ? riskPositives : []),
              `Active tracking across ${targetSymbol} with live market valuation of ₹${price}.`,
              `Technical confluence score of ${confluence}/100 (${rating}) confirms steady underlying structure.`,
              `Return on Equity of ${fund?.roe ?? 'N/A'}% reflects disciplined balance sheet deployment.`,
              ...(advFund?.dcf?.valuationStatus === 'UNDERVALUED' ? [`Two-stage DCF intrinsic valuation indicates a favorable Margin of Safety (+${advFund.dcf.marginOfSafetyPercent}%).`] : []),
              ...(advFund?.piotroski && advFund.piotroski.score >= 7 ? [`Piotroski F-Score of ${advFund.piotroski.score}/9 (${advFund.piotroski.rating}) confirms balance sheet integrity.`] : []),
              ...(!isRiskQuery ? riskPositives : []),
            ];

        const negatives = isBeginner
          ? [
              ...(cs?.strategicHeadwinds?.slice(0, 2) || []),
              ...(isRiskQuery ? riskNegatives : []),
              `Valuation multiple of ${peVal}x P/E costs a bit more than average, requiring continued earnings execution.`,
              `Key overhead resistance ceiling at ₹${adv?.supportResistance?.floorPivots?.r1 ?? 'N/A'} requires volume follow-through.`,
              ...(!isRiskQuery ? riskNegatives : []),
            ]
          : [
              ...(cs?.strategicHeadwinds?.slice(0, 2) || []),
              ...(isRiskQuery ? riskNegatives : []),
              `Valuation multiple of ${peVal}x P/E requires continued earnings execution.`,
              `Key overhead resistance ceiling at ₹${adv?.supportResistance?.floorPivots?.r1 ?? 'N/A'} requires volume follow-through.`,
              ...(!isRiskQuery ? riskNegatives : []),
            ];

        // NOTE: The dynamic confidence formula below (90 - conflictScore * 0.25) applies exclusively to
        // STOCK_ANALYSIS queries where cross-engine synthesis is evaluated. Domain-specific intents
        // (e.g. pure TECHNICAL_ANALYSIS, FUNDAMENTAL_ANALYSIS, NEWS_ANALYSIS, PORTFOLIO_ANALYSIS)
        // retain their respective intent-specific calibrated confidence scoring.
        const confidenceScore = cs
          ? Math.max(50, Math.min(95, 90 - Math.round(cs.conflictScore * 0.25)))
          : 88;

        const technicalAnalysis = isBeginner
          ? [
              `**Technical Momentum & Oscillators:** The 14-period RSI (Relative Strength Index, measuring buying and selling pressure from 0 to 100) stands at ${rsiVal}. The stock isn't being bought or sold aggressively right now — it's in a calm, balanced state (${ind?.rsi?.interpretation || 'neutral'}). The 50-day average price (SMA) is at ₹${ind?.sma50?.value ?? price}, with MACD histogram at ${ind?.macd?.histogram ?? 0} (${formatMacdMomentum(ind?.macd?.histogram)}). ${adv?.stochastic ? `Stochastic swing gauge is at ${adv.stochastic.kValue} (%K).` : ''}`,
              `**Volatility & Envelopes:** ${adv?.bollingerBands ? `Bollinger Bands (which show the typical high and low price channels) span ₹${adv.bollingerBands.lowerBand} – ₹${adv.bollingerBands.upperBand} with %B of ${adv.bollingerBands.percentB}. 14-day ATR (measuring typical daily price swings) is ₹${adv.atr.value} with dynamic stop guidance at ₹${adv.atr.stopLossBuffer.recommendedStopPrice}.` : 'Volatility within normal ranges.'}`,
              `**Key Price Zones & Structure:** Central floor pivot is at ₹${adv?.supportResistance?.floorPivots?.pivotPoint ?? price}. If price pulls back, the primary floor where buyers step in (S1 support) is at ₹${adv?.supportResistance?.floorPivots?.s1 ?? 'N/A'}. If price rallies, the ceiling where sellers often emerge (R1 resistance) is at ₹${adv?.supportResistance?.floorPivots?.r1 ?? 'N/A'}. Institutional VWAP benchmark is ₹${adv?.vwap?.vwap ?? price}. Market structure confirms a steady trend [STRUCTURE: ${ms?.trend ? ms.trend.replace(/_/g, ' ') : 'STABLE'}].`,
              `**Historical Risk Profile & Drawdown:** Based on historical price behavior, 60-day annualized volatility is ${risk?.volatility.annualizedVolatilityPercent ?? 'N/A'}% [VOLATILITY: ${risk?.volatility.interpretation || 'MODERATE'}]. This reflects typical normal price swings. Beta vs NIFTY 50 is ${risk?.beta.value !== null && risk?.beta.value !== undefined ? risk.beta.value : 'INSUFFICIENT_DATA'} (${risk?.beta.interpretation || risk?.beta.reason || 'N/A'}). This stock tends to move more than the overall market — when the market swings, this stock usually swings more in the same direction. Maximum drawdown over the window is ${risk?.maxDrawdown.drawdownPercent ?? 'N/A'}% (peak of ₹${risk?.maxDrawdown.peakPrice} on ${risk?.maxDrawdown.peakDate} to trough of ₹${risk?.maxDrawdown.troughPrice} on ${risk?.maxDrawdown.troughDate}). 95% Historical Simulation 1-day Value at Risk (VaR, the estimated maximum loss on a typical bad day) is ${risk?.var95.varPercent ?? 'N/A'}% (₹${risk?.var95.varRupees ?? 'N/A'}). Composite risk score is [RISK SCORE: ${riskScore}/100 (${riskLevel})].`,
              ...(crossEngineTechSection ? [crossEngineTechSection] : []),
            ].join('\n\n')
          : [
              `**Technical Momentum & Oscillators:** 14-period RSI stands at ${rsiVal} (${ind?.rsi?.interpretation || 'neutral'}). The 50-day SMA is at ₹${ind?.sma50?.value ?? price}, with MACD histogram at ${ind?.macd?.histogram ?? 0} (${formatMacdMomentum(ind?.macd?.histogram)}). ${adv?.stochastic ? `Stochastic oscillator is at ${adv.stochastic.kValue} (%K).` : ''}`,
              `**Volatility & Envelopes:** ${adv?.bollingerBands ? `Bollinger Bands span ₹${adv.bollingerBands.lowerBand} – ₹${adv.bollingerBands.upperBand} with %B of ${adv.bollingerBands.percentB}. 14-day ATR is ₹${adv.atr.value} with dynamic stop guidance at ₹${adv.atr.stopLossBuffer.recommendedStopPrice}.` : 'Volatility within normal ranges.'}`,
              `**Key Price Zones & Structure:** Floor pivot at ₹${adv?.supportResistance?.floorPivots?.pivotPoint ?? price} with S1 support at ₹${adv?.supportResistance?.floorPivots?.s1 ?? 'N/A'} and R1 resistance at ₹${adv?.supportResistance?.floorPivots?.r1 ?? 'N/A'}. VWAP benchmark is ₹${adv?.vwap?.vwap ?? price}. Market structure confirms [STRUCTURE: ${ms?.trend ? ms.trend.replace(/_/g, ' ') : 'STABLE'}].`,
              `**Historical Risk Profile & Drawdown:** Based on historical price behavior, 60-day annualized volatility is ${risk?.volatility.annualizedVolatilityPercent ?? 'N/A'}% [VOLATILITY: ${risk?.volatility.interpretation || 'MODERATE'}], with Beta vs NIFTY 50 at ${risk?.beta.value !== null && risk?.beta.value !== undefined ? risk.beta.value : 'INSUFFICIENT_DATA'} (${risk?.beta.interpretation || risk?.beta.reason || 'N/A'}). Maximum drawdown over the window is ${risk?.maxDrawdown.drawdownPercent ?? 'N/A'}% (peak of ₹${risk?.maxDrawdown.peakPrice} on ${risk?.maxDrawdown.peakDate} to trough of ₹${risk?.maxDrawdown.troughPrice} on ${risk?.maxDrawdown.troughDate}). 95% Historical Simulation 1-day Value at Risk (VaR) is ${risk?.var95.varPercent ?? 'N/A'}% (₹${risk?.var95.varRupees ?? 'N/A'}). Composite risk score is [RISK SCORE: ${riskScore}/100 (${riskLevel})].`,
              ...(crossEngineTechSection ? [crossEngineTechSection] : []),
            ].join('\n\n');

        const fundamentalAnalysis = isBeginner
          ? [
              `**Intrinsic Valuation & Multiples:** ${targetSymbol} trades at a P/E multiple of ${peVal}x. This stock costs a bit more, relative to how much profit it makes, than similar companies in its industry. The P/B ratio is ${fund?.pbRatio ?? 'N/A'}x, and Return on Equity (ROE, measuring how efficiently profit is generated from shareholder money) is ${fund?.roe ?? 'N/A'}%. ${advFund?.dcf ? `Two-stage DCF model estimates fair value at ₹${advFund.dcf.intrinsicValue} [VALUATION: ${advFund.dcf.valuationStatus} (${advFund.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${advFund.dcf.marginOfSafetyPercent}% MOS)].` : ''}`,
              `**Balance Sheet Quality & Solvency:** ${advFund?.piotroski ? `Piotroski F-Score stands at [PIOTROSKI: ${advFund.piotroski.score}/9 (${advFund.piotroski.rating})]. The company's financial health checks out well across nearly every measure we looked at — strong profits, manageable debt, and efficient operations. ` : ''}Debt-to-Equity is conservatively managed at ${fund?.debtToEquity ?? 'N/A'}x. ${advFund?.graham?.grahamNumber ? `Benjamin Graham defensive anchor is calculated at ₹${advFund.graham.grahamNumber}.` : ''}`,
              `**News Intelligence & Market Sentiment:** ${newsSection}`,
              ...(crossEngineFundSection ? [crossEngineFundSection] : []),
              ...(portfolioSection ? [portfolioSection] : []),
            ].join('\n\n')
          : [
              `**Intrinsic Valuation & Multiples:** ${targetSymbol} trades at an audited P/E of ${peVal}x, P/B of ${fund?.pbRatio ?? 'N/A'}x, and ROE of ${fund?.roe ?? 'N/A'}%. ${advFund?.dcf ? `Two-stage DCF model estimates fair value at ₹${advFund.dcf.intrinsicValue} [VALUATION: ${advFund.dcf.valuationStatus} (${advFund.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${advFund.dcf.marginOfSafetyPercent}% MOS)].` : ''}`,
              `**Balance Sheet Quality & Solvency:** ${advFund?.piotroski ? `Piotroski F-Score stands at [PIOTROSKI: ${advFund.piotroski.score}/9 (${advFund.piotroski.rating})]. ` : ''}Debt-to-Equity is conservatively managed at ${fund?.debtToEquity ?? 'N/A'}x. ${advFund?.graham?.grahamNumber ? `Benjamin Graham defensive anchor is calculated at ₹${advFund.graham.grahamNumber}.` : ''}`,
              `**News Intelligence & Market Sentiment:** ${newsSection}`,
              ...(crossEngineFundSection ? [crossEngineFundSection] : []),
              ...(portfolioSection ? [portfolioSection] : []),
            ].join('\n\n');

        return {
          summary,
          technicalAnalysis,
          fundamentalAnalysis,
          positives,
          negatives,
          riskLevel: riskLevel,
          confidenceScore,
          sources: sources.length > 0 ? sources : [{ type: 'Market Data Service', description: `Full analysis for ${targetSymbol}` }],
        };
      }
    }
  }

  /**
   * Synthesize recommendation using Gemini with conditionally fetched real data
   */
  private async synthesizeWithGemini(
    query: string,
    intent: QueryIntent,
    targetSymbol: string,
    data: Record<string, any>,
    sources: { type: string; description: string }[],
    explanationStyle: 'BEGINNER' | 'ADVANCED' = 'BEGINNER',
  ): Promise<StructuredAiRecommendation> {
    if (!this.geminiClient) {
      throw new Error('Gemini client uninitialized');
    }

    const model = this.geminiClient.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const explanationStyleInstructions =
      explanationStyle === 'BEGINNER'
        ? `USER PREFERENCE: BEGINNER EXPLANATION MODE
CRITICAL BEGINNER MODE INSTRUCTIONS:
- Explain every technical term the first time it is used, in plain everyday language, as if talking to a friend with zero finance background.
- Replace jargon-heavy phrasing with plain equivalents:
  * "RSI is neutral" -> "The stock isn't being bought or sold aggressively right now — it's in a calm, balanced state (RSI: ...)"
  * "Trading at a premium to sector median P/E" -> "This stock costs a bit more, relative to how much profit it makes, than similar companies in its industry (P/E: ...)"
  * "Piotroski F-Score 9/9 (STRONG)" -> "The company's financial health checks out well across nearly every measure we looked at — strong profits, manageable debt, and efficient operations (Piotroski F-Score: 9/9)"
  * "Beta 1.3 (AGGRESSIVE)" -> "This stock tends to move more than the overall market — when the market swings, this stock usually swings more in the same direction (Beta: ...)"
- Keep the SAME underlying numbers and structure (risk level, confidence score, sources) — just explain them in plain words alongside the number, don't hide the number itself.
- Shorter sentences, no stacked qualifying clauses, one idea per sentence.`
        : `USER PREFERENCE: ADVANCED EXPLANATION MODE
CRITICAL ADVANCED MODE INSTRUCTIONS:
- Keep the current institutional terminology exactly as it is today (RSI, MACD, Piotroski, DCF, Beta, VWAP, Order Blocks, Fair Value Gaps, etc.). No changes to terminology or phrasing style.`;

    const prompt = `User Query: "${query}"
Detected Intent: ${intent}
Target Symbol: ${targetSymbol}
Explanation Style Mode: ${explanationStyle}

${explanationStyleInstructions}

Verified Real Data Context:
${JSON.stringify(data, null, 2)}

Provide a JSON object adhering strictly to this schema:
{
  "summary": "string (probabilistic, concise)",
  "technicalAnalysis": "string",
  "fundamentalAnalysis": "string",
  "positives": ["string", "string"],
  "negatives": ["string", "string"],
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "confidenceScore": number (0-100),
  "sources": [{"type": "string", "description": "string"}]
}`;

    const res = await model.generateContent(prompt);
    const text = res.response.text();
    const parsed = JSON.parse(text) as StructuredAiRecommendation;

    if (!parsed.sources || parsed.sources.length === 0) {
      parsed.sources = sources;
    }

    // Anchor deterministic mathematical outputs with zero LLM hallucination
    if (data.crossEngineSynthesis) {
      const cs = data.crossEngineSynthesis;
      parsed.confidenceScore = Math.max(50, Math.min(95, 90 - Math.round(cs.conflictScore * 0.25)));
      if (data.riskAnalysis?.compositeRiskScore?.riskLevel) {
        parsed.riskLevel = data.riskAnalysis.compositeRiskScore.riskLevel;
      }
    } else if (intent === 'TECHNICAL_ANALYSIS') {
      parsed.confidenceScore = 85;
    } else if (intent === 'FUNDAMENTAL_ANALYSIS') {
      parsed.confidenceScore = 95;
    }

    return parsed;
  }
}
