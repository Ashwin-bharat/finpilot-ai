'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Database,
  Layers,
  Plus,
  MessageSquare,
  TrendingUp,
  Shield,
  Check,
  Activity,
  Compass,
  BarChart3,
} from 'lucide-react';
import {
  AiChatSession,
  AiChatMessage,
  StructuredAiRecommendation,
  QueryIntent,
} from '@finpilot/shared-types';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { sendChatMessageApi, getChatSessionsApi, getChatSessionByIdApi } from '../../lib/ai';
import { updateExplanationStyleApi } from '../../lib/auth';

// ---------------------------------------------------------------------------
// Intent Classification & Dynamic Stage Definitions (Matches Backend Pipeline)
// ---------------------------------------------------------------------------

function classifyQueryIntent(message: string, symbolContext?: string): QueryIntent {
  const upper = message.toUpperCase().trim();
  const tickerMatches = upper.match(/\b([A-Z0-9_\-]{2,15})\.(NS|BO)\b/g);

  // 1. Portfolio Analysis
  const portfolioKeywords = [
    'MY PORTFOLIO',
    'PORTFOLIO',
    'MY HOLDINGS',
    'HOLDINGS',
    'MY STOCKS',
    'DIVERSIFICATION',
    'ASSET ALLOCATION',
    'MY ALLOCATION',
    'MY INVESTMENTS',
  ];
  if (portfolioKeywords.some((k) => upper.includes(k))) {
    return 'PORTFOLIO_ANALYSIS';
  }

  // 2. Stock Comparison
  const comparisonKeywords = [' VS ', ' VERSUS ', 'WHICH IS BETTER', 'BETTER THAN'];
  const hasComparisonTerm =
    comparisonKeywords.some((k) => upper.includes(k)) ||
    upper.startsWith('COMPARE') ||
    upper.includes('COMPARE ');
  if (hasComparisonTerm || (tickerMatches && tickerMatches.length >= 2)) {
    return 'STOCK_COMPARISON';
  }

  // 3. Market Analysis
  const marketKeywords = [
    'NIFTY',
    'SENSEX',
    'TOP GAINER',
    'TOP GAINERS',
    'TOP LOSER',
    'TOP LOSERS',
    'TOP MOVER',
    'TOP MOVERS',
    'GAINERS',
    'LOSERS',
    'MARKET TODAY',
    'MARKET CRASH',
    'MARKET SENTIMENT',
    'INDIAN MARKET',
    'INDICES',
    'SECTOR PERFORMANCE',
  ];
  if (
    marketKeywords.some((k) => upper.includes(k)) ||
    (upper.includes('MARKET') &&
      (upper.includes('TODAY') ||
        upper.includes('DOING') ||
        upper.includes('OUTLOOK') ||
        upper.includes('HOW IS')))
  ) {
    return 'MARKET_ANALYSIS';
  }

  // 4. General Financial Question
  const generalStarters = [
    'WHAT IS ',
    'WHAT ARE ',
    'HOW DOES ',
    'EXPLAIN ',
    'TELL ME ABOUT WHAT ',
    'DIFFERENCE BETWEEN ',
    'HOW TO INVEST',
    'DEFINE ',
  ];
  const hasStockTarget =
    tickerMatches?.length ||
    upper.includes(' OF ') ||
    upper.includes(' FOR ') ||
    upper.includes(' IN ') ||
    symbolContext;
  const isEducational = generalStarters.some((prefix) => upper.startsWith(prefix)) && !hasStockTarget;
  if (isEducational) {
    return 'GENERAL_FINANCIAL_QUESTION';
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
    return 'STOCK_ANALYSIS';
  }

  if (hasTechnicalKeywords) {
    return 'TECHNICAL_ANALYSIS';
  }

  if (hasFundamentalKeywords) {
    return 'FUNDAMENTAL_ANALYSIS';
  }

  // 7. News Analysis
  const newsKeywords = [
    'NEWS',
    'HEADLINE',
    'HEADLINES',
    'ANNOUNCEMENT',
    'LATEST UPDATE',
    'MEDIA',
    'SENTIMENT',
  ];
  if (newsKeywords.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(upper))) {
    return 'NEWS_ANALYSIS';
  }

  // 8. Stock Analysis (Default for company inquiries or when symbolContext is supplied)
  return 'STOCK_ANALYSIS';
}

interface AnalysisStage {
  id: string;
  title: string;
  detail: string;
}

const INTENT_STAGES: Record<QueryIntent, AnalysisStage[]> = {
  TECHNICAL_ANALYSIS: [
    { id: 't1', title: 'Resolving Security Master', detail: 'Verifying active exchange listing & ticker metadata' },
    { id: 't2', title: 'Fetching Price History', detail: 'Retrieving 1-year OHLCV candle history from exchange' },
    { id: 't3', title: 'Calculating Momentum Indicators', detail: 'Computing 14-day RSI, 50/200 SMA alignment & MACD' },
    { id: 't4', title: 'Evaluating Volatility Bands', detail: 'Measuring Bollinger Bands (%B), 14-day ATR & Floor Pivots' },
    { id: 't5', title: 'Mapping Market Structure', detail: 'Locating unmitigated Order Blocks, Fair Value Gaps & Dealing Range' },
    { id: 't6', title: 'Synthesizing Flowing Outlook', detail: 'Formulating probabilistic technical outlook & trade parameters' },
  ],
  FUNDAMENTAL_ANALYSIS: [
    { id: 'f1', title: 'Resolving Security Master', detail: 'Verifying active exchange listing & corporate registry' },
    { id: 'f2', title: 'Retrieving Audited Statements', detail: 'Loading latest balance sheet filings & cash flow disclosures' },
    { id: 'f3', title: 'Modeling Intrinsic DCF Value', detail: 'Computing 2-stage Discounted Cash Flow model & Margin of Safety' },
    { id: 'f4', title: 'Defensive Value Screening', detail: 'Calculating Benjamin Graham Number & asset-backed valuation' },
    { id: 'f5', title: 'Piotroski Financial Health', detail: 'Evaluating 9-point balance sheet integrity (solvency, profitability)' },
    { id: 'f6', title: 'Sector Baseline Benchmarking', detail: 'Benchmarking P/E, P/B, and capital returns (ROCE, ROE) vs industry' },
    { id: 'f7', title: 'Synthesizing Flowing Valuation', detail: 'Formulating audited fundamental assessment & business quality' },
  ],
  STOCK_ANALYSIS: [
    { id: 's1', title: 'Resolving Security Master', detail: 'Verifying active NSE/BSE listing & security identifiers' },
    { id: 's2', title: 'Unified Data Ingestion', detail: 'Retrieving consistent 1-year OHLCV candle snapshot & audited filings' },
    { id: 's3', title: 'Technical & Market Structure', detail: 'Calculating RSI, MACD, ATR, Institutional Order Blocks & VWAP' },
    { id: 's4', title: 'Fundamental Valuation Audit', detail: 'Modeling 2-stage DCF intrinsic value, Graham number & Piotroski score' },
    { id: 's5', title: 'Quantitative Risk Profiling', detail: 'Computing 60-day volatility, NIFTY 50 beta & historical max drawdown' },
    { id: 's6', title: 'Financial Media Intelligence', detail: 'Scanning market news flow & applying 3-day half-life decay weighting' },
    { id: 's7', title: 'Autonomous Cross-Engine Synthesis', detail: 'Harmonizing technical-fundamental signals & calculating conflict score' },
    { id: 's8', title: 'Formulating Tactical Playbook', detail: 'Synthesizing support/resistance zones, stop buffer & flowing narrative' },
  ],
  NEWS_ANALYSIS: [
    { id: 'n1', title: 'Resolving Security', detail: 'Identifying target company in official securities registry' },
    { id: 'n2', title: 'Ingesting Financial News Feeds', detail: 'Querying live financial media wires & exchange corporate filings' },
    { id: 'n3', title: 'Deduplicating & Recency Decay', detail: 'Merging duplicate coverage and applying 3-day half-life weighting' },
    { id: 'n4', title: 'Analyzing Sentiment Distribution', detail: 'Evaluating tone balance (positive, neutral, negative) across coverage' },
    { id: 'n5', title: 'Synthesizing Flowing Intelligence', detail: 'Synthesizing flowing market media sentiment & regulatory headlines' },
  ],
  PORTFOLIO_ANALYSIS: [
    { id: 'p1', title: 'Ledger Authentication', detail: 'Authenticating secure user session & loading active holding positions' },
    { id: 'p2', title: 'Valuation & P&L Attribution', detail: 'Computing aggregate portfolio value, net unrealized returns & top drivers' },
    { id: 'p3', title: 'Herfindahl Diversification Audit', detail: 'Auditing sector allocation & flagging positions exceeding 25% ceiling' },
    { id: 'p4', title: 'Pairwise Correlation Matrix', detail: 'Calculating 30-day constituent return co-movement & diversification safety' },
    { id: 'p5', title: 'Synthesizing Flowing Diagnostic', detail: 'Synthesizing flowing portfolio health, return drivers & risk mitigation' },
  ],
  STOCK_COMPARISON: [
    { id: 'c1', title: 'Dual Security Resolution', detail: 'Resolving both target tickers from Security Master' },
    { id: 'c2', title: 'Comparative Price Ingestion', detail: 'Retrieving synchronized OHLCV price histories & live market quotes' },
    { id: 'c3', title: 'Momentum Alignment Comparison', detail: 'Contrasting 14-period RSI and moving average convergence across peers' },
    { id: 'c4', title: 'Comparative Valuation Multiples', detail: 'Benchmarking P/E, P/B, ROE & capital efficiency between companies' },
    { id: 'c5', title: 'Synthesizing Flowing Comparison', detail: 'Synthesizing comparative leadership, valuation advantages & catalysts' },
  ],
  MARKET_ANALYSIS: [
    { id: 'm1', title: 'Benchmarking Exchange Indices', detail: 'Retrieving live NIFTY 50, SENSEX & sectoral index movements' },
    { id: 'm2', title: 'Scanning Market Breadth', detail: 'Tracking top gainers, top losers & volume participation across sectors' },
    { id: 'm3', title: 'Synthesizing Macro Intelligence', detail: 'Synthesizing flowing market posture, participation breadth & sentiment' },
  ],
  GENERAL_FINANCIAL_QUESTION: [
    { id: 'g1', title: 'Semantic Concept Parsing', detail: 'Interpreting core financial principles and educational intent' },
    { id: 'g2', title: 'Knowledge Base Retrieval', detail: 'Querying verified capital markets & investing doctrine' },
    { id: 'g3', title: 'Formulating Educational Prose', detail: 'Synthesizing clear conceptual explanation & practical application' },
  ],
};

// ---------------------------------------------------------------------------
// Dynamic Progressive Analysis Experience Component
// ---------------------------------------------------------------------------

function ProgressiveAnalysisExperience({
  intent,
}: {
  query: string;
  intent: QueryIntent;
}) {
  const stages = INTENT_STAGES[intent] || INTENT_STAGES.STOCK_ANALYSIS;
  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStageIdx((prev) => {
        if (prev < stages.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 450);
    return () => clearInterval(interval);
  }, [stages.length]);

  const progressPercent = Math.min(
    95,
    Math.round(((currentStageIdx + 1) / stages.length) * 100),
  );

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px 16px 16px 4px',
        padding: '1.25rem 1.5rem',
        maxWidth: '85%',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Header with intent and progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              background: '#eef2ff',
              padding: '0.35rem',
              borderRadius: '8px',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={15} className="animate-spin" />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
              Progressive Intelligence Resolution
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Intent: <strong style={{ color: '#4338ca' }}>{intent.replace(/_/g, ' ')}</strong> • Firing verified market tools
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4f46e5' }}>
          {progressPercent}%
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '4px',
          background: '#f1f5f9',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #4f46e5, #06b6d4)',
            transition: 'width 0.4s ease-out',
          }}
        />
      </div>

      {/* Progressive Stage Stepper */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.2rem' }}>
        {stages.map((stg, idx) => {
          const isDone = idx < currentStageIdx;
          const isActive = idx === currentStageIdx;
          const isPending = idx > currentStageIdx;

          return (
            <div
              key={stg.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                fontSize: '0.82rem',
                opacity: isPending ? 0.45 : 1,
                transition: 'all 0.25s ease',
              }}
            >
              <div style={{ marginTop: '0.15rem', flexShrink: 0 }}>
                {isDone ? (
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={11} strokeWidth={3} />
                  </div>
                ) : isActive ? (
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#eef2ff',
                      border: '1.5px solid #4f46e5',
                      color: '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RefreshCw size={10} className="animate-spin" />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: isActive ? 700 : isDone ? 600 : 500,
                    color: isActive ? '#0f172a' : isDone ? '#475569' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{stg.title}</span>
                  {isActive && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: '#eef2ff',
                        color: '#4338ca',
                        padding: '0.05rem 0.4rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                      }}
                    >
                      Executing...
                    </span>
                  )}
                </div>
                {isActive && (
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.1rem' }}>
                    {stg.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Assistant Content Component
// ---------------------------------------------------------------------------

function AssistantContent() {
  const { user, accessToken, loading: authLoading, isReady } = useRequireAuth();
  const searchParams = useSearchParams();
  const symbolParam = searchParams.get('symbol');
  const qParam = searchParams.get('q');

  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePendingQuery, setActivePendingQuery] = useState<{
    text: string;
    intent: QueryIntent;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explanationStyle, setExplanationStyle] = useState<'BEGINNER' | 'ADVANCED'>('BEGINNER');

  useEffect(() => {
    if (user?.explanationStyle) {
      setExplanationStyle(user.explanationStyle);
    } else {
      const cached = localStorage.getItem('finpilot_explanation_style');
      if (cached === 'BEGINNER' || cached === 'ADVANCED') {
        setExplanationStyle(cached);
      }
    }
  }, [user]);

  const handleToggleExplanationStyle = async (newStyle: 'BEGINNER' | 'ADVANCED') => {
    setExplanationStyle(newStyle);
    localStorage.setItem('finpilot_explanation_style', newStyle);
    if (accessToken) {
      try {
        await updateExplanationStyleApi(newStyle, accessToken);
      } catch (err) {
        console.error('Failed to sync explanation style to profile:', err);
      }
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedParamRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load user previous sessions
  const loadSessions = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await getChatSessionsApi(accessToken);
      setSessions(data);
    } catch {
      // Ignore session loading error
    }
  }, [accessToken]);

  useEffect(() => {
    if (isReady && accessToken) {
      loadSessions();
    }
  }, [isReady, accessToken, loadSessions]);

  const handleSendMessage = useCallback(
    async (customMessage?: string, symbolContext?: string) => {
      const textToSend = (customMessage || inputMessage).trim();
      if (!textToSend || !accessToken || loading) return;

      setError(null);
      setInputMessage('');

      const detectedIntent = classifyQueryIntent(textToSend, symbolContext);
      setActivePendingQuery({ text: textToSend, intent: detectedIntent });

      // Optimistic user message
      const tempUserMsg: AiChatMessage = {
        id: `temp-${Date.now()}`,
        sessionId: currentSessionId || 'temp-session',
        role: 'user',
        content: textToSend,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMsg]);
      setLoading(true);

      try {
        const response = await sendChatMessageApi(
          {
            sessionId: currentSessionId || undefined,
            message: textToSend,
            symbolContext: symbolContext || undefined,
            explanationStyle,
          },
          accessToken,
        );

        setCurrentSessionId(response.sessionId);

        const assistantMsg: AiChatMessage = {
          id: `assistant-${Date.now()}`,
          sessionId: response.sessionId,
          role: 'assistant',
          content: response.message,
          structuredAnalysis: response.structuredAnalysis,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        await loadSessions();
      } catch (err: any) {
        setError(err.message || 'Failed to generate AI analysis. Please try again.');
      } finally {
        setLoading(false);
        setActivePendingQuery(null);
      }
    },
    [inputMessage, accessToken, loading, currentSessionId, loadSessions, explanationStyle],
  );

  // Handle URL context parameters (e.g. /assistant?symbol=TCS.NS or /assistant?q=...)
  useEffect(() => {
    if (isReady && accessToken && !initializedParamRef.current) {
      if (symbolParam) {
        initializedParamRef.current = true;
        const initialPrompt = `Provide a comprehensive analysis of ${symbolParam.toUpperCase()} covering fundamentals, RSI/MACD momentum, and current risk factors.`;
        handleSendMessage(initialPrompt, symbolParam.toUpperCase());
      } else if (qParam) {
        initializedParamRef.current = true;
        handleSendMessage(qParam);
      }
    }
  }, [isReady, accessToken, symbolParam, qParam, handleSendMessage]);

  const handleSelectSession = async (sessionId: string) => {
    if (!accessToken) return;
    setError(null);
    try {
      const session = await getChatSessionByIdApi(sessionId, accessToken);
      setCurrentSessionId(session.id);
      setMessages(session.messages || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load chat history');
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setError(null);
    setInputMessage('');
    setActivePendingQuery(null);
  };

  if (authLoading || !isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ color: '#4f46e5', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <RefreshCw size={28} className="animate-spin" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Authenticating Session</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
            Verifying secure credentials for FinPilot Assistant...
          </p>
        </div>
      </div>
    );
  }

  const QUICK_PROMPTS = [
    { label: 'Comprehensive TCS Analysis', prompt: 'Should I buy TCS? Analyze its fundamentals, technicals, and valuation.' },
    { label: 'Technical Momentum of TCS', prompt: 'What is the RSI and technical momentum of TCS.NS?' },
    { label: 'Fundamental Valuation of TCS', prompt: 'What is the PE ratio and intrinsic DCF valuation of TCS.NS?' },
    { label: 'Compare Infosys vs TCS', prompt: 'Compare Infosys vs TCS based on live valuation multiples and RSI momentum.' },
    { label: 'Review My Portfolio Risk', prompt: 'Analyze my current portfolio allocation, sector concentration, and diversification.' },
    { label: 'Broad Market Outlook', prompt: 'How is the market doing today? What are the top gainers on NSE?' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', height: 'calc(100vh - 5.5rem)', minHeight: '600px' }}>

      {/* Sidebar: Chat History */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        <button
          onClick={handleNewChat}
          className="btn-primary"
          style={{ width: '100%', padding: '0.65rem 1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> New Analysis Session
        </button>

        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginTop: '0.5rem', letterSpacing: '0.05em' }}>
          Recent Sessions
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto', flex: 1, paddingRight: '0.2rem' }}>
          {sessions.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', padding: '2rem 0' }}>
              No previous analysis sessions recorded.
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '8px',
                  background: currentSessionId === s.id ? '#eef2ff' : '#ffffff',
                  border: currentSessionId === s.id ? '1px solid rgba(79, 70, 229, 0.35)' : '1px solid #f1f5f9',
                  color: currentSessionId === s.id ? '#4338ca' : '#334155',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 600 }}>
                  {s.title || 'Stock Analysis'}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Header Banner */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: '#eef2ff', padding: '0.45rem', borderRadius: '8px', color: '#4f46e5' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                FinPilot AI Financial Co-Pilot
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Grounded with real-time NSE & BSE prices, RSI/MACD indicators, fundamentals & news
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#4338ca', background: '#eef2ff', border: '1px solid rgba(79, 70, 229, 0.3)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>
            <Shield size={13} />
            Verified Tool Grounding
          </div>
        </div>

        {/* Persistent Legal & Principle Disclaimer */}
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem', color: '#b45309' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>Educational Co-Pilot:</strong> Analysis is synthesized mathematically from live market data and fundamentals. It does not constitute certified financial advice.
          </span>
        </div>

        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#fafaf9' }}>
          {messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '560px', padding: '2rem' }}>
              <div style={{ background: '#eef2ff', width: '56px', height: '56px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto', color: '#4f46e5' }}>
                <Sparkles size={28} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: '#0f172a' }}>How can I assist your portfolio today?</h3>
              <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Ask about specific stock fundamentals, RSI/MACD momentum, multi-stock comparisons, or request a complete review of your active portfolio.
              </p>

              {/* Quick Starter Prompts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'left' }}>
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="metric-card"
                    style={{
                      padding: '0.85rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#4f46e5', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{qp.label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>{qp.prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: '0.4rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem', fontWeight: 600 }}>
                  {msg.role === 'user' ? 'You' : 'FinPilot AI Assistant'}
                </div>

                {msg.role === 'user' ? (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      color: 'white',
                      padding: '0.85rem 1.25rem',
                      borderRadius: '16px 16px 4px 16px',
                      maxWidth: '75%',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      fontWeight: 500,
                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)',
                    }}
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className="glass-panel"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '1.5rem',
                      borderRadius: '16px 16px 16px 4px',
                      maxWidth: '92%',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    {msg.structuredAnalysis ? (
                      <ConversationalAiMessage analysis={msg.structuredAnalysis} />
                    ) : (
                      <div style={{ fontSize: '0.9rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: '#0f172a' }}>
                        {renderFlowingTextWithInlinePills(msg.content)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Dynamic Real-Stage Progress Stepper during resolution */}
          {loading && activePendingQuery && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem', width: '100%' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0 0.5rem', fontWeight: 600 }}>
                FinPilot AI Assistant
              </div>
              <ProgressiveAnalysisExperience
                query={activePendingQuery.text}
                intent={activePendingQuery.intent}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div style={{ background: '#fef2f2', borderTop: '1px solid #fecaca', padding: '0.6rem 1.5rem', color: '#b91c1c', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Switch: Explanation Style Toggle */}
        <div
          style={{
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            padding: '0.6rem 1.5rem 0.2rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
              Explanation Style:
            </span>
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '2px',
                border: '1px solid #e2e8f0',
              }}
            >
              <button
                type="button"
                id="explanation-mode-simple"
                onClick={() => handleToggleExplanationStyle('BEGINNER')}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: explanationStyle === 'BEGINNER' ? '#ffffff' : 'transparent',
                  color: explanationStyle === 'BEGINNER' ? '#4f46e5' : '#64748b',
                  boxShadow: explanationStyle === 'BEGINNER' ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                }}
              >
                Simple explanations
              </button>
              <button
                type="button"
                id="explanation-mode-technical"
                onClick={() => handleToggleExplanationStyle('ADVANCED')}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: explanationStyle === 'ADVANCED' ? '#ffffff' : 'transparent',
                  color: explanationStyle === 'ADVANCED' ? '#4f46e5' : '#64748b',
                  boxShadow: explanationStyle === 'ADVANCED' ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                }}
              >
                Technical terms
              </button>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {explanationStyle === 'BEGINNER'
              ? 'Plain-English explanations with every metric explained'
              : 'Institutional terminology (RSI, MACD, Piotroski, DCF, Beta)'}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            padding: '0.6rem 1.5rem 1rem 1.5rem',
            display: 'flex',
            gap: '0.75rem',
            background: '#ffffff',
          }}
        >
          <input
            type="text"
            placeholder="Ask FinPilot AI about any stock (e.g. TCS.NS, INFY, RELIANCE) or your portfolio..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.8rem 1.1rem',
              borderRadius: '10px',
              background: '#fafaf9',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
              fontSize: '0.88rem',
              fontWeight: 500,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="btn-primary"
            style={{ padding: '0.8rem 1.4rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Send size={15} />
            Send
          </button>
        </form>

      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversational Natural Language AI Message Bubble
// Flowing conversational text only - NO boxed cards, NO widget panels!
// ---------------------------------------------------------------------------

function getPillStyle(tag: string, value: string): { bg: string; color: string; border: string } {
  const upperTag = tag.toUpperCase();
  const upperVal = value.toUpperCase();

  // Bullish / Positive / Undervalued / Low Risk / Discount / High Confluence
  if (
    upperVal.includes('BULLISH') ||
    upperVal.includes('UNDERVALUED') ||
    upperVal.includes('DISCOUNT') ||
    upperVal.includes('CONVERGENCE') ||
    upperVal.includes('ACCUMULATE') ||
    upperVal.includes('VERY_STRONG') ||
    upperVal.includes('STRONG') ||
    (upperTag.includes('RISK') && upperVal.includes('LOW')) ||
    (upperTag.includes('CONFLICT') && (upperVal.startsWith('0') || upperVal.startsWith('1') || upperVal.startsWith('2')))
  ) {
    return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  }

  // Bearish / High Risk / Premium / Overvalued / High Conflict
  if (
    upperVal.includes('BEARISH') ||
    upperVal.includes('OVERVALUED') ||
    upperVal.includes('PREMIUM') ||
    upperVal.includes('DIVERGENCE') ||
    upperVal.includes('DISTRIBUTION') ||
    upperVal.includes('WEAK') ||
    (upperTag.includes('RISK') && upperVal.includes('HIGH')) ||
    (upperTag.includes('CONFLICT') && (upperVal.startsWith('6') || upperVal.startsWith('7') || upperVal.startsWith('8') || upperVal.startsWith('9')))
  ) {
    return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
  }

  // Tactical / Signal Alignment / Confluence
  if (
    upperTag.includes('ALIGNMENT') ||
    upperTag.includes('CONFLUENCE') ||
    upperTag.includes('TACTICAL') ||
    upperTag.includes('TECH') ||
    upperTag.includes('FUND') ||
    upperTag.includes('STRUCTURE')
  ) {
    return { bg: '#eef2ff', color: '#4338ca', border: 'rgba(79, 70, 229, 0.25)' };
  }

  // Volatility / Zone / Piotroski / Graham / Neutral / Moderate
  return { bg: '#f8fafc', color: '#334155', border: '#e2e8f0' };
}

function renderFlowingTextWithInlinePills(text: string) {
  if (!text) return null;

  // Split by [TAG: VALUE] or **Heading**
  const regex = /(\[[A-Z0-9_\- /]+:\s*[^\]]+\]|\*\*[^*]+\*\*)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Check bracketed tag
    const tagMatch = part.match(/^\[([A-Z0-9_\- /]+):\s*([^\]]+)\]$/);
    if (tagMatch) {
      const tag = tagMatch[1].trim();
      const val = tagMatch[2].trim();
      const style = getPillStyle(tag, val);
      return (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.12rem 0.5rem',
            margin: '0 0.2rem',
            borderRadius: '12px',
            fontSize: '0.78rem',
            fontWeight: 700,
            background: style.bg,
            color: style.color,
            border: `1px solid ${style.border}`,
            verticalAlign: 'baseline',
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          <span style={{ opacity: 0.75, fontSize: '0.72rem', textTransform: 'uppercase' }}>{tag}:</span>
          <span>{val}</span>
        </span>
      );
    }

    // Check bold heading
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <strong
          key={i}
          style={{
            fontWeight: 700,
            color: '#0f172a',
            marginRight: '0.15rem',
          }}
        >
          {boldMatch[1]}
        </strong>
      );
    }

    // Regular flowing text
    return <span key={i}>{part}</span>;
  });
}

function ConversationalAiMessage({ analysis }: { analysis: StructuredAiRecommendation }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const riskBadgeStyle =
    analysis.riskLevel === 'LOW'
      ? { color: '#059669', bg: '#ecfdf5', border: 'rgba(16, 185, 129, 0.3)' }
      : analysis.riskLevel === 'HIGH'
      ? { color: '#dc2626', bg: '#fef2f2', border: 'rgba(239, 68, 68, 0.3)' }
      : { color: '#d97706', bg: '#fffbeb', border: 'rgba(245, 158, 11, 0.3)' };

  const sourcesCount = analysis.sources?.length || 0;

  // Split technical & fundamental paragraphs for smooth flowing layout
  const technicalParagraphs = analysis.technicalAnalysis
    ? analysis.technicalAnalysis.split('\n\n').filter(Boolean)
    : [];

  const fundamentalParagraphs = analysis.fundamentalAnalysis
    ? analysis.fundamentalAnalysis.split('\n\n').filter(Boolean)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.92rem', lineHeight: 1.7, color: '#0f172a' }}>
      
      {/* 1. Flowing Executive Summary & Cross-Engine Synthesis */}
      <div style={{ color: '#0f172a', fontWeight: 500, fontSize: '0.96rem', lineHeight: 1.75 }}>
        {renderFlowingTextWithInlinePills(analysis.summary)}
      </div>

      {/* 2. Flowing Technical Outlook (Momentum, Volatility, S/R, Order Blocks, Risk, Tactical Playbook) */}
      {technicalParagraphs.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
          <div style={{ fontWeight: 800, color: '#4338ca', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <TrendingUp size={15} color="#4f46e5" /> Technical Momentum & Market Structure
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {technicalParagraphs.map((para, idx) => (
              <p key={idx} style={{ margin: 0, color: '#334155', fontSize: '0.9rem', lineHeight: 1.7 }}>
                {renderFlowingTextWithInlinePills(para)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 3. Flowing Fundamental Valuation (DCF, Graham, Piotroski, Capital Efficiency, Sector Benchmarks) */}
      {fundamentalParagraphs.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
          <div style={{ fontWeight: 800, color: '#4338ca', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <Layers size={15} color="#4f46e5" /> Fundamental Valuation & Balance Sheet Health
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {fundamentalParagraphs.map((para, idx) => (
              <p key={idx} style={{ margin: 0, color: '#334155', fontSize: '0.9rem', lineHeight: 1.7 }}>
                {renderFlowingTextWithInlinePills(para)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 4. Flowing Key Considerations / Strategic Catalysts & Risks */}
      {(analysis.positives?.length > 0 || analysis.negatives?.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
          {analysis.positives?.length > 0 && (
            <div>
              <div style={{ fontWeight: 800, color: '#059669', fontSize: '0.86rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <CheckCircle2 size={14} color="#059669" /> Strategic Catalysts & Positives:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', lineHeight: 1.6 }}>
                {analysis.positives.map((pos, idx) => (
                  <li key={idx}>{renderFlowingTextWithInlinePills(pos)}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.negatives?.length > 0 && (
            <div>
              <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.86rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <AlertTriangle size={14} color="#dc2626" /> Key Risks & Considerations:
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#334155', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', lineHeight: 1.6 }}>
                {analysis.negatives.map((neg, idx) => (
                  <li key={idx}>{renderFlowingTextWithInlinePills(neg)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 5. Subtle Inline Footer */}
      <div
        style={{
          marginTop: '0.25rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.78rem',
        }}
      >
        {/* Risk & Confidence Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '12px',
              background: riskBadgeStyle.bg,
              border: `1px solid ${riskBadgeStyle.border}`,
              color: riskBadgeStyle.color,
              fontWeight: 700,
            }}
          >
            <Shield size={12} /> Risk: {analysis.riskLevel}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.55rem',
              borderRadius: '12px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            Confidence: {analysis.confidenceScore}%
          </span>

          {analysis.dataConfidence && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '12px',
                background: analysis.dataConfidence === 'VERIFIED_LIVE' ? '#ecfdf5' : '#fffbeb',
                border: `1px solid ${analysis.dataConfidence === 'VERIFIED_LIVE' ? '#a7f3d0' : '#fcd34d'}`,
                color: analysis.dataConfidence === 'VERIFIED_LIVE' ? '#059669' : '#d97706',
                fontWeight: 600,
              }}
            >
              Feed: {analysis.dataConfidence.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Collapsible Sources Link */}
        {sourcesCount > 0 && (
          <div>
            <button
              onClick={() => setSourcesOpen((prev) => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.4rem',
                borderRadius: '4px',
                transition: 'color 0.15s',
              }}
            >
              <Database size={12} />
              <span>{sourcesOpen ? 'Hide Sources' : `Sources (${sourcesCount})`}</span>
              <span style={{ fontSize: '0.65rem' }}>{sourcesOpen ? '▲' : '▼'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Expanded Sources Panel */}
      {sourcesOpen && sourcesCount > 0 && (
        <div
          style={{
            marginTop: '0.25rem',
            padding: '0.75rem',
            borderRadius: '8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
            VERIFIED BACKEND DATA TOOLS QUERIED:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {analysis.sources.map((src, i) => {
              const label = typeof src === 'string' ? src : `${src.type}: ${src.description}`;
              return (
                <span
                  key={i}
                  style={{
                    fontSize: '0.72rem',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '0.15rem 0.5rem',
                    color: '#334155',
                    fontWeight: 500,
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <RefreshCw size={28} className="animate-spin" color="#4f46e5" />
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}
