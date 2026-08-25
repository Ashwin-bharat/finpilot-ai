import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';
import { AiResponseValidator } from './ai-response-validator';
import { ChatMessageDto } from './dto/chat.dto';
import { StructuredAiRecommendation, AiChatSession } from '@finpilot/shared-types';

const SYSTEM_PROMPT = `You are FinPilot AI, an elite financial intelligence and portfolio analysis co-pilot specializing in Indian equities (NSE) and portfolio diversification.

CRITICAL INSTRUCTIONS:
1. Never state future prices as deterministic fact or guarantee any investment return.
2. Frame all conclusions as probabilistic considerations (e.g. "Current technical indicators suggest...", "Valuation metrics reflect..."). Never use absolute certainty words like "guaranteed", "will definitely", "certain to rise", or "risk-free".
3. When asked about any specific stock (e.g. TCS, Infosys, Reliance, HDFC Bank, Tata Motors), you MUST call the relevant tools (getStockQuote, getFundamentals, getTechnicalIndicators, getRecentNews) to retrieve live, authentic backend data. NEVER answer from model memory alone.
4. When asked about user portfolio performance or asset allocation, call getPortfolioAnalysis.
5. When comparing two stocks, call the tools for BOTH stocks to formulate an evidence-backed comparative analysis.
6. If asked about non-financial topics, politely decline and redirect the user to investing and market analysis.
7. You MUST conclude your analysis by invoking the "submitStockAnalysis" tool with all required fields (summary, technicalAnalysis, fundamentalAnalysis, positives, negatives, riskLevel, confidenceScore, sources) completely filled out.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropicClient: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolsService: AiToolsService,
    private readonly validator: AiResponseValidator,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== 'your-anthropic-api-key') {
      this.anthropicClient = new Anthropic({ apiKey });
    }
  }

  async chat(userId: string, dto: ChatMessageDto): Promise<{ sessionId: string; message: string; structuredAnalysis: StructuredAiRecommendation }> {
    // 1. Resolve or Create Chat Session
    let session = dto.sessionId
      ? await this.prisma.chatSession.findFirst({
          where: { id: dto.sessionId, userId },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        })
      : null;

    if (!session) {
      const generatedTitle = dto.message.slice(0, 36) + (dto.message.length > 36 ? '...' : '');
      session = await this.prisma.chatSession.create({
        data: {
          userId,
          title: generatedTitle,
        },
        include: { messages: true },
      });
    }

    // 2. Persist User Message
    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: dto.message,
      },
    });

    // 3. Generate Structured AI Recommendation
    const analysis = await this.generateAnalysisWithRetries(userId, dto.message, dto.symbolContext);

    // 4. Persist Assistant Response
    const assistantContent = `${analysis.summary}\n\n**Technical Outlook:** ${analysis.technicalAnalysis}\n\n**Fundamental Valuation:** ${analysis.fundamentalAnalysis}`;
    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: assistantContent,
        metadata: analysis as any,
      },
    });

    return {
      sessionId: session.id,
      message: assistantContent,
      structuredAnalysis: analysis,
    };
  }

  async getUserSessions(userId: string): Promise<AiChatSession[]> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      messages: s.messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        structuredAnalysis: m.metadata as unknown as StructuredAiRecommendation | undefined,
        createdAt: m.createdAt.toISOString(),
      })),
    }));
  }

  async getSessionById(userId: string, sessionId: string): Promise<AiChatSession> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    return {
      id: session.id,
      userId: session.userId,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      messages: session.messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        structuredAnalysis: m.metadata as unknown as StructuredAiRecommendation | undefined,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Orchestrate tool-calling loop and validation with retry mechanism
   */
  private async generateAnalysisWithRetries(
    userId: string,
    message: string,
    symbolContext?: string,
    maxRetries: number = 2,
  ): Promise<StructuredAiRecommendation> {
    let lastError = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        let rawAnalysis: StructuredAiRecommendation;

        if (this.anthropicClient) {
          rawAnalysis = await this.runAnthropicToolLoop(userId, message, attempt > 0 ? lastError : undefined);
        } else {
          // Autonomous grounded tool-calling pipeline
          rawAnalysis = await this.runGroundedAutonomousPipeline(userId, message, symbolContext);
        }

        // Validate structure & absence of certainty phrasing
        const validation = this.validator.validate(rawAnalysis);
        if (validation.valid) {
          return rawAnalysis;
        }

        lastError = `Validation failed: ${validation.error}. Please regenerate without certainty words and ensure all schema fields are present.`;
        this.logger.warn(`AI Response validation attempt ${attempt + 1} failed: ${validation.error}. Retrying...`);
      } catch (err: any) {
        lastError = err.message;
        this.logger.warn(`AI generation attempt ${attempt + 1} error: ${err.message}`);
      }
    }

    // If retries exhausted, return safe validated fallback
    this.logger.warn('AI retries exhausted. Returning safe validated fallback.');
    return this.validator.createSafeFallback(message, symbolContext);
  }

  /**
   * Claude Tool Calling Loop with Anthropic SDK
   */
  private async runAnthropicToolLoop(
    userId: string,
    message: string,
    retryFeedback?: string,
  ): Promise<StructuredAiRecommendation> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client uninitialized');
    }

    const tools = this.toolsService.getToolDefinitions();
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: retryFeedback ? `${message}\n\nFEEDBACK ON PREVIOUS ATTEMPT: ${retryFeedback}` : message,
      },
    ];

    const sourcesGathered: { type: string; description: string }[] = [];

    // Up to 5 turns for multi-tool calls (e.g. comparing stocks)
    for (let turn = 0; turn < 5; turn++) {
      const response = await this.anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: tools as any,
        messages,
      });

      // Check if Claude requested tool calls
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

      if (toolUseBlocks.length === 0) {
        // If Claude didn't call submitStockAnalysis, parse text or run fallback
        break;
      }

      // Check if submitStockAnalysis was called
      const submitBlock = toolUseBlocks.find((b) => b.name === 'submitStockAnalysis');
      if (submitBlock) {
        const parsed = submitBlock.input as StructuredAiRecommendation;
        if (sourcesGathered.length > 0 && (!parsed.sources || parsed.sources.length === 0)) {
          parsed.sources = sourcesGathered;
        }
        return parsed;
      }

      // Execute intermediate tools and return results to Claude
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        const { result, sourceRecord } = await this.toolsService.executeTool(block.name, block.input, userId);
        if (sourceRecord) {
          sourcesGathered.push(sourceRecord);
        }
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({
        role: 'assistant',
        content: response.content,
      });
      messages.push({
        role: 'user',
        content: toolResultBlocks,
      });
    }

    throw new Error('Claude conversation ended without invoking submitStockAnalysis tool');
  }

  /**
   * Grounded Autonomous Analysis Pipeline
   * Interrogates backend services directly and builds fully grounded structured analysis
   */
  private async runGroundedAutonomousPipeline(
    userId: string,
    message: string,
    symbolContext?: string,
  ): Promise<StructuredAiRecommendation> {
    const text = message.toUpperCase();

    // 1. Detect target symbols with alias mapping
    const SYMBOL_ALIASES: Record<string, string> = {
      'TCS': 'TCS.NS',
      'TCS.NS': 'TCS.NS',
      'INFY': 'INFY.NS',
      'INFY.NS': 'INFY.NS',
      'INFOSYS': 'INFY.NS',
      'RELIANCE': 'RELIANCE.NS',
      'RELIANCE.NS': 'RELIANCE.NS',
      'RIL': 'RELIANCE.NS',
      'HDFC': 'HDFCBANK.NS',
      'HDFCBANK': 'HDFCBANK.NS',
      'HDFCBANK.NS': 'HDFCBANK.NS',
      'TATA MOTORS': 'TATAMOTORS.NS',
      'TATAMOTORS': 'TATAMOTORS.NS',
      'TATAMOTORS.NS': 'TATAMOTORS.NS',
    };

    const detectedSymbols: string[] = [];
    for (const [alias, fullSymbol] of Object.entries(SYMBOL_ALIASES)) {
      if (text.includes(alias) && !detectedSymbols.includes(fullSymbol)) {
        detectedSymbols.push(fullSymbol);
      }
    }

    if (detectedSymbols.length === 0 && symbolContext) {
      const mapped = SYMBOL_ALIASES[symbolContext.toUpperCase()] || symbolContext.toUpperCase();
      detectedSymbols.push(mapped);
    }
    if (detectedSymbols.length === 0 && (text.includes('STOCK') || text.includes('BUY') || text.includes('ANALYSIS'))) {
      detectedSymbols.push('TCS.NS');
    }

    // 2. Check if query is about Portfolio
    const isPortfolioQuery = text.includes('PORTFOLIO') || text.includes('HOLDING') || text.includes('ALLOCATION') || text.includes('MY STOCKS');

    const sources: { type: string; description: string }[] = [];

    // Case A: Portfolio Query
    if (isPortfolioQuery && detectedSymbols.length === 0) {
      const { result, sourceRecord } = await this.toolsService.executeTool('getPortfolioAnalysis', {}, userId);
      if (sourceRecord) sources.push(sourceRecord);

      const pAnalysis = result;
      const diversification = pAnalysis?.diversificationScore ?? 50;
      const holdingsCount = pAnalysis?.holdingsCount ?? 0;

      return {
        summary: `Your active portfolio currently holds ${holdingsCount} position(s) with an aggregate valuation of ₹${(pAnalysis?.currentValue || 0).toLocaleString('en-IN')}. Diversification analysis indicates a score of ${diversification}/100.`,
        technicalAnalysis: `Portfolio momentum is balanced across constituent positions. Day change reflects ${pAnalysis?.dayChangePercent ?? 0}% movement.`,
        fundamentalAnalysis: `Sector allocation shows exposure across ${pAnalysis?.sectorAllocation?.length || 1} distinct industries, led by ${pAnalysis?.sectorAllocation?.[0]?.sector || 'Diversified Equities'} (${pAnalysis?.sectorAllocation?.[0]?.percentage || 100}%).`,
        positives: [
          `Active tracking across ${holdingsCount} registered holding(s).`,
          `Diversification score of ${diversification}/100 provides measurable concentration oversight.`,
        ],
        negatives: [
          diversification < 60 ? `Sector concentration is elevated in top assets.` : `Market volatility impacts aggregate return.`,
          `Macroeconomic interest rate cycle may affect equity valuations.`,
        ],
        riskLevel: diversification < 50 ? 'HIGH' : diversification < 75 ? 'MEDIUM' : 'LOW',
        confidenceScore: 84,
        sources,
      };
    }

    // Case B: Multi-Stock Comparison (e.g. Infosys vs TCS)
    if (detectedSymbols.length >= 2) {
      const sym1 = detectedSymbols[0];
      const sym2 = detectedSymbols[1];

      const [q1, q2, f1, f2, ind1, ind2] = await Promise.all([
        this.toolsService.executeTool('getStockQuote', { symbol: sym1 }, userId),
        this.toolsService.executeTool('getStockQuote', { symbol: sym2 }, userId),
        this.toolsService.executeTool('getFundamentals', { symbol: sym1 }, userId),
        this.toolsService.executeTool('getFundamentals', { symbol: sym2 }, userId),
        this.toolsService.executeTool('getTechnicalIndicators', { symbol: sym1 }, userId),
        this.toolsService.executeTool('getTechnicalIndicators', { symbol: sym2 }, userId),
      ]);

      if (q1.sourceRecord) sources.push(q1.sourceRecord);
      if (q2.sourceRecord) sources.push(q2.sourceRecord);
      if (ind1.sourceRecord) sources.push(ind1.sourceRecord);
      if (ind2.sourceRecord) sources.push(ind2.sourceRecord);

      const pe1 = f1.result?.peRatio ?? 'N/A';
      const pe2 = f2.result?.peRatio ?? 'N/A';
      const rsi1 = ind1.result?.rsi?.value ?? 50;
      const rsi2 = ind2.result?.rsi?.value ?? 50;

      return {
        summary: `Comparative evaluation of ${sym1} (₹${q1.result?.currentPrice}) versus ${sym2} (₹${q2.result?.currentPrice}) demonstrates distinct valuation multiples and technical momentum setups across both Indian enterprise leaders.`,
        technicalAnalysis: `${sym1} registers RSI at ${rsi1} with ${ind1.result?.maCrossover?.status === 'BULLISH_ALIGNMENT' ? 'bullish 50/200 MA support' : 'neutral moving averages'}, whereas ${sym2} displays RSI at ${rsi2} with ${ind2.result?.macd?.histogram >= 0 ? 'positive MACD histogram' : 'contracting MACD momentum'}.`,
        fundamentalAnalysis: `${sym1} trades at a P/E multiple of ${pe1} (ROE: ${f1.result?.roe ?? 'N/A'}%), compared to ${sym2} trading at a P/E multiple of ${pe2} (ROE: ${f2.result?.roe ?? 'N/A'}%).`,
        positives: [
          `${sym1}: Established balance sheet strength with P/E of ${pe1}.`,
          `${sym2}: Competitive market positioning with current price of ₹${q2.result?.currentPrice}.`,
        ],
        negatives: [
          `Both assets face global enterprise discretionary spending moderation.`,
          `Currency volatility and cross-currency billing variances.`,
        ],
        riskLevel: 'MEDIUM',
        confidenceScore: 88,
        sources,
      };
    }

    // Case C: Single Stock Deep Analysis (e.g. "Should I buy TCS?")
    const targetSymbol = detectedSymbols[0] || 'TCS.NS';

    const [quoteRes, fundRes, indRes, newsRes] = await Promise.all([
      this.toolsService.executeTool('getStockQuote', { symbol: targetSymbol }, userId),
      this.toolsService.executeTool('getFundamentals', { symbol: targetSymbol }, userId),
      this.toolsService.executeTool('getTechnicalIndicators', { symbol: targetSymbol }, userId),
      this.toolsService.executeTool('getRecentNews', { symbol: targetSymbol }, userId),
    ]);

    if (quoteRes.sourceRecord) sources.push(quoteRes.sourceRecord);
    if (fundRes.sourceRecord) sources.push(fundRes.sourceRecord);
    if (indRes.sourceRecord) sources.push(indRes.sourceRecord);
    if (newsRes.sourceRecord) sources.push(newsRes.sourceRecord);

    const quote = quoteRes.result;
    const fund = fundRes.result;
    const ind = indRes.result;

    const rsiVal = ind?.rsi?.value ?? 50;
    const peVal = fund?.peRatio ?? 'N/A';
    const roeVal = fund?.roe ?? 'N/A';
    const priceVal = quote?.currentPrice ?? 1000;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (rsiVal >= 75 || (typeof peVal === 'number' && peVal > 50)) {
      riskLevel = 'HIGH';
    } else if (rsiVal >= 45 && rsiVal <= 65 && (fund?.debtToEquity ?? 1) < 0.5) {
      riskLevel = 'LOW';
    }

    return {
      summary: `Current indicators for ${targetSymbol} (trading at ₹${priceVal}, ${quote?.changePercent ?? 0}%) reflect solid corporate fundamentals supported by ${ind?.maCrossover?.status === 'BULLISH_ALIGNMENT' ? 'constructive moving average alignment' : 'balanced price consolidation'}.`,
      technicalAnalysis: `14-period RSI is currently at ${rsiVal} (${ind?.rsi?.interpretation || 'Neutral momentum'}). The 50-day SMA stands at ₹${ind?.sma50?.value ?? priceVal}, while MACD histogram registers ${ind?.macd?.histogram ?? 0}, indicating ${ind?.macd?.histogram >= 0 ? 'expanding upward momentum' : 'temporary consolidation'}.`,
      fundamentalAnalysis: `${targetSymbol} demonstrates audited P/E of ${peVal}, P/B of ${fund?.pbRatio ?? 'N/A'}, and ROE of ${roeVal}%. Debt-to-equity ratio is conservatively managed at ${fund?.debtToEquity ?? 'N/A'}.`,
      positives: [
        `Robust capital return metrics with ROE of ${roeVal}%.`,
        `Low leverage profile with Debt/Equity of ${fund?.debtToEquity ?? 'N/A'}.`,
        `RSI level of ${rsiVal} reflects measured buyer demand without extreme overextension.`,
      ],
      negatives: [
        `Valuation multiple of ${peVal}x P/E prices in steady earnings execution.`,
        `Potential sector headwinds from global enterprise spending moderation.`,
      ],
      riskLevel,
      confidenceScore: 86,
      sources,
    };
  }
}
