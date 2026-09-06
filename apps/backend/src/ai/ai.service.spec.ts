import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';
import { AiResponseValidator } from './ai-response-validator';
import { MarketService } from '../market/market.service';
import { IndicatorsService } from '../market/indicators.service';
import { NewsService } from '../news/news.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { TechnicalAnalysisEngine } from './engines/technical-analysis.engine';
import { MarketStructureEngine } from './engines/market-structure.engine';
import { FundamentalAnalysisEngine } from './engines/fundamental-analysis.engine';
import { RiskAnalysisEngine } from './engines/risk-analysis.engine';
import { NewsIntelligenceEngine } from './engines/news-intelligence.engine';
import { PortfolioIntelligenceEngine } from './engines/portfolio-intelligence.engine';
import { CrossEngineSynthesisEngine } from './engines/cross-engine-synthesis.engine';
import { CryptoMarketService } from '../crypto/crypto-market.service';

describe('AiService - Dynamic Symbol Extraction & Session Tests', () => {
  let aiService: AiService;
  let prismaMock: any;
  let toolsService: AiToolsService;
  let marketMock: any;
  let indicatorsMock: any;

  beforeEach(async () => {
    const sessionStore: any = {
      id: 'session-test-1',
      userId: 'user-test-1',
      title: 'Stock Analysis',
      createdAt: new Date(),
      messages: [],
    };

    prismaMock = {
      chatSession: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === sessionStore.id) return Promise.resolve(sessionStore);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newSession = { id: 'session-test-1', ...data, createdAt: new Date(), messages: [] };
          return Promise.resolve(newSession);
        }),
      },
      chatMessage: {
        create: jest.fn().mockImplementation(({ data }) => {
          const msg = { id: `msg-${Date.now()}`, ...data, createdAt: new Date() };
          sessionStore.messages.push(msg);
          return Promise.resolve(msg);
        }),
      },
      stock: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(null);
        }),
      },
      cryptoAsset: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    marketMock = {
      getStockBySymbol: jest.fn().mockImplementation((sym: string) => {
        const symbol = sym.toUpperCase();
        if (symbol.includes('MAZDOCK')) {
          return Promise.resolve({
            symbol: 'MAZDOCK.NS',
            name: 'Mazagon Dock Shipbuilders Ltd.',
            currentPrice: 4850.75,
            change: 125.40,
            changePercent: 2.65,
            exchange: 'NSE',
            sector: 'Capital Goods',
            fundamentals: { peRatio: 38.5, pbRatio: 9.2, roe: 24.5, debtToEquity: 0.05 },
          });
        }
        if (symbol.includes('BDL')) {
          return Promise.resolve({
            symbol: 'BDL.NS',
            name: 'Bharat Dynamics Limited',
            currentPrice: 1320.60,
            change: -15.20,
            changePercent: -1.14,
            exchange: 'NSE',
            sector: 'Aerospace & Defence',
            fundamentals: { peRatio: 42.1, pbRatio: 7.8, roe: 18.2, debtToEquity: 0.02 },
          });
        }
        if (symbol.includes('RELIANCE')) {
          return Promise.resolve({
            symbol: 'RELIANCE.NS',
            name: 'Reliance Industries Ltd.',
            currentPrice: 2980.00,
            change: 45.00,
            changePercent: 1.53,
            exchange: 'NSE',
            sector: 'Energy',
            fundamentals: { peRatio: 26.4, pbRatio: 2.1, roe: 9.8, debtToEquity: 0.45 },
          });
        }
        if (symbol.includes('BLUEJET')) {
          return Promise.resolve({
            symbol: 'BLUEJET.BO',
            name: 'Blue Jet Healthcare Ltd',
            currentPrice: 412.50,
            change: 8.20,
            changePercent: 2.03,
            exchange: 'BSE',
            sector: 'Healthcare',
            fundamentals: { peRatio: 32.1, pbRatio: 4.5, roe: 16.8, debtToEquity: 0.08 },
          });
        }
        return Promise.resolve({
          symbol: 'TCS.NS',
          name: 'Tata Consultancy Services',
          currentPrice: 4250.00,
          change: 20.00,
          changePercent: 0.47,
          exchange: 'NSE',
          sector: 'IT Services',
          fundamentals: { peRatio: 29.5, pbRatio: 12.4, roe: 48.2, debtToEquity: 0.01 },
        });
      }),
    };

    indicatorsMock = {
      calculateIndicators: jest.fn().mockImplementation((sym: string) => {
        const symbol = sym.toUpperCase();
        if (symbol.includes('MAZDOCK')) {
          return Promise.resolve({
            symbol: 'MAZDOCK.NS',
            rsi: { value: 68.4, period: 14, interpretation: 'Constructive bullish momentum' },
            sma50: { value: 4620.0, differencePercent: 4.99 },
            sma200: { value: 3950.0, differencePercent: 22.8 },
            maCrossover: { status: 'BULLISH_ALIGNMENT', interpretation: '50MA above 200MA' },
            macd: { macdLine: 45.2, signalLine: 38.1, histogram: 7.1, interpretation: 'Expanding upward momentum' },
            computedAt: new Date().toISOString(),
          });
        }
        if (symbol.includes('BDL')) {
          return Promise.resolve({
            symbol: 'BDL.NS',
            rsi: { value: 52.1, period: 14, interpretation: 'Neutral consolidation' },
            sma50: { value: 1350.0, differencePercent: -2.18 },
            sma200: { value: 1210.0, differencePercent: 9.14 },
            maCrossover: { status: 'BULLISH_ALIGNMENT', interpretation: '50MA above 200MA' },
            macd: { macdLine: -5.2, signalLine: -3.1, histogram: -2.1, interpretation: 'Contracting momentum' },
            computedAt: new Date().toISOString(),
          });
        }
        if (symbol.includes('BLUEJET')) {
          return Promise.resolve({
            symbol: 'BLUEJET.BO',
            rsi: { value: 61.2, period: 14, interpretation: 'Positive bias' },
            sma50: { value: 398.0, differencePercent: 3.64 },
            sma200: { value: 375.0, differencePercent: 10.0 },
            maCrossover: { status: 'BULLISH_ALIGNMENT', interpretation: 'Bullish alignment' },
            macd: { macdLine: 5.4, signalLine: 3.2, histogram: 2.2, interpretation: 'Positive histogram' },
            computedAt: new Date().toISOString(),
          });
        }
        return Promise.resolve({
          symbol: 'RELIANCE.NS',
          rsi: { value: 58.6, period: 14, interpretation: 'Positive bias' },
          sma50: { value: 2910.0, differencePercent: 2.4 },
          sma200: { value: 2780.0, differencePercent: 7.19 },
          maCrossover: { status: 'BULLISH_ALIGNMENT', interpretation: 'Bullish alignment' },
          macd: { macdLine: 12.4, signalLine: 8.2, histogram: 4.2, interpretation: 'Positive histogram' },
          computedAt: new Date().toISOString(),
        });
      }),
    };

    const newsMock = {
      getNews: jest.fn().mockResolvedValue({
        articles: [
          { title: 'Defence sector order inflows surge', source: 'LiveMint', sentiment: 'POSITIVE', publishedAt: new Date().toISOString(), summary: 'Defence manufacturers record strong order pipelines.' },
        ],
        source: 'LiveMint',
      }),
    };

    const portfolioMock = {
      getAnalysis: jest.fn().mockResolvedValue({
        currentValue: 500000,
        totalInvestment: 420000,
        totalProfit: 80000,
        totalProfitPercent: 19.05,
        diversificationScore: 78,
        sectorAllocation: [{ sector: 'Defence', value: 300000, percentage: 60 }],
        holdingsCount: 3,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        AiResponseValidator,
        AiToolsService,
        TechnicalAnalysisEngine,
        MarketStructureEngine,
        FundamentalAnalysisEngine,
        RiskAnalysisEngine,
        NewsIntelligenceEngine,
        PortfolioIntelligenceEngine,
        CrossEngineSynthesisEngine,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MarketService, useValue: marketMock },
        { provide: IndicatorsService, useValue: indicatorsMock },
        { provide: NewsService, useValue: newsMock },
        { provide: PortfolioService, useValue: portfolioMock },
        {
          provide: CryptoMarketService,
          useValue: {
            getQuote: jest.fn().mockResolvedValue({ data: { symbol: 'BTC', currentPrice: 5000000 }, isMock: false }),
            getHistory: jest.fn().mockResolvedValue({ data: [], isMock: false }),
            getIndicators: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
    toolsService = module.get<AiToolsService>(AiToolsService);

    // Disable live clients by default for fast, deterministic unit testing
    (aiService as any).geminiClient = null;
    (aiService as any).anthropicClient = null;
  });

  it('Test Case 1: handles "did mazdock will be bullist" and extracts MAZDOCK.NS without defaulting to TCS', async () => {
    const res = await aiService.chat('user-test-1', {
      message: 'did mazdock will be bullist',
    });

    expect(res.message).toContain('MAZDOCK.NS');
    expect(res.message).toContain('4850.75');
    expect(res.message).toContain('68.4');
    expect(res.message).not.toContain('TCS.NS');
    expect(res.structuredAnalysis.sources).toBeDefined();
    expect(
      res.structuredAnalysis.sources.some((s: any) =>
        typeof s === 'string' ? s.includes('MAZDOCK.NS') : s.description?.includes('MAZDOCK.NS'),
      ),
    ).toBe(true);
  });

  it('Test Case 2: handles "tell me about BDL" and extracts BDL.NS without defaulting to TCS', async () => {
    const res = await aiService.chat('user-test-1', {
      message: 'tell me about BDL',
    });

    expect(res.message).toContain('BDL.NS');
    expect(res.message).toContain('1320.6');
    expect(res.message).toContain('52.1');
    expect(res.message).not.toContain('TCS.NS');
    expect(
      res.structuredAnalysis.sources.some((s: any) =>
        typeof s === 'string' ? s.includes('BDL.NS') : s.description?.includes('BDL.NS'),
      ),
    ).toBe(true);
  });

  it('Test Case 3: multi-turn in same session produces distinct grounded responses for each question', async () => {
    // 1st query: MAZDOCK
    const res1 = await aiService.chat('user-test-1', {
      message: 'tell me about MAZDOCK.NS',
    });
    expect(res1.message).toContain('MAZDOCK.NS');

    // 2nd query: BDL in same session
    const res2 = await aiService.chat('user-test-1', {
      sessionId: res1.sessionId,
      message: 'tell me about BDL',
    });
    expect(res2.message).toContain('BDL.NS');
    expect(res2.message).not.toContain('MAZDOCK.NS');

    // 3rd query: RELIANCE in same session
    const res3 = await aiService.chat('user-test-1', {
      sessionId: res1.sessionId,
      message: 'what about RELIANCE',
    });
    expect(res3.message).toContain('RELIANCE.NS');
    expect(res3.message).toContain('2980');
    expect(res3.message).not.toContain('BDL.NS');
  });

  it('Test Case 4: handles BSE stock query "tell me about BLUEJET.BO" and returns grounded BSE data', async () => {
    const res = await aiService.chat('user-test-1', {
      message: 'tell me about BLUEJET.BO',
    });

    expect(res.message).toContain('BLUEJET.BO');
    expect(res.message).toContain('412.5');
    expect(res.structuredAnalysis.riskLevel).toBeDefined();
    expect(res.structuredAnalysis.sources.length).toBeGreaterThan(0);
    expect(
      res.structuredAnalysis.sources.some((s: any) =>
        typeof s === 'string' ? s.includes('BLUEJET.BO') : s.description?.includes('BLUEJET.BO'),
      ),
    ).toBe(true);
  });

  it('Test Case 5: automatically fails over to grounded autonomous pipeline if Anthropic tool loop throws', async () => {
    // Inject mock Anthropic client that throws an error
    (aiService as any).anthropicClient = {
      messages: {
        create: jest.fn().mockRejectedValue(new Error('Anthropic rate limit or network timeout')),
      },
    };

    const res = await aiService.chat('user-test-1', {
      message: 'tell me about MAZDOCK.NS',
    });

    // Verify it fell over to grounded pipeline and returned authentic data rather than failing
    expect(res.message).toContain('MAZDOCK.NS');
    expect(res.message).toContain('4850.75');
    expect(res.structuredAnalysis.confidenceScore).toBeGreaterThan(0);
    expect(res.structuredAnalysis.sources.length).toBeGreaterThan(0);
  });

  it('Test Case 6: Gemini tool loop executes function calls and returns validated analysis', async () => {
    let callCount = 0;
    const mockModel = {
      generateContent: jest.fn().mockImplementation(async ({ contents }) => {
        callCount++;
        if (callCount === 1) {
          // Gemini decides to call getStockQuote
          return {
            response: {
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      {
                        functionCall: {
                          name: 'getStockQuote',
                          args: { symbol: 'TCS.NS' },
                        },
                      },
                    ],
                  },
                },
              ],
              functionCalls: () => [
                {
                  name: 'getStockQuote',
                  args: { symbol: 'TCS.NS' },
                },
              ],
              text: () => '',
            },
          };
        } else {
          // Gemini returns submitStockAnalysis
          return {
            response: {
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      {
                        functionCall: {
                          name: 'submitStockAnalysis',
                          args: {
                            summary: 'TCS exhibits stable IT services revenue with balanced market sentiment.',
                            technicalAnalysis: 'RSI at 55 reflects neutral to positive momentum with 50MA trend alignment.',
                            fundamentalAnalysis: 'P/E of 29.5x with ROE of 48.2% and conservative leverage.',
                            positives: ['Industry leading return on equity', 'Strong client renewal retention'],
                            negatives: ['Global tech enterprise budget constraints'],
                            riskLevel: 'LOW',
                            confidenceScore: 89,
                            sources: [{ type: 'Market Data', description: 'Live quote for TCS.NS' }],
                          },
                        },
                      },
                    ],
                  },
                },
              ],
              functionCalls: () => [
                {
                  name: 'submitStockAnalysis',
                  args: {
                    summary: 'TCS exhibits stable IT services revenue with balanced market sentiment.',
                    technicalAnalysis: 'RSI at 55 reflects neutral to positive momentum with 50MA trend alignment.',
                    fundamentalAnalysis: 'P/E of 29.5x with ROE of 48.2% and conservative leverage.',
                    positives: ['Industry leading return on equity', 'Strong client renewal retention'],
                    negatives: ['Global tech enterprise budget constraints'],
                    riskLevel: 'LOW',
                    confidenceScore: 89,
                    sources: [{ type: 'Market Data', description: 'Live quote for TCS.NS' }],
                  },
                },
              ],
              text: () => '',
            },
          };
        }
      }),
    };

    (aiService as any).geminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    };

    const res = await aiService.chat('user-test-1', {
      message: 'Analyze TCS stock',
    });

    expect(res.structuredAnalysis.riskLevel).toBe('LOW');
    expect(res.structuredAnalysis.confidenceScore).toBe(89);
    expect(res.message).toContain('TCS exhibits stable');
    expect(mockModel.generateContent).toHaveBeenCalledTimes(2);
  });

  it('Test Case 7: Gemini automatically fails over to grounded autonomous pipeline if Gemini tool loop throws', async () => {
    (aiService as any).geminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockRejectedValue(new Error('Google Generative AI quota exceeded')),
      }),
    };

    const res = await aiService.chat('user-test-1', {
      message: 'tell me about BDL',
    });

    // Verify it cleanly fell over to grounded autonomous pipeline
    expect(res.message).toContain('BDL.NS');
    expect(res.message).toContain('1320.6');
    expect(res.structuredAnalysis.riskLevel).toBeDefined();
    expect(res.structuredAnalysis.sources.length).toBeGreaterThan(0);
  });
});
