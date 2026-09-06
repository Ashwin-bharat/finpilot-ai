import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QueryIntent } from '@finpilot/shared-types';

export interface IntentDetectionResult {
  intent: QueryIntent;
  confidence: number;
  reasoning?: string;
}

const VALID_INTENTS: Set<QueryIntent> = new Set([
  'STOCK_ANALYSIS',
  'TECHNICAL_ANALYSIS',
  'FUNDAMENTAL_ANALYSIS',
  'STOCK_COMPARISON',
  'PORTFOLIO_ANALYSIS',
  'MARKET_ANALYSIS',
  'NEWS_ANALYSIS',
  'GENERAL_FINANCIAL_QUESTION',
]);

const INTENT_CLASSIFICATION_PROMPT = `You are a financial query intent classifier for FinPilot AI.
Classify the user's message into EXACTLY ONE of the following 8 intents:
1. STOCK_ANALYSIS - Comprehensive evaluation of a single company or stock (e.g. "Tell me about TCS", "Analyze Reliance", "Should I buy Infosys?").
2. TECHNICAL_ANALYSIS - Focus on price charts, RSI, moving averages (SMA/EMA), MACD, momentum, support/resistance (e.g. "What is the RSI of TCS?", "Is Mazagon Dock above its 50 MA?", "Show MACD for BDL").
3. FUNDAMENTAL_ANALYSIS - Focus on balance sheet, financial ratios, P/E, P/B, ROE, ROCE, debt, earnings, valuation (e.g. "What is the PE ratio of Reliance?", "Is HDFC Bank undervalued based on PB?", "Tell me about TCS debt to equity").
4. STOCK_COMPARISON - Comparing two or more stocks (e.g. "Compare TCS and Infosys", "TCS vs Wipro", "Which is better Mazdock or Cochin Shipyard?").
5. PORTFOLIO_ANALYSIS - User's own portfolio performance, diversification score, asset allocation, holdings (e.g. "How is my portfolio doing?", "What is my diversification score?", "Review my holdings").
6. MARKET_ANALYSIS - Macro market performance, Nifty 50, Sensex, top gainers, top losers, sectoral indices (e.g. "How is the market doing today?", "What are the top gainers on NSE?", "Nifty outlook").
7. NEWS_ANALYSIS - Recent news events, press releases, corporate announcements, headlines, or sentiment (e.g. "Latest news on Tata Motors", "Any recent news about Reliance?").
8. GENERAL_FINANCIAL_QUESTION - Conceptual or educational questions about finance or investing (e.g. "What is RSI?", "How does PE ratio work?", "What is a stop loss?", "Explain SIP").

Respond with ONLY the intent name (one word), nothing else.`;

@Injectable()
export class IntentDetectorService {
  private readonly logger = new Logger(IntentDetectorService.name);
  private geminiClient: GoogleGenerativeAI | null = null;
  private readonly modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim() !== '' && geminiKey !== 'your-gemini-api-key') {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }
  }

  /**
   * Classify user query into one of 8 intents
   */
  async detectIntent(message: string, symbolContext?: string): Promise<IntentDetectionResult> {
    const text = message.trim();
    if (!text) {
      return { intent: 'GENERAL_FINANCIAL_QUESTION', confidence: 50, reasoning: 'Empty query' };
    }

    // 1. If LLM is available, attempt fast single-token classification
    if (this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({
          model: this.modelName,
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 20,
          },
        });

        const prompt = `${INTENT_CLASSIFICATION_PROMPT}\n\nUser Query: "${text}"\nClassification:`;
        const result = await model.generateContent(prompt);
        const rawIntent = result.response.text().trim().toUpperCase().replace(/[^A-Z_]/g, '') as QueryIntent;

        if (VALID_INTENTS.has(rawIntent)) {
          this.logger.log(`LLM detected intent: ${rawIntent} for query: "${text.slice(0, 50)}..."`);
          return {
            intent: rawIntent,
            confidence: 95,
            reasoning: `Classified by ${this.modelName}`,
          };
        }
      } catch (err: any) {
        this.logger.warn(`LLM intent classification failed (${err.message}). Falling back to rule-based classifier.`);
      }
    }

    // 2. High-precision rule-based heuristic classifier
    return this.classifyRuleBased(text, symbolContext);
  }

  /**
   * Deterministic rule-based heuristic classifier
   */
  classifyRuleBased(message: string, symbolContext?: string): IntentDetectionResult {
    const upper = message.toUpperCase().trim();
    const tickerMatches = upper.match(/\b([A-Z0-9_\-]{2,15})\.(NS|BO)\b/g);

    // 1. Portfolio Analysis
    const portfolioKeywords = ['MY PORTFOLIO', 'PORTFOLIO', 'MY HOLDINGS', 'HOLDINGS', 'MY STOCKS', 'DIVERSIFICATION', 'ASSET ALLOCATION', 'MY ALLOCATION', 'MY INVESTMENTS'];
    if (portfolioKeywords.some((k) => upper.includes(k))) {
      return { intent: 'PORTFOLIO_ANALYSIS', confidence: 92, reasoning: 'Matched portfolio keywords' };
    }

    // 2. Stock Comparison (e.g. "Compare TCS and Infosys", "Which is better TCS vs Wipro?")
    const comparisonKeywords = [' VS ', ' VERSUS ', 'WHICH IS BETTER', 'BETTER THAN'];
    const hasComparisonTerm = comparisonKeywords.some((k) => upper.includes(k)) || upper.startsWith('COMPARE') || upper.includes('COMPARE ');
    if (hasComparisonTerm || (tickerMatches && tickerMatches.length >= 2)) {
      return { intent: 'STOCK_COMPARISON', confidence: 92, reasoning: 'Comparison keywords or multiple equities detected' };
    }

    // 3. Market Analysis (Indices / Top Movers / Macro - e.g. "What are the top gainers on NSE today?", "How is the market doing today?")
    const marketKeywords = ['NIFTY', 'SENSEX', 'TOP GAINER', 'TOP GAINERS', 'TOP LOSER', 'TOP LOSERS', 'TOP MOVER', 'TOP MOVERS', 'GAINERS', 'LOSERS', 'MARKET TODAY', 'MARKET CRASH', 'MARKET SENTIMENT', 'INDIAN MARKET', 'INDICES', 'SECTOR PERFORMANCE'];
    if (marketKeywords.some((k) => upper.includes(k)) || (upper.includes('MARKET') && (upper.includes('TODAY') || upper.includes('DOING') || upper.includes('OUTLOOK') || upper.includes('HOW IS')))) {
      return { intent: 'MARKET_ANALYSIS', confidence: 91, reasoning: 'Matched broader market or index keywords' };
    }

    // 4. General Financial Question (Educational/Conceptual e.g. "What is RSI?", "How does PE ratio work?")
    const generalStarters = ['WHAT IS ', 'WHAT ARE ', 'HOW DOES ', 'EXPLAIN ', 'TELL ME ABOUT WHAT ', 'DIFFERENCE BETWEEN ', 'HOW TO INVEST', 'DEFINE '];
    const hasStockTarget = tickerMatches?.length || upper.includes(' OF ') || upper.includes(' FOR ') || upper.includes(' IN ') || symbolContext;
    const isEducational = generalStarters.some((prefix) => upper.startsWith(prefix)) && !hasStockTarget;
    if (isEducational) {
      return { intent: 'GENERAL_FINANCIAL_QUESTION', confidence: 90, reasoning: 'Educational / conceptual question without specific stock target' };
    }

    // 5. Technical Keywords
    const technicalKeywords = [
      'RSI',
      'MOVING AVERAGE',
      'SMA',
      'EMA',
      'MACD',
      'SUPPORT',
      'RESISTANCE',
      'MOMENTUM',
      'OVERBOUGHT',
      'OVERSOLD',
      'GOLDEN CROSS',
      'DEATH CROSS',
      'TECHNICAL',
      'TECHNICALS',
      'CHART',
      'TREND ALIGNMENT',
      '50 MA',
      '200 MA',
      '50-DAY',
      '200-DAY',
      'ORDER BLOCK',
      'FVG',
      'PIVOT',
    ];

    // 6. Fundamental Keywords
    const fundamentalKeywords = [
      'P/E',
      'PE RATIO',
      'P/B',
      'PB RATIO',
      'ROE',
      'ROCE',
      'EPS',
      'DEBT TO EQUITY',
      'DEBT-TO-EQUITY',
      'DEBT',
      'BALANCE SHEET',
      'DIVIDEND',
      'DIVIDEND YIELD',
      'VALUATION',
      'MARKET CAP',
      'PROFIT MARGIN',
      'FINANCIAL RATIO',
      'UNDERVALUED',
      'OVERVALUED',
      'DCF',
      'PIOTROSKI',
      'GRAHAM NUMBER',
      'INTRINSIC VALUE',
      'FUNDAMENTAL',
      'FUNDAMENTALS',
    ];

    const hasTechnicalKeywords = technicalKeywords.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(upper));
    const hasFundamentalKeywords = fundamentalKeywords.some((k) => new RegExp(`\\b${k.replace('/', '\\/')}\\b`, 'i').test(upper));

    // Multi-discipline queries asking for both technicals & fundamentals, or comprehensive/cross-engine reviews, route to STOCK_ANALYSIS
    if (
      (hasTechnicalKeywords && hasFundamentalKeywords) ||
      upper.includes('COMPREHENSIVE') ||
      upper.includes('CROSS-ENGINE') ||
      upper.includes('FULL ANALYSIS') ||
      upper.includes('COMPLETE ANALYSIS') ||
      upper.includes('HOLISTIC')
    ) {
      return { intent: 'STOCK_ANALYSIS', confidence: 92, reasoning: 'Multi-discipline or comprehensive cross-engine stock inquiry' };
    }

    if (hasTechnicalKeywords) {
      return { intent: 'TECHNICAL_ANALYSIS', confidence: 94, reasoning: 'Matched technical indicator keywords' };
    }

    if (hasFundamentalKeywords) {
      return { intent: 'FUNDAMENTAL_ANALYSIS', confidence: 94, reasoning: 'Matched fundamental financial metric keywords' };
    }


    // 7. News Analysis
    const newsKeywords = ['NEWS', 'HEADLINE', 'HEADLINES', 'ANNOUNCEMENT', 'LATEST UPDATE', 'MEDIA', 'SENTIMENT'];
    if (newsKeywords.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(upper))) {
      return { intent: 'NEWS_ANALYSIS', confidence: 90, reasoning: 'Matched news / media keywords' };
    }

    // 8. Stock Analysis (Default for company inquiries or when symbolContext is supplied)
    return {
      intent: 'STOCK_ANALYSIS',
      confidence: 80,
      reasoning: 'Default single stock equity inquiry',
    };
  }
}
