'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Sparkles, Newspaper, PieChart, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import { MarketIndex, GainerLoserItem, PortfolioAnalysis, NewsArticle } from '@finpilot/shared-types';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { getTopMoversApi } from '../../lib/market';
import { getPortfolioAnalysisApi } from '../../lib/portfolio';
import { getNewsApi } from '../../lib/news';
import {
  MOCK_MARKET_INDICES,
  MOCK_TOP_GAINERS,
  MOCK_TOP_LOSERS,
  MOCK_NEWS_FEED,
  MOCK_PORTFOLIO_SUMMARY,
} from './__mocks__/dashboard-data';

export default function DashboardPage() {
  const { user, accessToken, loading: authLoading, isReady } = useRequireAuth();

  const [indices, setIndices] = useState<MarketIndex[]>(MOCK_MARKET_INDICES);
  const [gainers, setGainers] = useState<GainerLoserItem[]>(MOCK_TOP_GAINERS);
  const [losers, setLosers] = useState<GainerLoserItem[]>(MOCK_TOP_LOSERS);
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [isMockNews, setIsMockNews] = useState(true);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setDataLoading(true);
    setWarningMessage(null);

    // 1. Fetch Real Market Data
    try {
      const movers = await getTopMoversApi();
      if (movers.indices && movers.indices.length > 0) setIndices(movers.indices);
      if (movers.gainers && movers.gainers.length > 0) setGainers(movers.gainers);
      if (movers.losers && movers.losers.length > 0) setLosers(movers.losers);
    } catch {
      setWarningMessage('Live market data stream unavailable; displaying fallback pricing.');
    }

    // 2. Fetch News Intelligence
    try {
      const newsData = await getNewsApi(undefined, 5);
      setNewsList(newsData.articles);
      setIsMockNews(newsData.isMock);
    } catch {
      // Fallback
    }

    // 3. Fetch Real Portfolio Data if Authenticated
    if (accessToken) {
      try {
        const analysis = await getPortfolioAnalysisApi(accessToken);
        setPortfolioAnalysis(analysis);
      } catch {
        // Keep fallback summary if no portfolio transactions recorded yet
      }
    }

    setDataLoading(false);
  }, [accessToken]);

  useEffect(() => {
    if (isReady) {
      fetchDashboardData();
    }
  }, [isReady, fetchDashboardData]);

  if (authLoading || !isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ color: '#8b5cf6', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <RefreshCw size={28} className="animate-spin" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f3f4f6' }}>Authenticating Session</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Verifying your security credentials...
          </p>
        </div>
      </div>
    );
  }

  const portfolioDisplay = portfolioAnalysis && portfolioAnalysis.holdingsCount > 0
    ? {
        totalInvestment: portfolioAnalysis.totalInvestment,
        currentValue: portfolioAnalysis.currentValue,
        totalProfit: portfolioAnalysis.totalProfit,
        totalProfitPercent: portfolioAnalysis.totalProfitPercent,
      }
    : MOCK_PORTFOLIO_SUMMARY;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Warning Notice if provider fell back */}
      {warningMessage && (
        <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#facc15' }}>
          <AlertCircle size={16} />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Hero Welcome Banner */}
      <div className="glass-panel" style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(18, 24, 38, 0.8) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99, 102, 241, 0.2)', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 600, marginBottom: '0.75rem' }}>
            <Sparkles size={14} /> AI-POWERED PORTFOLIO CO-PILOT
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Track real-time market movements, analyze live portfolio fundamentals, and review active watchlists.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={fetchDashboardData}
            className="btn-secondary"
            disabled={dataLoading}
            style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={15} />
            {dataLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link href="/assistant" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem' }}>
              <Sparkles size={18} />
              Ask Assistant
            </button>
          </Link>
        </div>
      </div>

      {/* Market Indices Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {indices.map((idx) => (
          <div key={idx.name} className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>{idx.name}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>{idx.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <span className={idx.isPositive ? 'badge-positive' : 'badge-negative'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                {idx.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {idx.change} ({idx.percent})
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Stocks + News & Portfolio */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

        {/* Left Column: Gainers/Losers + Portfolio preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Top Gainers & Losers */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={20} color="#10b981" /> Top Market Movers (Live)
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Gainers */}
              <div>
                <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Top Gainers</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {gainers.map((st) => (
                    <Link key={st.symbol} href={`/stock/${st.symbol}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{st.symbol}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{st.name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600 }}>{formatCurrency(st.price)}</div>
                          <span className="badge-positive">{formatPercent(st.changePercent)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Losers */}
              <div>
                <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase' }}>Top Losers</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {losers.map((st) => (
                    <Link key={st.symbol} href={`/stock/${st.symbol}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{st.symbol}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{st.name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600 }}>{formatCurrency(st.price)}</div>
                          <span className="badge-negative">{formatPercent(st.changePercent)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Portfolio Overview */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={20} color="#8b5cf6" /> Live Portfolio Summary
              </h2>
              <Link href="/portfolio" style={{ fontSize: '0.85rem', color: '#a5b4fc', textDecoration: 'none', fontWeight: 600 }}>
                Manage Portfolio →
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: '12px' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Total Investment</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>{formatCurrency(portfolioDisplay.totalInvestment)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Current Value</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>{formatCurrency(portfolioDisplay.currentValue)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>Total Profit</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: portfolioDisplay.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                  {portfolioDisplay.totalProfit >= 0 ? '+' : ''}{formatCurrency(portfolioDisplay.totalProfit)} ({portfolioDisplay.totalProfit >= 0 ? '+' : ''}{portfolioDisplay.totalProfitPercent}%)
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Financial News */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Newspaper size={20} color="#6366f1" /> Market Intelligence
            </h2>
            <span
              style={{
                fontSize: '0.7rem',
                color: isMockNews ? '#facc15' : '#a5b4fc',
                background: isMockNews ? 'rgba(234, 179, 8, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                border: isMockNews ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {isMockNews ? 'Demo News Feed' : 'Live Marketaux Feed'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(newsList.length > 0 ? newsList : MOCK_NEWS_FEED.map((m) => ({
              id: m.id,
              title: m.title,
              source: m.source,
              url: '#',
              publishedAt: new Date().toISOString(),
              sentiment: m.sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL',
              sentimentConfidence: 0.85,
              summary: m.summary,
            }))).map((news) => {
              const sentimentClass = news.sentiment === 'POSITIVE'
                ? 'badge-positive'
                : news.sentiment === 'NEGATIVE'
                ? 'badge-negative'
                : 'badge-neutral';

              return (
                <div key={news.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>
                      {news.source} • {new Date(news.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={sentimentClass}>{news.sentiment}</span>
                  </div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.4 }}>
                    {news.url && news.url !== '#' ? (
                      <a href={news.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        {news.title} <ExternalLink size={12} style={{ opacity: 0.7 }} />
                      </a>
                    ) : (
                      news.title
                    )}
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{news.summary}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
