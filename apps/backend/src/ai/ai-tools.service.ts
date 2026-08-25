import { Injectable, Logger } from '@nestjs/common';
import { MarketService } from '../market/market.service';
import { IndicatorsService } from '../market/indicators.service';
import { NewsService } from '../news/news.service';
import { PortfolioService } from '../portfolio/portfolio.service';

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    private readonly marketService: MarketService,
    private readonly indicatorsService: IndicatorsService,
    private readonly newsService: NewsService,
    private readonly portfolioService: PortfolioService,
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
    ];
  }

  async executeTool(toolName: string, toolInput: any, userId: string): Promise<{ result: any; sourceRecord?: { type: string; description: string } }> {
    this.logger.log(`Executing AI Tool: ${toolName} with input: ${JSON.stringify(toolInput)} for user: ${userId}`);

    switch (toolName) {
      case 'getStockQuote': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
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
        const stockDetail = await this.marketService.getStockBySymbol(symbol);
        return {
          result: stockDetail.fundamentals || { status: 'Not available for this ticker' },
          sourceRecord: {
            type: 'Financial Fundamentals',
            description: `${symbol} P/E: ${stockDetail.fundamentals?.peRatio ?? 'N/A'}, ROE: ${stockDetail.fundamentals?.roe ?? 'N/A'}%`,
          },
        };
      }

      case 'getTechnicalIndicators': {
        const symbol = String(toolInput?.symbol || 'TCS.NS').toUpperCase();
        const indicators = await this.indicatorsService.calculateIndicators(symbol);
        return {
          result: indicators,
          sourceRecord: {
            type: 'Technical Engine',
            description: `${symbol} RSI: ${indicators.rsi.value}, 50MA: ₹${indicators.sma50.value}, MACD: ${indicators.macd.histogram}`,
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

      default:
        return { result: { error: `Tool ${toolName} is not recognized` } };
    }
  }
}
