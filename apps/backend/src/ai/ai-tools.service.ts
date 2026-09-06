import { Injectable, Logger } from '@nestjs/common';
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
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    private readonly marketService: MarketService,
    private readonly indicatorsService: IndicatorsService,
    private readonly newsService: NewsService,
    private readonly portfolioService: PortfolioService,
    private readonly technicalEngine: TechnicalAnalysisEngine,
    private readonly marketStructureEngine: MarketStructureEngine,
    private readonly fundamentalEngine: FundamentalAnalysisEngine,
    private readonly riskEngine: RiskAnalysisEngine,
    private readonly newsIntelligenceEngine: NewsIntelligenceEngine,
    private readonly portfolioIntelligenceEngine: PortfolioIntelligenceEngine,
    private readonly crossEngineSynthesisEngine: CrossEngineSynthesisEngine,
    private readonly cryptoMarketService: CryptoMarketService,
    private readonly prisma: PrismaService,
  ) {}

  getToolDefinitions() {
    return [
      {
        name: 'getStockQuote',
        description: 'Fetch live market price, percentage change, and basic company details for a stock ticker symbol (e.g. TCS.NS, INFY.NS, RELIANCE.NS).',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The NSE stock ticker symbol (e.g. TCS.NS, INFY.NS, RELIANCE.NS, HDFCBANK.NS, TATAMOTORS.NS)',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getFundamentals',
        description: 'Fetch audited fundamental valuation ratios (P/E ratio, P/B ratio, ROE, ROCE, EPS, Debt-to-Equity, Market Cap, Fiscal Period) for a stock.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The NSE stock ticker symbol',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getTechnicalIndicators',
        description: 'Compute 14-period RSI, 50-day and 200-day Simple Moving Averages, and MACD (12, 26, 9) momentum indicators mathematically from historical price points.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The NSE stock ticker symbol',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getAdvancedTechnicalAnalysis',
        description: 'Compute institutional-grade technical models: 14-day ATR & volatility regimes, Bollinger Bands (%B & squeeze metrics), Stochastic Oscillator (%K, %D & momentum status), Volume Weighted Average Price (VWAP institutional bias), Floor Trader Pivots (R1/R2/S1/S2 & swing extrema), and Multi-Timeframe trend confluence.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The stock ticker symbol (e.g. TCS.NS, INFY.NS, RELIANCE.NS)',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getMarketStructure',
        description: 'Compute institutional smart-money concepts (SMC): fractal swing points (HH/HL/LH/LL), trend classification & break of structure (BOS/CHoCH), order block zones (bullish demand & bearish supply) with mitigation tracking, 3-candle fair value gaps (FVG imbalances), liquidity sweeps, and 50% equilibrium dealing ranges (premium vs discount).',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The stock ticker symbol (e.g. TCS.NS, INFY.NS, RELIANCE.NS)',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getFundamentalAnalysis',
        description: 'Perform institutional-grade fundamental equity valuation: 2-stage Discounted Cash Flow (DCF) model with Margin of Safety %, Benjamin Graham Number defensive valuation, 9-point Piotroski F-Score financial health diagnostic, and sector comparative multiple benchmarking.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The stock ticker symbol (e.g. TCS.NS, INFY.NS, RELIANCE.NS, TCS.BO)',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getRecentNews',
        description: 'Fetch recent market news articles and sentiment classification for a specific ticker symbol.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The NSE stock ticker symbol',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getPortfolioAnalysis',
        description: 'Fetch authenticated user active portfolio valuation, total investment, sector distribution, holdings count, and diversification score. Use ONLY when the user asks about their own portfolio.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'getRiskAnalysis',
        description: 'Compute institutional risk metrics: 60-day historical annualized volatility, Beta vs NIFTY 50 (^NSEI), peak-to-trough Maximum Drawdown with real dates, 95% 1-day Historical Simulation Value at Risk (VaR), and transparent composite risk score (0-100).',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The stock ticker symbol (e.g. TCS.NS, INFY.NS, RELIANCE.NS)',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getNewsIntelligence',
        description: 'Run advanced news intelligence on financial media headlines: near-duplicate headline merging, direct vs tangential relevance scoring, sentiment distribution breakdown, and exponential recency decay weighting.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The stock ticker symbol (e.g. TCS.NS, INFY.NS, RELIANCE.NS)',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'getPortfolioIntelligence',
        description: 'Compute institutional portfolio intelligence strictly for authenticated user: top and worst P&L contributors, concentration alerts (>25% holding/sector), and pairwise daily returns Pearson correlation matrix.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'submitStockAnalysis',
        description: 'Submit the final structured stock or portfolio analysis adhering to the enforced schema. You MUST use this tool to deliver your final answer.',
        input_schema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Concise executive summary of current market positioning, valuation, and momentum indicators. Must avoid absolute certainty phrasing.',
            },
            technicalAnalysis: {
              type: 'string',
              description: 'Detailed analysis of RSI, 50/200 MA trend alignment, and MACD momentum based on computed indicators.',
            },
            fundamentalAnalysis: {
              type: 'string',
              description: 'Detailed analysis of valuation ratios (P/E, P/B), profitability (ROE/ROCE), debt levels, and market capitalization.',
            },
            positives: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of constructive factors (e.g. solid margins, RSI support, low debt, favorable sector trends).',
            },
            negatives: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of risk factors / headwinds (e.g. high valuation multiple, elevated debt, macroeconomic slowdown).',
            },
            riskLevel: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH'],
              description: 'Overall risk assessment based on volatility, leverage, and valuation.',
            },
            confidenceScore: {
              type: 'number',
              description: 'Confidence rating from 0 to 100 based on data completeness and signal alignment.',
            },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Category of tool or data source used' },
                  description: { type: 'string', description: 'Specific metric or service queried' },
                },
                required: ['type', 'description'],
              },
              description: 'List of internal tools and data sources queried during analysis.',
            },
          },
          required: [
            'summary',
            'technicalAnalysis',
            'fundamentalAnalysis',
            'positives',
            'negatives',
            'riskLevel',
            'confidenceScore',
            'sources',
          ],
        },
      },
      {
        name: 'getCrossEngineSynthesis',
        description:
          'Compute holistic cross-engine synthesis unifying technical, market structure, fundamental valuation, risk profile, and news intelligence with directional vectors, conflict scoring, and tactical playbook.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The NSE stock ticker symbol (e.g. TCS.NS, INFY.NS, RELIANCE.NS)',
            },
          },
          required: ['symbol'],
        },
      },
    ];
  }

  async executeTool(toolName: string, toolInput: any, userId: string): Promise<{ result: any; sourceRecord?: { type: string; description: string } }> {
    this.logger.log(`Executing AI Tool: ${toolName} with input: ${JSON.stringify(toolInput)} for user: ${userId}`);

    switch (toolName) {
      case 'getStockQuote': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();

        // Check if cryptocurrency
        const cryptoAsset = this.prisma.cryptoAsset?.findFirst
          ? await this.prisma.cryptoAsset.findFirst({ where: { symbol } })
          : null;
        if (cryptoAsset) {
          const q = await this.cryptoMarketService.getQuote(symbol);
          return {
            result: {
              symbol: q.data.symbol,
              name: q.data.name,
              currentPrice: q.data.currentPrice,
              change: q.data.change,
              changePercent: q.data.changePercent,
              exchange: 'COINDCX',
              sector: q.data.category || 'Cryptocurrency',
            },
            sourceRecord: {
              type: 'CoinDCX Crypto Market Data',
              description: `${q.data.symbol} Live Price ₹${q.data.currentPrice} (${q.data.changePercent}%) [CoinDCX]`,
            },
          };
        }

        const quote = await this.marketService.getStockBySymbol(symbol);
        return {
          result: {
            symbol: quote.symbol,
            name: quote.name,
            currentPrice: quote.currentPrice,
            change: quote.change,
            changePercent: quote.changePercent,
            exchange: quote.exchange,
            sector: quote.sector,
          },
          sourceRecord: {
            type: 'Live Market Data',
            description: `${quote.symbol} Live Price ₹${quote.currentPrice} (${quote.changePercent}%)`,
          },
        };
      }

      case 'getFundamentals': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();

        // Check if cryptocurrency (Part D: Fundamentals explicitly skipped)
        const cryptoAsset = this.prisma.cryptoAsset?.findFirst
          ? await this.prisma.cryptoAsset.findFirst({ where: { symbol } })
          : null;
        if (cryptoAsset) {
          return {
            result: {
              applicable: false,
              reason: 'Fundamental equity valuation models (P/E, P/B, ROE, Debt/Equity) are not applicable to decentralized cryptocurrencies.',
            },
            sourceRecord: {
              type: 'Asset Class Policy',
              description: `${symbol}: Fundamentals skipped (Not applicable to cryptocurrencies)`,
            },
          };
        }

        let stockDetail = await this.marketService.getStockBySymbol(symbol);
        let fundamentals = stockDetail.fundamentals;

        if (!fundamentals && symbol.endsWith('.BO')) {
          const nseSym = symbol.replace(/\.BO$/, '.NS');
          try {
            const nseDetail = await this.marketService.getStockBySymbol(nseSym);
            if (nseDetail.fundamentals) {
              fundamentals = nseDetail.fundamentals;
            }
          } catch (e) {
            // Ignore error
          }
        }

        return {
          result: fundamentals || { status: 'Not available for this ticker' },
          sourceRecord: {
            type: 'Financial Fundamentals',
            description: `${symbol} P/E: ${fundamentals?.peRatio ?? 'N/A'}, ROE: ${fundamentals?.roe ?? 'N/A'}%`,
          },
        };
      }

      case 'getTechnicalIndicators': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
        let history = toolInput?.history;
        let currentPrice = toolInput?.currentPrice;

        // Check if cryptocurrency
        const cryptoAsset = this.prisma.cryptoAsset?.findFirst
          ? await this.prisma.cryptoAsset.findFirst({ where: { symbol } })
          : null;

        if (cryptoAsset) {
          if (!history || currentPrice === undefined) {
            const [qRes, hRes] = await Promise.all([
              this.cryptoMarketService.getQuote(symbol),
              this.cryptoMarketService.getHistory(symbol, '1y'),
            ]);
            currentPrice = currentPrice ?? (qRes.data.currentPrice || 100);
            history = history ?? hRes.data;
          }
          const indicators = await this.indicatorsService.calculateIndicators(symbol, history, currentPrice);
          return {
            result: indicators,
            sourceRecord: {
              type: 'Crypto Technical Engine',
              description: `${symbol} Crypto RSI: ${indicators.rsi.value} (${indicators.rsi.interpretation}), 50MA: ₹${indicators.sma50.value}, MACD: ${indicators.macd.histogram}`,
            },
          };
        }

        const indicators = await this.indicatorsService.calculateIndicators(symbol, history, currentPrice);
        return {
          result: indicators,
          sourceRecord: {
            type: 'Technical Engine',
            description: `${symbol} RSI: ${indicators.rsi.value}, 50MA: ₹${indicators.sma50.value}, MACD: ${indicators.macd.histogram}`,
          },
        };
      }

      case 'getAdvancedTechnicalAnalysis': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
        let currentPrice = toolInput?.currentPrice;
        let history = toolInput?.history;
        if (!history || currentPrice === undefined) {
          const cryptoAsset = this.prisma.cryptoAsset?.findFirst
            ? await this.prisma.cryptoAsset.findFirst({ where: { symbol } })
            : null;
          if (cryptoAsset) {
            const [qRes, hRes] = await Promise.all([
              currentPrice === undefined ? this.cryptoMarketService.getQuote(symbol) : Promise.resolve({ data: { currentPrice } }),
              !history ? this.cryptoMarketService.getHistory(symbol, '1y') : Promise.resolve({ data: history }),
            ]);
            currentPrice = currentPrice ?? (qRes.data.currentPrice || 100);
            history = history ?? hRes.data;
          } else {
            const [quote, fetchedHistory] = await Promise.all([
              currentPrice === undefined ? this.marketService.getStockBySymbol(symbol) : Promise.resolve({ currentPrice }),
              !history ? this.marketService.getHistory(symbol, '1y') : Promise.resolve(history),
            ]);
            currentPrice = currentPrice ?? (quote.currentPrice || 1000);
            history = history ?? fetchedHistory;
          }
        }
        const advanced = this.technicalEngine.analyze(symbol, currentPrice, history);
        return {
          result: advanced,
          sourceRecord: {
            type: 'Institutional Technical Engine',
            description: `${symbol} Confluence: ${advanced.confluenceScore}/100 (${advanced.rating}), ATR: ₹${advanced.atr.value}, VWAP: ₹${advanced.vwap.vwap}`,
          },
        };
      }

      case 'getMarketStructure': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
        let currentPrice = toolInput?.currentPrice;
        let history = toolInput?.history;
        if (!history || currentPrice === undefined) {
          const cryptoAsset = this.prisma.cryptoAsset?.findFirst
            ? await this.prisma.cryptoAsset.findFirst({ where: { symbol } })
            : null;
          if (cryptoAsset) {
            const [qRes, hRes] = await Promise.all([
              currentPrice === undefined ? this.cryptoMarketService.getQuote(symbol) : Promise.resolve({ data: { currentPrice } }),
              !history ? this.cryptoMarketService.getHistory(symbol, '1y') : Promise.resolve({ data: history }),
            ]);
            currentPrice = currentPrice ?? (qRes.data.currentPrice || 100);
            history = history ?? hRes.data;
          } else {
            const [quote, fetchedHistory] = await Promise.all([
              currentPrice === undefined ? this.marketService.getStockBySymbol(symbol) : Promise.resolve({ currentPrice }),
              !history ? this.marketService.getHistory(symbol, '1y') : Promise.resolve(history),
            ]);
            currentPrice = currentPrice ?? (quote.currentPrice || 1000);
            history = history ?? fetchedHistory;
          }
        }
        const structure = this.marketStructureEngine.analyze(symbol, currentPrice, history);
        return {
          result: structure,
          sourceRecord: {
            type: 'Market Structure Engine',
            description: `${symbol} Trend: ${structure.trend}, Zone: ${structure.dealingRange.currentZone} (${structure.dealingRange.relativePositionPercent}%), Rating: ${structure.structureRating}`,
          },
        };
      }

      case 'getFundamentalAnalysis': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();

        // Check if cryptocurrency (Part D: Fundamentals explicitly skipped)
        const cryptoAsset = this.prisma.cryptoAsset?.findFirst
          ? await this.prisma.cryptoAsset.findFirst({ where: { symbol } })
          : null;
        if (cryptoAsset) {
          return {
            result: {
              applicable: false,
              reason: 'Discounted Cash Flow, Benjamin Graham Number, and Piotroski F-Score models are not applicable to cryptocurrencies.',
            },
            sourceRecord: {
              type: 'Asset Class Policy',
              description: `${symbol}: Fundamental analysis skipped (Not applicable to cryptocurrencies)`,
            },
          };
        }

        let stockDetail = await this.marketService.getStockBySymbol(symbol);
        let fundamentals = stockDetail.fundamentals;
        let sector = stockDetail.sector;
        let industry = stockDetail.industry;
        let name = stockDetail.name || symbol;

        if (symbol.endsWith('.BO')) {
          const nseSym = symbol.replace(/\.BO$/, '.NS');
          try {
            const nseDetail = await this.marketService.getStockBySymbol(nseSym);
            if (nseDetail.fundamentals && !fundamentals) {
              fundamentals = nseDetail.fundamentals;
            }
            if (nseDetail.sector && (!sector || sector === 'Diversified' || sector === 'General')) {
              sector = nseDetail.sector;
            }
            if (nseDetail.industry && (!industry || industry === 'General')) {
              industry = nseDetail.industry;
            }
            if (nseDetail.name && (!name || name === symbol)) {
              name = nseDetail.name;
            }
          } catch (e) {
            // Ignore error
          }
        }

        const currentPrice = stockDetail.currentPrice || 1000;
        const fundamentalResult = this.fundamentalEngine.analyze(
          symbol,
          name,
          currentPrice,
          fundamentals,
          sector,
          industry,
        );

        return {
          result: fundamentalResult,
          sourceRecord: {
            type: 'Fundamental Valuation Engine',
            description: `${symbol} Rating: ${fundamentalResult.overallRating}, DCF Intrinsic: ₹${fundamentalResult.dcf.intrinsicValue} (${fundamentalResult.dcf.marginOfSafetyPercent}%), Piotroski: ${fundamentalResult.piotroski.score}/9`,
          },
        };
      }

      case 'getRecentNews': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
        const news = await this.newsService.getNews(symbol, 4);
        return {
          result: news.articles.map((a) => ({
            title: a.title,
            source: a.source,
            sentiment: a.sentiment,
            publishedAt: a.publishedAt,
            summary: a.summary,
          })),
          sourceRecord: {
            type: 'Market News Feed',
            description: `${news.articles.length} indexed articles (Provider: ${news.source})`,
          },
        };
      }

      case 'getPortfolioAnalysis': {
        const analysis = await this.portfolioService.getAnalysis(userId);
        return {
          result: analysis,
          sourceRecord: {
            type: 'Portfolio Analytics',
            description: `Valuation: ₹${analysis.currentValue}, Diversification: ${analysis.diversificationScore}/100`,
          },
        };
      }

      case 'getRiskAnalysis': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
        let stockDetail = toolInput?.stockDetail;
        let history = toolInput?.history;
        let currentPrice = toolInput?.currentPrice;
        let benchmarkHistory = toolInput?.benchmarkHistory;

        // Check if cryptocurrency
        const cryptoAsset = this.prisma.cryptoAsset?.findFirst
          ? await this.prisma.cryptoAsset.findFirst({ where: { symbol } })
          : null;
        if (cryptoAsset) {
          if (!history || currentPrice === undefined) {
            const [qRes, hRes] = await Promise.all([
              this.cryptoMarketService.getQuote(symbol),
              this.cryptoMarketService.getHistory(symbol, '1y'),
            ]);
            currentPrice = currentPrice ?? (qRes.data.currentPrice || 100);
            history = history ?? hRes.data;
          }
          if (!benchmarkHistory) {
            try {
              const btcHistoryRes = await this.cryptoMarketService.getHistory('BTC', '1y');
              benchmarkHistory = btcHistoryRes.data;
            } catch (err: any) {
              this.logger.warn(`Failed to fetch BTC benchmark history for crypto risk analysis: ${err.message}`);
            }
          }

          const risk = this.riskEngine.analyze(
            symbol,
            currentPrice,
            history,
            benchmarkHistory,
            null,
            60,
            { assetClass: 'CRYPTO', benchmarkSymbol: 'BTC' },
          );

          return {
            result: risk,
            sourceRecord: {
              type: 'Cryptocurrency Risk Engine',
              description: `${symbol} Crypto Vol: ${risk.volatility.annualizedVolatilityPercent}% (${risk.volatility.interpretation}), Beta vs BTC: ${risk.beta.value ?? 'INSUFFICIENT_DATA'}, MaxDD: ${risk.maxDrawdown.drawdownPercent}%`,
            },
          };
        }

        if (!history || !stockDetail) {
          const [fetchedDetail, fetchedHistory] = await Promise.all([
            !stockDetail ? this.marketService.getStockBySymbol(symbol) : Promise.resolve(stockDetail),
            !history ? this.marketService.getHistory(symbol, '1y') : Promise.resolve(history),
          ]);
          stockDetail = stockDetail ?? fetchedDetail;
          history = history ?? fetchedHistory;
        }
        const effectivePrice = currentPrice ?? (stockDetail?.currentPrice || 1000);

        if (!benchmarkHistory) {
          try {
            benchmarkHistory = await this.marketService.getHistory('^NSEI', '1y');
          } catch (err: any) {
            this.logger.warn(`Failed to fetch ^NSEI benchmark history: ${err.message}`);
          }
        }

        const risk = this.riskEngine.analyze(
          symbol,
          effectivePrice,
          history,
          benchmarkHistory,
          stockDetail.fundamentals,
          60,
        );

        return {
          result: risk,
          sourceRecord: {
            type: 'Risk Analysis Engine',
            description: `${symbol} Risk Score: ${risk.compositeRiskScore.score}/100 (${risk.compositeRiskScore.riskLevel}), Volatility: ${risk.volatility.annualizedVolatilityPercent}%, Beta: ${risk.beta.value ?? 'INSUFFICIENT_DATA'}, MaxDD: ${risk.maxDrawdown.drawdownPercent}%`,
          },
        };
      }

      case 'getNewsIntelligence': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
        const [stockDetail, rawNews] = await Promise.all([
          this.marketService.getStockBySymbol(symbol).catch(() => ({ name: symbol })),
          this.newsService.getNews(symbol, 10),
        ]);

        const newsIntel = this.newsIntelligenceEngine.analyze(
          rawNews.articles,
          rawNews.source,
          rawNews.isMock,
          symbol,
          stockDetail.name,
        );

        return {
          result: newsIntel,
          sourceRecord: {
            type: 'News Intelligence Engine',
            description: `${newsIntel.uniqueArticlesCount} unique articles (${newsIntel.duplicatesRemovedCount} merged), Sentiment: ${newsIntel.temporalWeighting.weightedSentiment} (Score: ${newsIntel.temporalWeighting.weightedScore})`,
          },
        };
      }

      case 'getPortfolioIntelligence': {
        const portIntel = await this.portfolioIntelligenceEngine.analyze(userId);
        return {
          result: portIntel,
          sourceRecord: {
            type: 'Portfolio Intelligence Engine',
            description: `Holdings: ${portIntel.holdingsCount}, Profit: ₹${portIntel.totalProfit}, Top: ${portIntel.topContributors[0]?.symbol || 'None'}, Concentration Risk: ${portIntel.concentrationAnalysis.hasConcentrationRisk ? 'Yes' : 'No'}`,
          },
        };
      }

      case 'getCrossEngineSynthesis': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
        // Fetch quote, 1-year OHLCV history, and benchmark ONCE to guarantee an identical dataset across all engines
        const [quoteRes, history, benchmarkHistory] = await Promise.all([
          this.executeTool('getStockQuote', { symbol }, userId),
          this.marketService.getHistory(symbol, '1y'),
          this.marketService.getHistory('^NSEI', '1y').catch(() => null),
        ]);
        const currentPrice = quoteRes.result.currentPrice || 1000;

        const [indRes, advRes, msRes, fundRes, advFundRes, riskRes, newsRes] =
          await Promise.all([
            this.executeTool('getTechnicalIndicators', { symbol, history, currentPrice }, userId),
            this.executeTool('getAdvancedTechnicalAnalysis', { symbol, history, currentPrice }, userId),
            this.executeTool('getMarketStructure', { symbol, history, currentPrice }, userId),
            this.executeTool('getFundamentals', { symbol }, userId),
            this.executeTool('getFundamentalAnalysis', { symbol }, userId),
            this.executeTool('getRiskAnalysis', { symbol, history, currentPrice, benchmarkHistory }, userId),
            this.executeTool('getNewsIntelligence', { symbol }, userId),
          ]);

        let userHolding: any = undefined;
        if (userId) {
          try {
            const portfolio = await this.portfolioService.getPortfolio(userId);
            const holding = portfolio?.holdings?.find(
              (h: any) => h.stock?.symbol?.toUpperCase() === symbol.toUpperCase(),
            );
            if (holding) {
              const currentP = quoteRes.result.currentPrice || holding.stock?.currentPrice || 0;
              const currentValue = holding.quantity * currentP;
              const totalCost = holding.quantity * holding.avgBuyPrice;
              const unrealizedPnl = currentValue - totalCost;
              const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;
              const allocationPercent =
                portfolio.totalValue > 0 ? (currentValue / portfolio.totalValue) * 100 : 0;
              userHolding = {
                shares: holding.quantity,
                avgPrice: holding.avgBuyPrice,
                currentValue,
                allocationPercent,
                unrealizedPnl,
                unrealizedPnlPercent,
              };
            }
          } catch (e) {
            // Portfolio context is optional
          }
        }

        const synthesis = this.crossEngineSynthesisEngine.synthesize({
          symbol,
          quote: quoteRes.result,
          indicators: indRes.result,
          advancedTechnical: advRes.result,
          marketStructure: msRes.result,
          fundamentals: fundRes.result,
          advancedFundamentals: advFundRes.result,
          riskAnalysis: riskRes.result,
          newsIntelligence: newsRes.result,
          userHolding,
        });

        return {
          result: synthesis,
          sourceRecord: {
            type: 'Cross-Engine Synthesis Pipeline',
            description: `${symbol} Alignment: ${synthesis.signalAlignment}, Conflict: ${synthesis.conflictScore}/100, Confluence: ${synthesis.confluenceScore}/100, Conviction: ${synthesis.convictionLevel}`,
          },
        };
      }

      default:
        return { result: { error: `Tool ${toolName} is not recognized` } };
    }
  }
}
