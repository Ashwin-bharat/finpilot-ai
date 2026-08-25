'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Database,
  Briefcase,
  Layers,
  Plus,
  MessageSquare,
  TrendingUp,
  Shield,
  Clock,
} from 'lucide-react';
import { AiChatSession, AiChatMessage, StructuredAiRecommendation } from '@finpilot/shared-types';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { sendChatMessageApi, getChatSessionsApi, getChatSessionByIdApi } from '../../lib/ai';

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
  const [error, setError] = useState<string | null>(null);

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
            symbolContext: symbolContext || symbolParam || undefined,
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
      }
    },
    [inputMessage, accessToken, loading, currentSessionId, symbolParam, loadSessions],
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
  };

  if (authLoading || !isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ color: '#8b5cf6', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <RefreshCw size={28} className="animate-spin" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f3f4f6' }}>Authenticating Session</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Verifying secure credentials for FinPilot Assistant...
          </p>
        </div>
      </div>
    );
  }

  const QUICK_PROMPTS = [
    { label: 'Should I buy TCS?', prompt: 'Should I buy TCS? Analyze its fundamentals, technicals, and valuation.' },
    { label: 'Compare Infosys vs TCS', prompt: 'Compare Infosys vs TCS based on live valuation multiples and RSI momentum.' },
    { label: 'Analyze Reliance Industries', prompt: 'Provide a complete analysis of RELIANCE.NS with indicators and risks.' },
    { label: 'Review My Portfolio Risk', prompt: 'Analyze my current portfolio allocation, sector concentration, and diversification.' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', height: 'calc(100vh - 120px)', minHeight: '600px' }}>

      {/* Sidebar: Chat History */}
      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        <button
          onClick={handleNewChat}
          className="btn-primary"
          style={{ width: '100%', padding: '0.65rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> New Analysis Chat
        </button>

        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.5rem' }}>
          Recent Sessions
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1, paddingRight: '0.2rem' }}>
          {sessions.length === 0 ? (
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 0' }}>
              No previous analysis sessions yet.
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
                  background: currentSessionId === s.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: currentSessionId === s.id ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                  color: currentSessionId === s.id ? 'white' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s',
                }}
              >
                <MessageSquare size={15} style={{ flexShrink: 0, opacity: 0.7 }} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
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
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 27, 75, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.25)', padding: '0.4rem', borderRadius: '8px', color: '#a5b4fc' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>FinPilot AI Co-Pilot</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Grounded with live NSE price quotes, RSI/MACD indicators, fundamentals & news
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.15)', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
            <Shield size={13} />
            Probabilistic & Verified
          </div>
        </div>

        {/* Persistent Legal & Principle Disclaimer */}
        <div style={{ background: 'rgba(234, 179, 8, 0.08)', borderBottom: '1px solid rgba(234, 179, 8, 0.2)', padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem', color: '#facc15' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>Educational Co-Pilot:</strong> Analysis is synthesized mathematically from live market data and fundamentals. It does not constitute certified financial advice. Past patterns do not guarantee future performance.
          </span>
        </div>

        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '540px', padding: '2rem' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', width: '56px', height: '56px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto', color: '#a5b4fc' }}>
                <Sparkles size={28} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>How can I assist your portfolio today?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Ask about specific stock fundamentals, RSI/MACD momentum, multi-stock comparisons, or request a complete review of your active portfolio.
              </p>

              {/* Quick Starter Prompts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', textAlign: 'left' }}>
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="glass-card"
                    style={{
                      padding: '0.85rem',
                      cursor: 'pointer',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'white',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: '0.2rem' }}>{qp.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{qp.prompt}</div>
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', padding: '0 0.5rem' }}>
                  {msg.role === 'user' ? 'You' : 'FinPilot Assistant'}
                </div>

                {msg.role === 'user' ? (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      color: 'white',
                      padding: '0.85rem 1.25rem',
                      borderRadius: '16px 16px 4px 16px',
                      maxWidth: '75%',
                      fontSize: '0.92rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className="glass-panel"
                    style={{
                      background: 'rgba(18, 24, 38, 0.9)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      padding: '1.5rem',
                      borderRadius: '16px 16px 16px 4px',
                      maxWidth: '90%',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                    }}
                  >
                    {msg.structuredAnalysis ? (
                      <StructuredAnalysisCard analysis={msg.structuredAnalysis} />
                    ) : (
                      <div style={{ fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <RefreshCw size={18} className="animate-spin" color="#8b5cf6" />
              <span>Querying backend services and synthesizing verified financial analysis...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderTop: '1px solid #ef4444', padding: '0.6rem 1.5rem', color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '0.75rem',
            background: 'rgba(18, 24, 38, 0.6)',
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
              padding: '0.85rem 1.25rem',
              borderRadius: '10px',
              background: '#1f2937',
              border: '1px solid #374151',
              color: 'white',
              fontSize: '0.92rem',
            }}
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="btn-primary"
            style={{ padding: '0.85rem 1.5rem', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Send size={16} />
            Send
          </button>
        </form>

      </div>

    </div>
  );
}

function StructuredAnalysisCard({ analysis }: { analysis: StructuredAiRecommendation }) {
  const riskBadgeStyle = analysis.riskLevel === 'LOW'
    ? { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', color: '#34d399' }
    : analysis.riskLevel === 'HIGH'
    ? { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', color: '#f87171' }
    : { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', color: '#facc15' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Top Header: Risk Level & Confidence */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              background: riskBadgeStyle.bg,
              border: `1px solid ${riskBadgeStyle.border}`,
              color: riskBadgeStyle.color,
              padding: '0.35rem 0.85rem',
              borderRadius: '20px',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Shield size={14} /> Risk Level: {analysis.riskLevel}
          </span>
          <span style={{ fontSize: '0.82rem', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.15)', padding: '0.35rem 0.75rem', borderRadius: '20px', fontWeight: 600 }}>
            Confidence: {analysis.confidenceScore}%
          </span>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
          Grounded Analysis
        </span>
      </div>

      {/* Summary */}
      <div>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6', marginBottom: '0.4rem' }}>Executive Summary</h4>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>
          {analysis.summary}
        </p>
      </div>

      {/* Detailed Analysis Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#818cf8', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
            <TrendingUp size={16} /> Technical Indicators Outlook
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            {analysis.technicalAnalysis}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#818cf8', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
            <Layers size={16} /> Fundamental Valuation & Metrics
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            {analysis.fundamentalAnalysis}
          </p>
        </div>
      </div>

      {/* Positives & Negatives Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Positives */}
        <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem' }}>
            <CheckCircle2 size={16} /> Key Strengths & Positives
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#d1fae5', lineHeight: 1.5 }}>
            {analysis.positives.map((pos, idx) => (
              <li key={idx} style={{ marginBottom: '0.35rem' }}>{pos}</li>
            ))}
          </ul>
        </div>

        {/* Negatives */}
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem' }}>
            <AlertTriangle size={16} /> Risk Factors & Headwinds
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#fee2e2', lineHeight: 1.5 }}>
            {analysis.negatives.map((neg, idx) => (
              <li key={idx} style={{ marginBottom: '0.35rem' }}>{neg}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Data Sources Used */}
      {analysis.sources && analysis.sources.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Database size={13} /> Data Sources & Backend Tools Queried:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {analysis.sources.map((src, i) => {
              const label = typeof src === 'string' ? src : `${src.type}: ${src.description}`;
              return (
                <span
                  key={i}
                  style={{
                    fontSize: '0.72rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    padding: '0.2rem 0.55rem',
                    color: '#c7d2fe',
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
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <RefreshCw size={28} className="animate-spin" color="#8b5cf6" />
      </div>
    }>
      <AssistantContent />
    </Suspense>
  );
}
