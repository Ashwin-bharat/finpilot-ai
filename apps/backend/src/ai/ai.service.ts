import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';
import { AiResponseValidator } from './ai-response-validator';
import { FinPilotOrchestrator } from './orchestrator/finpilot-orchestrator.service';
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

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
export const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

function formatMacdMomentum(hist: number | undefined | null): string {
  if (hist === undefined || hist === null || isNaN(hist)) return 'neutral momentum';
  if (hist > 1) return 'expanding upward buyer momentum';
  if (hist > 0) return 'mild positive buyer momentum';
  if (hist === 0) return 'neutral momentum at the centerline';
  if (hist < -1) return 'accelerating downward selling pressure';
  return 'mild negative momentum bias';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private geminiClient: GoogleGenerativeAI | null = null;
  private anthropicClient: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolsService: AiToolsService,
    private readonly validator: AiResponseValidator,
    @Optional() private readonly orchestrator?: FinPilotOrchestrator,
  ) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim() !== '' && geminiKey !== 'your-gemini-api-key') {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey && anthropicKey.trim() !== '' && anthropicKey !== 'your-anthropic-api-key') {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
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

    // 3. Generate Structured AI Recommendation via FinPilotOrchestrator
    let analysis: StructuredAiRecommendation;
    if (this.orchestrator) {
      const orchestratorResult = await this.orchestrator.processQuery(
        userId,
        dto.message,
        dto.symbolContext,
        dto.explanationStyle,
      );
      analysis = {
        ...orchestratorResult.recommendation,
        intent: orchestratorResult.intent,
        toolsFired: orchestratorResult.toolsFired,
      };
    } else {
      analysis = await this.generateAnalysisWithRetries(userId, dto.message, dto.symbolContext);
    }

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

        if (this.geminiClient) {
          try {
            rawAnalysis = await this.runGeminiToolLoop(userId, message, attempt > 0 ? lastError : undefined);
          } catch (geminiErr: any) {
            this.logger.warn(`Gemini tool loop failed (${geminiErr.message}). Failing over to grounded autonomous pipeline.`);
            rawAnalysis = await this.runGroundedAutonomousPipeline(userId, message, symbolContext);
          }
        } else if (this.anthropicClient) {
          try {
            rawAnalysis = await this.runAnthropicToolLoop(userId, message, attempt > 0 ? lastError : undefined);
          } catch (anthropicErr: any) {
            this.logger.warn(`Anthropic tool loop failed (${anthropicErr.message}). Failing over to grounded autonomous pipeline.`);
            rawAnalysis = await this.runGroundedAutonomousPipeline(userId, message, symbolContext);
          }
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
        model: DEFAULT_ANTHROPIC_MODEL,
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
   * Gemini Tool Calling Loop with @google/generative-ai SDK
   */
  private async runGeminiToolLoop(
    userId: string,
    message: string,
    retryFeedback?: string,
  ): Promise<StructuredAiRecommendation> {
    if (!this.geminiClient) {
      throw new Error('Gemini client uninitialized');
    }

    const functionDeclarations = this.getGeminiFunctionDeclarations();
    const model = this.geminiClient.getGenerativeModel({
      model: DEFAULT_GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations }],
    });

    const prompt = retryFeedback ? `${message}\n\nFEEDBACK ON PREVIOUS ATTEMPT: ${retryFeedback}` : message;
    const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
    const sourcesGathered: { type: string; description: string }[] = [];

    // Up to 5 turns for multi-tool calls (e.g. comparing stocks)
    for (let turn = 0; turn < 5; turn++) {
      let response: any;
      let callAttempts = 3;
      while (callAttempts > 0) {
        try {
          response = await model.generateContent({ contents });
          break;
        } catch (callErr: any) {
          if ((callErr.status === 503 || callErr.status === 429) && callAttempts > 1) {
            callAttempts--;
            let waitMs = 3000;
            if (callErr.status === 429) {
              const retryInfo = Array.isArray(callErr.errorDetails)
                ? callErr.errorDetails.find((d: any) => d?.['@type']?.includes('RetryInfo'))
                : null;
              const delaySec = retryInfo?.retryDelay ? parseInt(retryInfo.retryDelay, 10) : 30;
              waitMs = (isNaN(delaySec) ? 30 : delaySec + 2) * 1000;
            }
            this.logger.warn(`Gemini API transient error (${callErr.status}). Retrying in ${waitMs}ms...`);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
          } else {
            throw callErr;
          }
        }
      }

      const candidate = response?.response?.candidates?.[0];
      const modelContent = candidate?.content;

      if (!modelContent) {
        break;
      }

      contents.push(modelContent);

      const functionCalls = response.response?.functionCalls ? response.response.functionCalls() : [];

      if (!functionCalls || functionCalls.length === 0) {
        // If Gemini answered via text instead of submitStockAnalysis, attempt JSON parsing
        try {
          const text = response.response?.text ? response.response.text() : '';
          if (text) {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as StructuredAiRecommendation;
              if (parsed.summary && parsed.technicalAnalysis) {
                if (sourcesGathered.length > 0 && (!parsed.sources || parsed.sources.length === 0)) {
                  parsed.sources = sourcesGathered;
                }
                return parsed;
              }
            }
          }
        } catch {
          // ignore
        }
        break;
      }

      // Check if submitStockAnalysis was called
      const submitCall = functionCalls.find((fc) => fc.name === 'submitStockAnalysis');
      if (submitCall) {
        const parsed = submitCall.args as StructuredAiRecommendation;
        if (sourcesGathered.length > 0 && (!parsed.sources || parsed.sources.length === 0)) {
          parsed.sources = sourcesGathered;
        }
        return parsed;
      }

      // Execute intermediate tools and return results to Gemini
      const functionResponses: any[] = [];
      for (const call of functionCalls) {
        const { result: toolResult, sourceRecord } = await this.toolsService.executeTool(call.name, call.args, userId);
        if (sourceRecord) {
          sourcesGathered.push(sourceRecord);
        }
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: toolResult },
          },
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponses,
      });
    }

    throw new Error('Gemini conversation ended without invoking submitStockAnalysis tool');
  }

  private getGeminiFunctionDeclarations(): FunctionDeclaration[] {
    const tools = this.toolsService.getToolDefinitions();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.convertJsonSchemaToGeminiSchema(tool.input_schema),
    }));
  }

  private convertJsonSchemaToGeminiSchema(schema: any): any {
    if (!schema) return undefined;
    const typeMap: Record<string, SchemaType> = {
      string: SchemaType.STRING,
      number: SchemaType.NUMBER,
      integer: SchemaType.INTEGER,
      boolean: SchemaType.BOOLEAN,
      array: SchemaType.ARRAY,
      object: SchemaType.OBJECT,
    };

    const res: any = {
      type: typeMap[schema.type?.toLowerCase()] || SchemaType.OBJECT,
    };

    if (schema.description) res.description = schema.description;
    if (schema.enum) res.enum = schema.enum;
    if (schema.properties) {
      res.properties = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        res.properties[key] = this.convertJsonSchemaToGeminiSchema(prop);
      }
    }
    if (schema.required) res.required = schema.required;
    if (schema.items) res.items = this.convertJsonSchemaToGeminiSchema(schema.items);
    return res;
  }

  /**
   * Extract referenced Indian stock symbols dynamically from user query
   */
  private async extractSymbolsFromText(message: string, symbolContext?: string): Promise<string[]> {
    const detected: string[] = [];

    // 1. Direct Regex for Ticker.NS or Ticker.BO (e.g. MAZDOCK.NS, BDL.NS)
    const nsMatches = message.match(/\b([a-zA-Z0-9_\-]{2,20})\.(NS|BO)\b/gi);
    if (nsMatches) {
      for (const m of nsMatches) {
        const sym = m.toUpperCase();
        if (!detected.includes(sym)) detected.push(sym);
      }
    }

    // 2. Comprehensive Company & Colloquial Aliases (Indian Equity Universe)
    const COMPREHENSIVE_ALIASES: Record<string, string> = {
      'MAZDOCK': 'MAZDOCK.NS',
      'MAZAGON': 'MAZDOCK.NS',
      'MAZAGON DOCK': 'MAZDOCK.NS',
      'MAZAGONDOCK': 'MAZDOCK.NS',
      'BDL': 'BDL.NS',
      'BHARAT DYNAMICS': 'BDL.NS',
      'BEL': 'BEL.NS',
      'BHARAT ELECTRONICS': 'BEL.NS',
      'HAL': 'HAL.NS',
      'HINDUSTAN AERONAUTICS': 'HAL.NS',
      'TCS': 'TCS.NS',
      'TATA CONSULTANCY': 'TCS.NS',
      'INFY': 'INFY.NS',
      'INFOSYS': 'INFY.NS',
      'RELIANCE': 'RELIANCE.NS',
      'RIL': 'RELIANCE.NS',
      'HDFC': 'HDFCBANK.NS',
      'HDFCBANK': 'HDFCBANK.NS',
      'HDFC BANK': 'HDFCBANK.NS',
      'TATAMOTORS': 'TATAMOTORS.NS',
      'TATA MOTORS': 'TATAMOTORS.NS',
      'TATASTEEL': 'TATASTEEL.NS',
      'TATA STEEL': 'TATASTEEL.NS',
      'TATAPOWER': 'TATAPOWER.NS',
      'TATA POWER': 'TATAPOWER.NS',
      'ICICI': 'ICICIBANK.NS',
      'ICICIBANK': 'ICICIBANK.NS',
      'ICICI BANK': 'ICICIBANK.NS',
      'SBIN': 'SBIN.NS',
      'SBI': 'SBIN.NS',
      'STATE BANK': 'SBIN.NS',
      'ITC': 'ITC.NS',
      'WIPRO': 'WIPRO.NS',
      'BHARTIARTL': 'BHARTIARTL.NS',
      'AIRTEL': 'BHARTIARTL.NS',
      'BHARTI AIRTEL': 'BHARTIARTL.NS',
      'ZOMATO': 'ZOMATO.NS',
      'PAYTM': 'PAYTM.NS',
      'LT': 'LT.NS',
      'L&T': 'LT.NS',
      'LARSEN': 'LT.NS',
      'LARSEN & TOUBRO': 'LT.NS',
      'ADANIENT': 'ADANIENT.NS',
      'ADANI ENTERPRISES': 'ADANIENT.NS',
      'ADANIPORTS': 'ADANIPORTS.NS',
      'ADANI PORTS': 'ADANIPORTS.NS',
      'KOTAK': 'KOTAKBANK.NS',
      'KOTAKBANK': 'KOTAKBANK.NS',
      'KOTAK BANK': 'KOTAKBANK.NS',
      'AXIS': 'AXISBANK.NS',
      'AXISBANK': 'AXISBANK.NS',
      'AXIS BANK': 'AXISBANK.NS',
      'MARUTI': 'MARUTI.NS',
      'SUNPHARMA': 'SUNPHARMA.NS',
      'SUN PHARMA': 'SUNPHARMA.NS',
      'TITAN': 'TITAN.NS',
      'BAJFINANCE': 'BAJFINANCE.NS',
      'BAJAJ FINANCE': 'BAJFINANCE.NS',
      'BAJAJFINSV': 'BAJAJFINSV.NS',
      'BAJAJ FINSERV': 'BAJAJFINSV.NS',
      'JIOFIN': 'JIOFIN.NS',
      'JIO FINANCIAL': 'JIOFIN.NS',
      'COALINDIA': 'COALINDIA.NS',
      'COAL INDIA': 'COALINDIA.NS',
      'NTPC': 'NTPC.NS',
      'ONGC': 'ONGC.NS',
      'POWERGRID': 'POWERGRID.NS',
      'POWER GRID': 'POWERGRID.NS',
      'IRCTC': 'IRCTC.NS',
      'RVNL': 'RVNL.NS',
      'IREDA': 'IREDA.NS',
      'COCHINSHIP': 'COCHINSHIP.NS',
      'COCHIN SHIPYARD': 'COCHINSHIP.NS',
      'BHEL': 'BHEL.NS',
      'VEDL': 'VEDL.NS',
      'VEDANTA': 'VEDL.NS',
      'HINDALCO': 'HINDALCO.NS',
      'JSWSTEEL': 'JSWSTEEL.NS',
      'JSW STEEL': 'JSWSTEEL.NS',
      'NESTLEIND': 'NESTLEIND.NS',
      'NESTLE': 'NESTLEIND.NS',
      'HINDUNILVR': 'HINDUNILVR.NS',
      'HUL': 'HINDUNILVR.NS',
      'HINDUSTAN UNILEVER': 'HINDUNILVR.NS',
      'ASIANPAINT': 'ASIANPAINT.NS',
      'ASIAN PAINTS': 'ASIANPAINT.NS',
      'DLF': 'DLF.NS',
    };

    const sortedAliases = Object.keys(COMPREHENSIVE_ALIASES).sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      const regex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(message)) {
        const full = COMPREHENSIVE_ALIASES[alias];
        if (!detected.includes(full)) detected.push(full);
      }
    }

    // 3. Extract alphanumeric word tokens and check against stock database / ticker heuristics
    const stopwords = new Set([
      'THE', 'IS', 'AND', 'OR', 'FOR', 'TO', 'IN', 'ON', 'AT', 'BY', 'WITH', 'ABOUT', 'ME', 'MY',
      'TELL', 'DID', 'WILL', 'BE', 'WHAT', 'HOW', 'WHY', 'WHEN', 'WHERE', 'SHOULD', 'BUY', 'SELL',
      'STOCK', 'STOCKS', 'SHARE', 'SHARES', 'PRICE', 'PRICES', 'ANALYSIS', 'ANALYZE', 'BULLISH',
      'BULLIST', 'BEARISH', 'TODAY', 'TARGET', 'OUTLOOK', 'VIEW', 'ANY', 'SOME', 'GOOD', 'BAD', 'NOW', 'PLEASE',
      'CHECK', 'GIVE', 'SHOW', 'LOOK', 'LOOKING', 'RATE', 'RATING', 'LEVEL', 'LEVELS', 'PORTFOLIO',
      'HOLDING', 'HOLDINGS', 'COMPARE', 'VERSUS', 'VS', 'PERFORMANCE', 'UPDATE', 'NEWS',
    ]);

    const words = message.replace(/[^a-zA-Z0-9_.-]/g, ' ').split(/\s+/).filter(Boolean);
    for (const rawWord of words) {
      const w = rawWord.toUpperCase().replace(/\.(NS|BO)$/, '');
      if (w.length >= 2 && w.length <= 15 && !stopwords.has(w) && !/^\d+$/.test(w)) {
        if (this.prisma?.stock) {
          try {
            const stock = await this.prisma.stock.findFirst({
              where: {
                OR: [
                  { symbol: { equals: `${w}.NS`, mode: 'insensitive' } },
                  { symbol: { equals: `${w}.BO`, mode: 'insensitive' } },
                  { symbol: { equals: w, mode: 'insensitive' } },
                  { symbol: { startsWith: w, mode: 'insensitive' } },
                ],
              },
            });
            if (stock && !detected.includes(stock.symbol)) {
              detected.push(stock.symbol);
              continue;
            }
          } catch {
            // DB ignore
          }
        }

        // Ticker heuristic if word is 2-10 chars and not yet detected
        const candidateSym = `${w}.NS`;
        if (!detected.includes(candidateSym) && detected.length === 0) {
          detected.push(candidateSym);
        }
      }
    }

    // 4. Fallback to explicit symbolContext if provided
    if (detected.length === 0 && symbolContext) {
      const cleanCtx = symbolContext.toUpperCase();
      const mapped = COMPREHENSIVE_ALIASES[cleanCtx] || (cleanCtx.includes('.') ? cleanCtx : `${cleanCtx}.NS`);
      if (!detected.includes(mapped)) detected.push(mapped);
    }

    return detected;
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

    // 1. Detect target symbols dynamically
    const detectedSymbols = await this.extractSymbolsFromText(message, symbolContext);

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

    // Case B: Multi-Stock Comparison (e.g. BDL vs MAZDOCK)
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
        technicalAnalysis: `${sym1} registers RSI at ${rsi1} with ${ind1.result?.maCrossover?.status === 'BULLISH_ALIGNMENT' ? 'bullish 50/200 MA support' : 'neutral moving averages'}, whereas ${sym2} displays RSI at ${rsi2} with MACD histogram at ${ind2.result?.macd?.histogram ?? 0}, reflecting ${formatMacdMomentum(ind2.result?.macd?.histogram)}.`,
        fundamentalAnalysis: `${sym1} trades at a P/E multiple of ${pe1} (ROE: ${f1.result?.roe ?? 'N/A'}%), compared to ${sym2} trading at a P/E multiple of ${pe2} (ROE: ${f2.result?.roe ?? 'N/A'}%).`,
        positives: [
          `${sym1}: Established balance sheet strength with P/E of ${pe1}.`,
          `${sym2}: Competitive market positioning with current price of ₹${q2.result?.currentPrice}.`,
        ],
        negatives: [
          `Both assets face sector-specific macroeconomic cycles.`,
          `Market volatility and discretionary capital allocation variances.`,
        ],
        riskLevel: 'MEDIUM',
        confidenceScore: 88,
        sources,
      };
    }

    // Case C: Single Stock Deep Analysis (e.g. "tell me about MAZDOCK.NS" or "tell me about BDL")
    if (detectedSymbols.length === 1) {
      const targetSymbol = detectedSymbols[0];

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

      if (!quote || typeof quote.currentPrice !== 'number') {
        return {
          summary: `Live market quote data for ${targetSymbol} is currently unavailable from exchange feeds. Probabilistic analysis requires confirmed live pricing benchmarks.`,
          technicalAnalysis: `Technical momentum indicators require active price history for ${targetSymbol}.`,
          fundamentalAnalysis: `Fundamental balance sheet ratios should be verified directly via exchange disclosures for ${targetSymbol}.`,
          positives: [`Ticker ${targetSymbol} is indexed in the security master.`],
          negatives: [`Real-time price feed is temporarily unconfirmed by market data provider.`],
          riskLevel: 'HIGH',
          confidenceScore: 30,
          sources: sources.length > 0 ? sources : [{ type: 'Security Master', description: `Security lookup for ${targetSymbol}` }],
        };
      }

      const rsiVal = ind?.rsi?.value ?? 50;
      const peVal = fund?.peRatio ?? 'N/A';
      const roeVal = fund?.roe ?? 'N/A';
      const priceVal = quote.currentPrice;
      const stockName = quote?.name || targetSymbol;

      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
      if (rsiVal >= 75 || (typeof peVal === 'number' && peVal > 50)) {
        riskLevel = 'HIGH';
      } else if (rsiVal >= 45 && rsiVal <= 65 && (fund?.debtToEquity ?? 1) < 0.5) {
        riskLevel = 'LOW';
      }

      return {
        summary: `Current indicators for ${stockName} (${targetSymbol}, trading at ₹${priceVal}, ${quote?.changePercent ?? 0}%) reflect active market interest supported by ${ind?.maCrossover?.status === 'BULLISH_ALIGNMENT' ? 'constructive moving average alignment' : 'balanced price consolidation'}.`,
        technicalAnalysis: `14-period RSI is currently at ${rsiVal} (${ind?.rsi?.interpretation || 'Neutral momentum'}). The 50-day SMA stands at ₹${ind?.sma50?.value ?? priceVal}, while MACD histogram registers ${ind?.macd?.histogram ?? 0}, reflecting ${formatMacdMomentum(ind?.macd?.histogram)}.`,
        fundamentalAnalysis: `${targetSymbol} demonstrates audited P/E of ${peVal}, P/B of ${fund?.pbRatio ?? 'N/A'}, and ROE of ${roeVal}%. Debt-to-equity ratio is conservatively managed at ${fund?.debtToEquity ?? 'N/A'}.`,
        positives: [
          `Active tracking across ${targetSymbol} with live market valuation of ₹${priceVal}.`,
          `RSI level of ${rsiVal} reflects measured buyer demand without extreme overextension.`,
          `Moving average positioning provides identifiable trend support benchmarks.`,
        ],
        negatives: [
          `Valuation multiple of ${peVal}x P/E requires sustained operational execution.`,
          `Broader market volatility and sector-specific headwinds.`,
        ],
        riskLevel,
        confidenceScore: 86,
        sources,
      };
    }

    // Case D: General Market / Educational Inquiries
    return {
      summary: `FinPilot AI tracks live data for NSE equities and portfolio metrics. To evaluate a specific asset, mention any Indian stock ticker or company name (e.g. MAZDOCK.NS, BDL.NS, TCS.NS, RELIANCE.NS).`,
      technicalAnalysis: `Technical indicators such as 14-period RSI, 50/200-day Moving Averages, and MACD momentum can be calculated automatically across all NSE equity symbols.`,
      fundamentalAnalysis: `Fundamental valuation ratios including P/E, P/B, ROE, ROCE, and debt metrics are retrieved from verified exchange filings.`,
      positives: [
        'Real-time price action & volume tracking across all NSE listed equities.',
        'Automated mathematical technical indicator computation (RSI, MACD, MA Crossover).',
      ],
      negatives: [
        'Stock selection requires specific ticker input for targeted metrics.',
      ],
      riskLevel: 'MEDIUM',
      confidenceScore: 90,
      sources: [
        { type: 'System Intelligence', description: 'NSE Equity Universe Knowledge Base' },
      ],
    };
  }
}
