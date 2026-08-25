'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  AlertCircle,
  BarChart2,
  PieChart,
  ShieldCheck,
  Newspaper,
  ExternalLink,
  ChevronLeft,
  Calendar,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import { StockDetail, StockPricePoint, TechnicalIndicators, NewsArticle, StockHistoryRange } from '@finpilot/shared-types';
import { useAuth } from '../../../context/auth-context';
import { getStockBySymbolApi, getStockHistoryApi } from '../../../lib/market';
import { getIndicatorsApi } from '../../../lib/indicators';
import { getNewsApi } from '../../../lib/news';
import { getWatchlistsApi, addWatchlistItemApi } from '../../../lib/watchlist';

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export default function StockDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const symbol = decodeURIComponent(resolvedParams.symbol).toUpperCase();

  const { accessToken } = useAuth();

  // Stock Core Data & Range State
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [selectedRange, setSelectedRange] = useState<StockHistoryRange>('1M');
  const [priceHistory, setPriceHistory] = useState<StockPricePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Indicators, News & Watchlist State
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);

  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [isMockNews, setIsMockNews] = useState(true);
  const [newsLoading, setNewsLoading] = useState(false);

  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [watchlistSuccess, setWatchlistSuccess] = useState<string | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  // Hover state for interactive chart
  const [hoveredPoint, setHoveredPoint] = useState<StockPricePoint | null>(null);

  // 1. Fetch Primary Stock Detail
  const fetchStockData = useCallback(async () => {
    try {
      const data = await getStockBySymbolApi(symbol);
      setStockDetail(data);
      if (data.priceHistory && data.priceHistory.length > 0) {
        setPriceHistory(data.priceHistory);
      }
    } catch {
      // Fallback details
      setStockDetail({
        id: symbol,
        symbol,
        name: symbol,
        sector: 'Diversified',
        industry: 'General',
        exchange: 'NSE',
        currency: 'INR',
        currentPrice: 1000,
        change: 0,
        changePercent: 0,
        priceHistory: [],
        fundamentals: null,
      });
    }
  }, [symbol]);

  // 2. Fetch History for Selected Range
  const fetchHistoryForRange = useCallback(async (range: StockHistoryRange) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const history = await getStockHistoryApi(symbol, range);
      if (!history || history.length === 0) {
        setHistoryError('Historical price data is currently unavailable from the provider.');
        setPriceHistory([]);
      } else {
        setPriceHistory(history);
      }
    } catch {
      setHistoryError('Failed to retrieve historical price stream for this timeframe.');
      setPriceHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [symbol]);

  // 3. Fetch Indicators
  const fetchIndicators = useCallback(async () => {
    setIndicatorsLoading(true);
    try {
      const data = await getIndicatorsApi(symbol);
      setIndicators(data);
    } catch {
      // Indicators failed
    } finally {
      setIndicatorsLoading(false);
    }
  }, [symbol]);

  // 4. Fetch Stock News
  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await getNewsApi(symbol, 5);
      setNewsArticles(res.articles);
      setIsMockNews(res.isMock);
    } catch {
      // News fallback
    } finally {
      setNewsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchStockData();
    fetchHistoryForRange(selectedRange);
    fetchIndicators();
    fetchNews();
  }, [fetchStockData, fetchHistoryForRange, selectedRange, fetchIndicators, fetchNews]);

  // Handle Add to Watchlist
  const handleAddToWatchlist = async () => {
    if (!accessToken) {
      setWatchlistError('Please sign in to save stocks to your watchlist.');
      return;
    }

    setAddingToWatchlist(true);
    setWatchlistError(null);
    setWatchlistSuccess(null);

    try {
      const lists = await getWatchlistsApi(accessToken);
      if (lists.length === 0) {
        throw new Error('No active watchlist found.');
      }
      const targetWatchlist = lists[0];
      await addWatchlistItemApi(targetWatchlist.id, { symbol }, accessToken);
      setWatchlistSuccess(`Saved to "${targetWatchlist.name}"!`);
      setTimeout(() => setWatchlistSuccess(null), 3500);
    } catch (err: any) {
      setWatchlistError(err.message || 'Failed to add stock to watchlist.');
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const isPositive = (stockDetail?.change ?? 0) >= 0;
  const fundamentals = stockDetail?.fundamentals;

  // Chart SVG calculations
  const chartHeight = 260;
  const chartWidth = 700;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };

  const validPrices = priceHistory.map((p) => p.close).filter((c) => !isNaN(c));
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) * 0.995 : 0;
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) * 1.005 : 100;
  const priceRange = maxPrice - minPrice || 1;

  const getX = (index: number) => {
    if (priceHistory.length <= 1) return padding.left;
    return padding.left + (index / (priceHistory.length - 1)) * (chartWidth - padding.left - padding.right);
  };

  const getY = (price: number) => {
    return chartHeight - padding.bottom - ((price - minPrice) / priceRange) * (chartHeight - padding.top - padding.bottom);
  };

  const pointsString = priceHistory
    .map((p, i) => `${getX(i)},${getY(p.close)}`)
    .join(' ');

  const areaString = priceHistory.length > 0
    ? `${getX(0)},${chartHeight - padding.bottom} ${pointsString} ${getX(priceHistory.length - 1)},${chartHeight - padding.bottom}`
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Back Button & Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/dashboard" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
          <ChevronLeft size={16} /> Back to Dashboard
        </Link>
        <Link href="/watchlist" style={{ color: '#a5b4fc', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
          View All Watchlists →
        </Link>
      </div>

      {/* Hero Header Card */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
              {stockDetail?.exchange || 'NSE'}
            </span>
            <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
              {stockDetail?.sector || 'Equities'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              {stockDetail?.industry}
            </span>
          </div>

          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {stockDetail?.symbol}
            <span style={{ fontSize: '1.1rem', fontWeight: 400, color: 'var(--text-muted)' }}>
              {stockDetail?.name}
            </span>
          </h1>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 800 }}>
              {formatCurrency(stockDetail?.currentPrice || 0)}
            </span>
            <span
              className={isPositive ? 'badge-positive' : 'badge-negative'}
              style={{ fontSize: '1rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {isPositive ? '+' : ''}{formatCurrency(stockDetail?.change || 0)} ({formatPercent(stockDetail?.changePercent || 0)})
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleAddToWatchlist}
              disabled={addingToWatchlist}
              className="btn-secondary"
              style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {watchlistSuccess ? <BookmarkCheck size={18} color="#10b981" /> : <Bookmark size={18} />}
              {addingToWatchlist ? 'Adding...' : watchlistSuccess ? watchlistSuccess : 'Add to Watchlist'}
            </button>
            <Link href={`/assistant?symbol=${symbol}`} style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={18} />
                Ask Assistant
              </button>
            </Link>
          </div>

          {watchlistError && (
            <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{watchlistError}</span>
          )}
        </div>
      </div>

      {/* Main Grid: Chart + Fundamentals */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

        {/* Left Column: Interactive Price Chart */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} color="#8b5cf6" /> Price Action & Historical Chart
            </h2>

            {/* Timeframe Selector Tabs */}
            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '0.2rem' }}>
              {(['1D', '1W', '1M', '1Y', '5Y'] as StockHistoryRange[]).map((rng) => (
                <button
                  key={rng}
                  onClick={() => {
                    setSelectedRange(rng);
                    fetchHistoryForRange(rng);
                  }}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: selectedRange === rng ? '#6366f1' : 'transparent',
                    color: selectedRange === rng ? 'white' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {rng}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div style={{ position: 'relative', minHeight: `${chartHeight}px`, width: '100%', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', padding: '1rem 0' }}>
            {historyLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: `${chartHeight}px`, gap: '0.75rem' }}>
                <RefreshCw size={24} className="animate-spin" color="#8b5cf6" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading {selectedRange} price data...</span>
              </div>
            ) : historyError || priceHistory.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: `${chartHeight}px`, padding: '2rem', textAlign: 'center', gap: '0.5rem' }}>
                <AlertCircle size={24} color="#facc15" />
                <span style={{ fontSize: '0.9rem', color: '#facc15', fontWeight: 600 }}>Historical Data Unavailable</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {historyError || 'No price points recorded for this timeframe.'}
                </span>
              </div>
            ) : (
              <div>
                {/* Hover Inspector Banner */}
                <div style={{ padding: '0 1.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  {hoveredPoint ? (
                    <>
                      <span style={{ color: 'var(--text-muted)' }}>Date: <strong style={{ color: 'white' }}>{hoveredPoint.timestamp}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>Close: <strong style={{ color: '#10b981' }}>{formatCurrency(hoveredPoint.close)}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>High: <strong style={{ color: 'white' }}>{formatCurrency(hoveredPoint.high)}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>Low: <strong style={{ color: 'white' }}>{formatCurrency(hoveredPoint.low)}</strong></span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>Hover over the chart to inspect date and OHLC prices</span>
                  )}
                </div>

                {/* SVG Chart */}
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  style={{ width: '100%', height: 'auto', overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = padding.top + pct * (chartHeight - padding.top - padding.bottom);
                    const pVal = maxPrice - pct * priceRange;
                    return (
                      <g key={i}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={chartWidth - padding.right}
                          y2={y}
                          stroke="rgba(255, 255, 255, 0.05)"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={padding.left - 8}
                          y={y + 4}
                          fill="var(--text-subtle)"
                          fontSize="10"
                          textAnchor="end"
                        >
                          ₹{pVal.toFixed(0)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area Fill */}
                  <polygon points={areaString} fill="url(#chartGradient)" />

                  {/* Line Chart */}
                  <polyline
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={pointsString}
                  />

                  {/* Interactive Points */}
                  {priceHistory.map((p, idx) => {
                    const cx = getX(idx);
                    const cy = getY(p.close);
                    return (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={hoveredPoint === p ? 5 : 2}
                        fill={hoveredPoint === p ? '#38bdf8' : '#6366f1'}
                        style={{ cursor: 'pointer', transition: 'all 0.1s' }}
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Fundamentals Panel (Part B) */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChart size={20} color="#6366f1" /> Fundamental Metrics
            </h2>
            {fundamentals?.fiscalPeriod && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                {fundamentals.fiscalPeriod}
              </span>
            )}
          </div>

          {!fundamentals ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <AlertCircle size={28} color="#9ca3af" style={{ margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>Data Not Available</div>
              <p style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: 'var(--text-subtle)' }}>
                Audited financial statements and valuation ratios are not yet seeded for {symbol}.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>P/E Ratio</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.2rem' }}>{fundamentals.peRatio ?? 'N/A'}</div>
              </div>
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>P/B Ratio</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.2rem' }}>{fundamentals.pbRatio ?? 'N/A'}</div>
              </div>
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>ROE</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.2rem', color: '#10b981' }}>
                  {fundamentals.roe ? `${fundamentals.roe}%` : 'N/A'}
                </div>
              </div>
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>ROCE</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.2rem', color: '#10b981' }}>
                  {fundamentals.roce ? `${fundamentals.roce}%` : 'N/A'}
                </div>
              </div>
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>EPS (TTM)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.2rem' }}>
                  {fundamentals.eps ? `₹${fundamentals.eps}` : 'N/A'}
                </div>
              </div>
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Debt to Equity</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.2rem' }}>{fundamentals.debtToEquity ?? 'N/A'}</div>
              </div>
              <div className="glass-card" style={{ padding: '0.85rem', gridColumn: 'span 2' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Market Capitalization</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.2rem' }}>
                  {fundamentals.marketCap ? `₹${(fundamentals.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Second Grid: Technical Indicators (Part C) + News Feed (Part D) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>

        {/* Technical Indicators Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="#8b5cf6" /> Technical Trend Indicators
            </h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
              Server-Calculated
            </span>
          </div>

          {indicatorsLoading || !indicators ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
              Computing mathematical momentum indicators...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* RSI Section */}
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Relative Strength Index (RSI 14)</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem', color: indicators.rsi.value >= 70 ? '#ef4444' : indicators.rsi.value <= 30 ? '#10b981' : '#a78bfa' }}>
                    {indicators.rsi.value} / 100
                  </span>
                </div>
                {/* RSI Gauge Bar */}
                <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', position: 'relative', margin: '0.5rem 0' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${indicators.rsi.value}%`,
                      background: indicators.rsi.value >= 70 ? '#ef4444' : indicators.rsi.value <= 30 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                      borderRadius: '3px',
                    }}
                  />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.35rem 0 0 0', lineHeight: 1.4 }}>
                  {indicators.rsi.interpretation}
                </p>
              </div>

              {/* Moving Averages Section */}
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.6rem' }}>Moving Averages (SMA)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>50-Day SMA</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '0.2rem' }}>₹{indicators.sma50.value}</div>
                    <div style={{ fontSize: '0.75rem', color: indicators.sma50.differencePercent >= 0 ? '#10b981' : '#ef4444' }}>
                      {indicators.sma50.differencePercent >= 0 ? '+' : ''}{indicators.sma50.differencePercent}% from current
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>200-Day SMA</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '0.2rem' }}>₹{indicators.sma200.value}</div>
                    <div style={{ fontSize: '0.75rem', color: indicators.sma200.differencePercent >= 0 ? '#10b981' : '#ef4444' }}>
                      {indicators.sma200.differencePercent >= 0 ? '+' : ''}{indicators.sma200.differencePercent}% from current
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {indicators.maCrossover.interpretation}
                </p>
              </div>

              {/* MACD Section */}
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>MACD (12, 26, 9)</span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: indicators.macd.histogram >= 0 ? '#10b981' : '#ef4444' }}>
                    Hist: {indicators.macd.histogram >= 0 ? '+' : ''}{indicators.macd.histogram}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-subtle)', marginBottom: '0.4rem' }}>
                  <span>MACD Line: <strong style={{ color: 'white' }}>{indicators.macd.macdLine}</strong></span>
                  <span>Signal Line: <strong style={{ color: 'white' }}>{indicators.macd.signalLine}</strong></span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {indicators.macd.interpretation}
                </p>
              </div>

              {/* Principle Note */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic', textAlign: 'center' }}>
                * Technical indicators represent historical mathematical signals and do not constitute deterministic trade advice.
              </div>
            </div>
          )}
        </div>

        {/* Real Financial News Panel (Part D) */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Newspaper size={20} color="#6366f1" /> Related Market Intelligence
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

          {newsLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
              Fetching relevant news coverage...
            </div>
          ) : newsArticles.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No recent news coverage indexed for {symbol}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {newsArticles.map((article) => {
                const sentimentClass = article.sentiment === 'POSITIVE'
                  ? 'badge-positive'
                  : article.sentiment === 'NEGATIVE'
                  ? 'badge-negative'
                  : 'badge-neutral';

                return (
                  <div key={article.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>
                        {article.source} • {new Date(article.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <span className={sentimentClass}>{article.sentiment}</span>
                    </div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.4, margin: '0.2rem 0' }}>
                      {article.url && article.url !== '#' ? (
                        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          {article.title} <ExternalLink size={12} style={{ opacity: 0.7 }} />
                        </a>
                      ) : (
                        article.title
                      )}
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                      {article.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
