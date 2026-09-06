import { Test, TestingModule } from '@nestjs/testing';
import { FinPilotOrchestrator } from './finpilot-orchestrator.service';
import { IntentDetectorService } from './intent-detector.service';
import { EntityResolverService } from './entity-resolver.service';
import { AiToolsService } from '../ai-tools.service';
import { AiResponseValidator } from '../ai-response-validator';
import { MarketService } from '../../market/market.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CrossEngineSynthesisEngine } from '../engines/cross-engine-synthesis.engine';
import { CryptoMarketService } from '../../crypto/crypto-market.service';

describe('FinPilotOrchestrator - Conditional Data Fetching & Routing', () => {
  let orchestrator: FinPilotOrchestrator;
  let toolsService: AiToolsService;
  let intentDetector: IntentDetectorService;
  let entityResolver: EntityResolverService;
  let marketService: MarketService;

  beforeEach(async () => {
    const prismaMock = {
      stock: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const syms: string[] = where.symbol?.in || [];
          if (syms.includes('TCS.NS')) {
            return Promise.resolve([
              { symbol: 'TCS.NS', name: 'Tata Consultancy Services', exchange: 'NSE', sector: 'IT Services' },
            ]);
          }
          return Promise.resolve([]);
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      cryptoAsset: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const sym = where?.OR?.[0]?.symbol?.equals;
          const name = where?.OR?.[1]?.name?.equals;
          if (sym === 'BTC' || sym === 'BITCOIN' || name === 'BTC' || name === 'BITCOIN') {
            return Promise.resolve({ symbol: 'BTC', name: 'Bitcoin', category: 'Layer 1' });
          }
          if (sym === 'DOGE' || sym === 'DOGECOIN' || name === 'DOGE' || name === 'DOGECOIN') {
            return Promise.resolve({ symbol: 'DOGE', name: 'Dogecoin', category: 'Memecoin' });
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.symbol === 'BTC') return Promise.resolve({ symbol: 'BTC', name: 'Bitcoin', category: 'Layer 1' });
          if (where.symbol === 'DOGE') return Promise.resolve({ symbol: 'DOGE', name: 'Dogecoin', category: 'Memecoin' });
          return Promise.resolve(null);
        }),
      },
    };

    const toolsMock = {
      executeTool: jest.fn().mockImplementation((toolName: string, args: any) => {
        if (toolName === 'getStockQuote') {
          return Promise.resolve({
            tool: 'getStockQuote',
            result: {
              symbol: args.symbol || 'TCS.NS',
              name: 'Tata Consultancy Services',
              currentPrice: 4250.0,
              change: 25.0,
              changePercent: 0.59,
              exchange: 'NSE',
              sector: 'IT Services',
            },
            sourceRecord: { type: 'Market Data Service', description: 'Live stock quote' },
          });
        }
        if (toolName === 'getTechnicalIndicators') {
          return Promise.resolve({
            tool: 'getTechnicalIndicators',
            result: {
              symbol: args.symbol || 'TCS.NS',
              rsi: { value: 62.5, period: 14, interpretation: 'Bullish momentum' },
              sma50: { value: 4120.0, differencePercent: 3.1 },
              sma200: { value: 3890.0, differencePercent: 9.2 },
              maCrossover: { status: 'BULLISH_ALIGNMENT', interpretation: '50MA above 200MA' },
              macd: { macdLine: 35.2, signalLine: 28.0, histogram: 7.2, interpretation: 'Positive histogram' },
            },
            sourceRecord: { type: 'Technical Engine', description: 'RSI & Moving Averages' },
          });
        }
        if (toolName === 'getAdvancedTechnicalAnalysis') {
          return Promise.resolve({
            tool: 'getAdvancedTechnicalAnalysis',
            result: {
              symbol: args.symbol || 'TCS.NS',
              currentPrice: 4250.0,
              atr: {
                value: 65.4,
                period: 14,
                relativeAtrPercent: 1.54,
                volatilityRegime: 'MODERATE_VOLATILITY',
                stopLossBuffer: {
                  multiplier1_5: 98.1,
                  multiplier2_0: 130.8,
                  recommendedStopDistance: 98.1,
                  recommendedStopPrice: 4151.9,
                },
                interpretation: '14-day ATR is ₹65.4 (1.54%), reflecting moderate volatility.',
              },
              bollingerBands: {
                middleBand: 4120.0,
                upperBand: 4320.0,
                lowerBand: 3920.0,
                percentB: 0.82,
                bandwidthPercent: 9.71,
                squeezeStatus: 'NORMAL',
                interpretation: 'Price is trading at %B 0.82 approaching the upper band envelope.',
              },
              stochastic: {
                kValue: 72.4,
                dValue: 68.1,
                status: 'BULLISH_MOMENTUM',
                crossoverSignal: 'BULLISH_CROSS',
                interpretation: 'Stochastic %K is 72.4 and %D is 68.1 (BULLISH_MOMENTUM zone).',
              },
              vwap: {
                vwap: 4210.5,
                differencePercent: 0.94,
                bias: 'BUYER_CONTROL',
                interpretation: 'VWAP benchmark stands at ₹4210.5 (+0.94% buyer control).',
              },
              supportResistance: {
                floorPivots: { pivotPoint: 4200.0, r1: 4290.0, r2: 4350.0, s1: 4140.0, s2: 4090.0 },
                swingHighResistance: 4310.0,
                swingLowSupport: 4100.0,
                nearestSupport: { level: 4140.0, distancePercent: -2.59, label: 'S1 Floor Pivot' },
                nearestResistance: { level: 4290.0, distancePercent: 0.94, label: 'R1 Floor Pivot' },
                interpretation: 'Key technical floors: S1 at ₹4140.0. Key resistance: R1 at ₹4290.0.',
              },
              multiTimeframe: {
                dailyTrend: 'BULLISH',
                weeklyTrend: 'BULLISH',
                alignment: 'ALIGNED_BULLISH',
                interpretation: 'Daily and weekly timeframes are synchronized in an upward trend.',
              },
              confluenceScore: 78,
              rating: 'BULLISH',
              keyTakeaways: ['Strong momentum alignment', 'VWAP buyer control'],
              computedAt: new Date().toISOString(),
            },
            sourceRecord: { type: 'Institutional Technical Engine', description: 'Confluence 78/100' },
          });
        }
        if (toolName === 'getMarketStructure') {
          return Promise.resolve({
            tool: 'getMarketStructure',
            result: {
              symbol: args.symbol || 'TCS.NS',
              currentPrice: 4250.0,
              trend: 'BULLISH_EXPANSION',
              lastStructureShift: 'Bullish sequence (Consecutive HH + HL)',
              swingPoints: [],
              orderBlocks: [],
              activeOrderBlocks: [
                {
                  type: 'BULLISH_DEMAND',
                  candleIndex: 12,
                  timestamp: new Date().toISOString(),
                  high: 4180.0,
                  low: 4120.0,
                  mitigated: false,
                  significance: 'HIGH',
                },
              ],
              fairValueGaps: [],
              unfilledFvgs: [
                {
                  type: 'BULLISH_IMBALANCE',
                  startIndex: 15,
                  timestamp: new Date().toISOString(),
                  top: 4240.0,
                  bottom: 4205.0,
                  size: 35.0,
                  sizePercent: 0.83,
                  filled: false,
                  currentProximityPercent: -1.06,
                },
              ],
              liquiditySweeps: [],
              dealingRange: {
                rangeHigh: 4350.0,
                rangeLow: 4050.0,
                equilibrium: 4200.0,
                currentZone: 'PREMIUM',
                relativePositionPercent: 66.67,
                optimalTradeEntry: { fib618: 4164.6, fib786: 4114.2 },
              },
              structureRating: 'BULLISH',
              institutionalNarrative: 'TCS.NS is characterized by BULLISH_EXPANSION.',
              keyStructureTakeaways: ['Institutional bullish expansion', 'Unmitigated demand OB at 4120-4180'],
              computedAt: new Date().toISOString(),
            },
            sourceRecord: { type: 'Market Structure Engine', description: 'Trend: BULLISH_EXPANSION, Zone: PREMIUM' },
          });
        }
        if (toolName === 'getFundamentals') {
          return Promise.resolve({
            tool: 'getFundamentals',
            result: {
              symbol: args.symbol || 'TCS.NS',
              peRatio: 29.5,
              pbRatio: 12.4,
              roe: 48.2,
              debtToEquity: 0.01,
            },
            sourceRecord: { type: 'Corporate Filings', description: 'Audited balance sheet ratios' },
          });
        }
        if (toolName === 'getFundamentalAnalysis') {
          return Promise.resolve({
            tool: 'getFundamentalAnalysis',
            result: {
              symbol: args.symbol || 'TCS.NS',
              companyName: 'Tata Consultancy Services Ltd.',
              currentPrice: 2304,
              dcf: {
                intrinsicValue: 2850,
                currentPrice: 2304,
                marginOfSafetyPercent: 19.16,
                valuationStatus: 'UNDERVALUED',
                assumptions: { discountRate: 0.11, terminalGrowthRate: 0.05, projectedGrowthRate: 0.12, projectionYears: 5 },
                projectedCashFlows: [110, 123, 138, 154, 173],
                terminalValue: 3027,
                pvTerminalValue: 1796,
              },
              graham: {
                grahamNumber: 2750,
                bvps: 185.8,
                eps: 128.4,
                premiumOrDiscountPercent: -16.22,
                valuationStatus: 'GRAHAM_DISCOUNT',
              },
              piotroski: {
                score: 9,
                rating: 'STRONG',
                profitabilityScore: 4,
                leverageScore: 3,
                operatingEfficiencyScore: 2,
                criteriaBreakdown: {},
              },
              sectorBenchmark: {
                sector: 'Information Technology',
                industry: 'IT Services',
                medianPe: 26.5,
                medianPb: 7.0,
                targetRoe: 25.0,
                maxHealthyDebtToEquity: 0.2,
                peComparison: 'PREMIUM_TO_SECTOR',
                peVariancePercent: 11.32,
              },
              overallRating: 'STRONG_BUY_QUALITY',
              confidenceScore: 92,
              riskLevel: 'LOW',
              summaryNarrative: 'Audited fundamentals for TCS.NS confirm STRONG_BUY_QUALITY.',
              strengths: ['Return on Equity of 48.2% demonstrates disciplined capital deployment.'],
              weaknesses: ['Valuation multiple of 29.5x commands a premium.'],
              computedAt: new Date().toISOString(),
            },
            sourceRecord: { type: 'Fundamental Valuation Engine', description: 'Valuation & health analysis' },
          });
        }
        if (toolName === 'getRecentNews') {
          return Promise.resolve({
            tool: 'getRecentNews',
            result: {
              symbol: args.symbol || 'TCS.NS',
              articles: [
                { title: 'TCS expands cloud transformation deal', publishedAt: new Date().toISOString() },
              ],
            },
            sourceRecord: { type: 'News Service', description: 'Recent market headlines' },
          });
        }
        if (toolName === 'getPortfolioAnalysis') {
          return Promise.resolve({
            tool: 'getPortfolioAnalysis',
            result: {
              currentValue: 250000,
              totalInvested: 210000,
              totalGainLoss: 40000,
              totalGainLossPercent: 19.05,
              diversificationScore: 78,
              holdingsCount: 5,
              sectorAllocation: [{ sector: 'IT Services', percentage: 40 }],
            },
            sourceRecord: { type: 'Portfolio Service', description: 'Portfolio analytics' },
          });
        }
        if (toolName === 'getPortfolioIntelligence') {
          return Promise.resolve({
            tool: 'getPortfolioIntelligence',
            result: {
              userId: 'user-1',
              portfolioId: 'port-1',
              totalValue: 250000,
              totalCost: 210000,
              totalProfit: 40000,
              totalProfitPercent: 19.05,
              holdingsCount: 5,
              diversificationScore: 78,
              topContributors: [
                { symbol: 'TCS.NS', totalReturn: 25000, totalReturnPercent: 20, contributionToPortfolioPnlPercent: 62.5 },
              ],
              worstContributors: [
                { symbol: 'INFY.NS', totalReturn: -5000, totalReturnPercent: -5, contributionToPortfolioPnlPercent: 12.5 },
              ],
              concentrationAnalysis: {
                holdingThresholdPercent: 25,
                sectorThresholdPercent: 25,
                holdingAlerts: [],
                sectorAlerts: [],
                hasConcentrationRisk: false,
              },
              correlationMatrix: {
                pairs: [],
                averageCorrelation: 0.42,
                status: 'AVAILABLE',
                statusMessage: 'Pairwise correlation calculated across active holdings.',
              },
              computedAt: new Date().toISOString(),
            },
            sourceRecord: { type: 'Portfolio Intelligence Engine', description: 'Portfolio intelligence' },
          });
        }
        if (toolName === 'getRiskAnalysis') {
          return Promise.resolve({
            tool: 'getRiskAnalysis',
            result: {
              symbol: args.symbol || 'TCS.NS',
              currentPrice: 4250,
              windowDays: 60,
              volatility: { windowDays: 60, dailyVolatilityPercent: 1.2, annualizedVolatilityPercent: 19.0, interpretation: 'MODERATE' },
              beta: { benchmarkSymbol: '^NSEI', windowDays: 60, value: 0.95, status: 'AVAILABLE', interpretation: 'MARKET_TRACKING' },
              maxDrawdown: { drawdownPercent: -12.5, peakPrice: 4400, peakDate: '2025-01-10', troughPrice: 3850, troughDate: '2025-02-05', recoveryStatus: 'RECOVERED', status: 'AVAILABLE' },
              var95: { confidenceLevelPercent: 95, horizonDays: 1, method: 'HISTORICAL_SIMULATION', methodDescription: 'Historical simulation', varPercent: 2.1, varRupees: 89.25, sampleDays: 60, status: 'AVAILABLE' },
              compositeRiskScore: { score: 38, riskLevel: 'MEDIUM', components: { volatilityScore: 13, drawdownScore: 11, valuationScore: 14 }, weightingFormula: 'Formula', disclaimer: 'Historical only' },
              computedAt: new Date().toISOString(),
            },
            sourceRecord: { type: 'Risk Analysis Engine', description: 'Risk analysis' },
          });
        }
        if (toolName === 'getNewsIntelligence') {
          return Promise.resolve({
            tool: 'getNewsIntelligence',
            result: {
              symbol: args.symbol || 'TCS.NS',
              sourceProvider: 'marketaux',
              isMock: false,
              articles: [],
              totalRawArticles: 3,
              uniqueArticlesCount: 2,
              duplicatesRemovedCount: 1,
              sentimentDistribution: { positiveCount: 2, neutralCount: 0, negativeCount: 0, totalArticles: 2, positivePercentage: 100, neutralPercentage: 0, negativePercentage: 0 },
              temporalWeighting: { halfLifeDays: 3, weightedScore: 0.65, weightedSentiment: 'BULLISH', recencySummary: 'Recency summary' },
              status: 'RELIABLE',
              statusMessage: 'Verified news',
              computedAt: new Date().toISOString(),
            },
            sourceRecord: { type: 'News Intelligence Engine', description: 'News intelligence' },
          });
        }
        return Promise.resolve({ tool: toolName, result: {} });
      }),
    };

    const marketMock = {
      getHistory: jest.fn().mockResolvedValue([]),
      getTopMovers: jest.fn().mockResolvedValue({ gainers: [], losers: [] }),
      searchStocks: jest.fn().mockImplementation((q: string) => {
        if (q.toUpperCase().includes('TATA MOTORS')) {
          return Promise.resolve([
            {
              symbol: 'TATAMOTORS.NS',
              name: 'Tata Motors Ltd',
              exchange: 'NSE, BSE',
              sector: 'Automobile',
              exchanges: ['NSE', 'BSE'],
              exchangeSymbols: { NSE: 'TATAMOTORS.NS', BSE: 'TATAMOTORS.BO' },
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const cryptoMarketMock = {
      getQuote: jest.fn().mockResolvedValue({ data: { symbol: 'BTC', currentPrice: 5000000 }, isMock: false }),
      getHistory: jest.fn().mockResolvedValue({ data: [], isMock: false }),
      getIndicators: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinPilotOrchestrator,
        IntentDetectorService,
        EntityResolverService,
        AiResponseValidator,
        CrossEngineSynthesisEngine,
        { provide: AiToolsService, useValue: toolsMock },
        { provide: MarketService, useValue: marketMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: CryptoMarketService, useValue: cryptoMarketMock },
      ],
    }).compile();

    orchestrator = module.get<FinPilotOrchestrator>(FinPilotOrchestrator);
    toolsService = module.get<AiToolsService>(AiToolsService);
    intentDetector = module.get<IntentDetectorService>(IntentDetectorService);
    entityResolver = module.get<EntityResolverService>(EntityResolverService);
    marketService = module.get<MarketService>(MarketService);

    // Disable live API clients for deterministic unit tests
    (orchestrator as any).geminiClient = null;
    (intentDetector as any).geminiClient = null;
  });

  it('should be defined', () => {
    expect(orchestrator).toBeDefined();
  });

  describe('Conditional Data Fetching Guarantees', () => {
    it('TECHNICAL_ANALYSIS query ONLY fetches quote and technical indicators — NOT fundamentals or news', async () => {
      const result = await orchestrator.processQuery('user-1', 'What is the RSI of TCS.NS?');

      expect(result.intent).toBe('TECHNICAL_ANALYSIS');
      expect(result.toolsFired).toEqual(['getStockQuote', 'getTechnicalIndicators', 'getAdvancedTechnicalAnalysis', 'getMarketStructure']);

      // Spy assertions: verify only required tools were called
      expect(toolsService.executeTool).toHaveBeenCalledWith('getStockQuote', { symbol: 'TCS.NS' }, 'user-1');
      expect(toolsService.executeTool).toHaveBeenCalledWith('getTechnicalIndicators', expect.objectContaining({ symbol: 'TCS.NS' }), 'user-1');
      expect(toolsService.executeTool).toHaveBeenCalledWith('getAdvancedTechnicalAnalysis', expect.objectContaining({ symbol: 'TCS.NS' }), 'user-1');
      expect(toolsService.executeTool).toHaveBeenCalledWith('getMarketStructure', expect.objectContaining({ symbol: 'TCS.NS' }), 'user-1');
      
      // Strict negative assertions: fundamentals and news MUST NOT be fetched
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getFundamentals', expect.anything(), expect.anything());
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getRecentNews', expect.anything(), expect.anything());
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getPortfolioAnalysis', expect.anything(), expect.anything());

      // Response validation
      expect(result.recommendation.technicalAnalysis).toContain('RSI');
      expect(result.recommendation.technicalAnalysis).toContain('Bollinger Band & Volatility Dynamics');
      expect(result.recommendation.technicalAnalysis).toContain('Key Support & Resistance Pivots');
      expect(result.recommendation.technicalAnalysis).toContain('Institutional Market Structure & Order Flow');
      expect(result.recommendation.summary).toContain('[CONFLUENCE: BULLISH 78%]');
      expect(result.recommendation.summary).toContain('[STRUCTURE: BULLISH EXPANSION]');
      expect(result.recommendation.fundamentalAnalysis).toContain('omitted for this targeted technical evaluation');
    });

    it('FUNDAMENTAL_ANALYSIS query ONLY fetches quote, fundamentals, and fundamental analysis — NOT indicators, structure, or news', async () => {
      const result = await orchestrator.processQuery('user-1', 'What is the PE ratio and debt of TCS.NS?');

      expect(result.intent).toBe('FUNDAMENTAL_ANALYSIS');
      expect(result.toolsFired).toEqual(['getStockQuote', 'getFundamentals', 'getFundamentalAnalysis']);

      // Spy assertions: verify only required tools were called
      expect(toolsService.executeTool).toHaveBeenCalledWith('getStockQuote', { symbol: 'TCS.NS' }, 'user-1');
      expect(toolsService.executeTool).toHaveBeenCalledWith('getFundamentals', { symbol: 'TCS.NS' }, 'user-1');
      expect(toolsService.executeTool).toHaveBeenCalledWith('getFundamentalAnalysis', { symbol: 'TCS.NS' }, 'user-1');

      // Strict negative assertions: technical indicators, market structure, and news MUST NOT be fetched
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getTechnicalIndicators', expect.anything(), expect.anything());
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getAdvancedTechnicalAnalysis', expect.anything(), expect.anything());
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getMarketStructure', expect.anything(), expect.anything());
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getRecentNews', expect.anything(), expect.anything());

      // Response validation
      expect(result.recommendation.fundamentalAnalysis).toContain('Intrinsic Valuation & DCF Model');
      expect(result.recommendation.fundamentalAnalysis).toContain('Piotroski Financial Health');
      expect(result.recommendation.fundamentalAnalysis).toContain('Graham Number & Defensive Value');
      expect(result.recommendation.summary).toContain('[PIOTROSKI: 9/9 (STRONG)]');
      expect(result.recommendation.technicalAnalysis).toContain('omitted for this targeted fundamental');
    });

    it('PORTFOLIO_ANALYSIS query ONLY fetches portfolio analysis and intelligence — NO equity stock tools', async () => {
      const result = await orchestrator.processQuery('user-1', 'How is my portfolio diversification doing?');

      expect(result.intent).toBe('PORTFOLIO_ANALYSIS');
      expect(result.toolsFired).toEqual(['getPortfolioAnalysis', 'getPortfolioIntelligence']);

      // Spy assertions
      expect(toolsService.executeTool).toHaveBeenCalledWith('getPortfolioAnalysis', {}, 'user-1');
      expect(toolsService.executeTool).toHaveBeenCalledWith('getPortfolioIntelligence', {}, 'user-1');
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getStockQuote', expect.anything(), expect.anything());
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getFundamentals', expect.anything(), expect.anything());
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getTechnicalIndicators', expect.anything(), expect.anything());

      expect(result.recommendation.summary).toContain('diversification score');
    });

    it('Ambiguous dual-listed company query does NOT fire data tools and asks for clarification', async () => {
      const result = await orchestrator.processQuery('user-1', 'Tell me about Tata Motors');

      expect(result.entities.status).toBe('AMBIGUOUS');
      // No tools fired on ambiguous queries
      expect(result.toolsFired).toEqual([]);
      expect(toolsService.executeTool).not.toHaveBeenCalled();

      // Clear, honest response asking user to specify NSE or BSE
      expect(result.recommendation.summary).toContain('did you mean TATAMOTORS.NS (NSE) or TATAMOTORS.BO (BSE)?');
      expect(result.recommendation.technicalAnalysis).toContain('on hold pending security selection');
    });

    it('Not-found stock query does NOT fire tools and produces an honest not-found response', async () => {
      const result = await orchestrator.processQuery('user-1', 'What is the RSI of NONEXISTENTSTOCK.NS?');

      expect(result.entities.status).toBe('NOT_FOUND');
      expect(result.toolsFired).toEqual([]);
      expect(toolsService.executeTool).not.toHaveBeenCalled();

      expect(result.recommendation.summary).toContain('was not found in the verified NSE/BSE security master');
    });

    it('Crypto comparison query (bitcoin vs dogecoin) routes both sides through crypto pipeline and skips equity fundamentals', async () => {
      const result = await orchestrator.processQuery('user-1', 'bitcoin vs dogecoin');

      expect(result.intent).toBe('STOCK_COMPARISON');
      expect(result.entities.symbols).toEqual(['BTC', 'DOGE']);
      expect(result.toolsFired).toContain('getCryptoQuote:1');
      expect(result.toolsFired).toContain('getCryptoQuote:2');
      expect(result.toolsFired).toContain('getCryptoTechnicalIndicators:1');
      expect(result.toolsFired).toContain('getCryptoTechnicalIndicators:2');
      expect(result.toolsFired).toContain('getCryptoRiskAnalysis:1');
      expect(result.toolsFired).toContain('getCryptoRiskAnalysis:2');
      expect(result.toolsFired).toContain('assetClassPolicy');
      // Must not call equity getFundamentals tool
      expect(toolsService.executeTool).not.toHaveBeenCalledWith('getFundamentals', expect.anything(), expect.anything());

      expect(result.recommendation.summary).toContain('BTC');
      expect(result.recommendation.summary).toContain('DOGE');
      expect(result.recommendation.fundamentalAnalysis).toContain('Not applicable to cryptocurrency assets');
      expect(result.recommendation.riskLevel).toBe('HIGH');
    });

    it('Single crypto technical query (what is the RSI of Bitcoin) executes technical analysis and skips fundamentals', async () => {
      const result = await orchestrator.processQuery('user-1', 'what is the RSI of Bitcoin');

      expect(result.intent).toBe('TECHNICAL_ANALYSIS');
      expect(result.entities.primarySymbol).toBe('BTC');
      expect(result.toolsFired).toEqual([
        'getStockQuote',
        'getTechnicalIndicators',
        'getAdvancedTechnicalAnalysis',
        'getMarketStructure',
      ]);
      expect(result.recommendation.summary).toContain('BTC');
      expect(result.recommendation.fundamentalAnalysis).toContain('Not applicable to cryptocurrency assets');
    });
  });
});
