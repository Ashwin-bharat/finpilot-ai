'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  ChevronLeft,
  Layers,
  Activity,
  DollarSign,
  Clock,
  Briefcase,
  X,
  List,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import { StockDetail, StockPricePoint, TechnicalIndicators, NewsArticle, StockHistoryRange, Watchlist } from '@finpilot/shared-types';
import { useAuth } from '../../../context/auth-context';
import { getStockBySymbolApi, getStockHistoryApi } from '../../../lib/market';
import { getIndicatorsApi } from '../../../lib/indicators';
import { getNewsApi } from '../../../lib/news';
import { getWatchlistsApi, addWatchlistItemApi } from '../../../lib/watchlist';
import { createTransactionApi } from '../../../lib/portfolio';
import { getBrokerStatusApi, placeBrokerOrderApi, BrokerStatus } from '../../../lib/broker';
import TradingViewChart from '../../../components/TradingViewChart';
import TradingModeBadge from '../../../components/TradingModeBadge';

/**
 * Map internal stock symbol to TradingView external URL.
 * Examples:
 * - "TATAMOTORS.NS" -> "https://www.tradingview.com/symbols/NSE-TATAMOTORS/"
 * - "INFY.NS"       -> "https://www.tradingview.com/symbols/NSE-INFY/"
 * - "SENSEX.BO"     -> "https://www.tradingview.com/symbols/BSE-SENSEX/"
 */
function getTradingViewExternalUrl(symbol: string): string {
  if (!symbol) return 'https://www.tradingview.com/symbols/NSE-TCS/';
  const uppercase = symbol.trim().toUpperCase();

  if (uppercase.endsWith('.NS')) {
    return `https://www.tradingview.com/symbols/NSE-${uppercase.replace(/\.NS$/, '')}/`;
  }

  if (uppercase.endsWith('.BO')) {
    return `https://www.tradingview.com/symbols/BSE-${uppercase.replace(/\.BO$/, '')}/`;
  }

  if (uppercase.includes(':')) {
    return `https://www.tradingview.com/symbols/${uppercase.replace(':', '-')}/`;
  }

  return `https://www.tradingview.com/symbols/NSE-${uppercase}/`;
}

interface PageProps {
  params: Promise<{ symbol: string }>;
}

type TabType = 'overview' | 'technical' | 'fundamentals' | 'news' | 'derivatives';

// Check if Indian Stock Market is currently Open (Mon-Fri 9:15 AM - 3:30 PM IST)
function getMarketStatus(): { isOpen: boolean; text: string } {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60000;
  const istDate = new Date(utcTime + istOffset);

  const day = istDate.getDay(); // 0 = Sun, 6 = Sat
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();

  if (day === 0 || day === 6) {
    return { isOpen: false, text: 'Market Closed (Weekend)' };
  }

  const timeInMinutes = hours * 60 + minutes;
  const openTime = 9 * 60 + 15; // 09:15
  const closeTime = 15 * 60 + 30; // 15:30

  if (timeInMinutes >= openTime && timeInMinutes <= closeTime) {
    return { isOpen: true, text: 'Market Open' };
  }

  return { isOpen: false, text: 'Market Closed' };
}

export default function StockDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const symbol = decodeURIComponent(resolvedParams.symbol).toUpperCase();

  const router = useRouter();
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

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

  const [userWatchlists, setUserWatchlists] = useState<Watchlist[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [watchlistSuccess, setWatchlistSuccess] = useState<string | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  // Broker & Paper-Trading Modal State
  const [brokerStatus, setBrokerStatus] = useState<BrokerStatus>({
    tradingMode: 'PAPER',
    liveTradingEnabled: false,
    brokerConnected: false,
    brokerClientCode: null,
    sessionExpiresAt: null,
  });
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeQuantity, setTradeQuantity] = useState<string>('1');
  const [tradePrice, setTradePrice] = useState<string>('');
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  const marketStatus = getMarketStatus();

  // 1. Fetch Core Stock Detail
  const fetchStockData = useCallback(async () => {
    try {
      const data = await getStockBySymbolApi(symbol);
      setStockDetail(data);
      if (!tradePrice) {
        setTradePrice(data.currentPrice ? data.currentPrice.toString() : '1000');
      }
    } catch (err: any) {
      console.error('Failed to load stock details:', err.message);
    }
  }, [symbol, tradePrice]);

  // 2. Fetch Historical Candles for Current Selected Range
  const fetchHistoryForRange = useCallback(async (range: StockHistoryRange) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const history = await getStockHistoryApi(symbol, range);
      if (!history || history.length === 0) {
        setHistoryError('Historical price data is currently unavailable.');
        setPriceHistory([]);
      } else {
        setPriceHistory(history);
      }
    } catch {
      setHistoryError('Failed to retrieve historical price stream.');
      setPriceHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [symbol]);

  // 3. Fetch Technical Indicators
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

  // 5. Fetch User Watchlists for Right Sidebar
  const fetchUserWatchlists = useCallback(async () => {
    if (!accessToken) return;
    setWatchlistLoading(true);
    try {
      const lists = await getWatchlistsApi(accessToken);
      setUserWatchlists(lists);
    } catch {
      setUserWatchlists([]);
    } finally {
      setWatchlistLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchStockData();
    fetchHistoryForRange(selectedRange);
    fetchIndicators();
    fetchNews();
    if (accessToken) {
      fetchUserWatchlists();
      getBrokerStatusApi(accessToken).then((st) => setBrokerStatus(st));
    }
  }, [fetchStockData, fetchHistoryForRange, selectedRange, fetchIndicators, fetchNews, fetchUserWatchlists, accessToken]);

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
      let lists = userWatchlists;
      if (lists.length === 0) {
        lists = await getWatchlistsApi(accessToken);
      }
      if (lists.length === 0) {
        throw new Error('No active watchlist found.');
      }
      const targetWatchlist = lists[0];
      await addWatchlistItemApi(targetWatchlist.id, { symbol }, accessToken);
      setWatchlistSuccess(`Saved to "${targetWatchlist.name}"!`);
      fetchUserWatchlists();
      setTimeout(() => setWatchlistSuccess(null), 3500);
    } catch (err: any) {
      setWatchlistError(err.message || 'Failed to add stock to watchlist.');
    } finally {
      setAddingToWatchlist(false);
    }
  };

  // Open Trade Modal from BUY / SELL overlays or header
  const openTradeModal = async (type: 'BUY' | 'SELL') => {
    setTradeType(type);
    setTradePrice(stockDetail?.currentPrice ? stockDetail.currentPrice.toString() : '1000');
    setTradeError(null);
    setTradeSuccess(null);
    if (accessToken) {
      const statusRes = await getBrokerStatusApi(accessToken);
      setBrokerStatus(statusRes);
    }
    setTradeModalOpen(true);
  };

  // Execute Broker Order (Paper or Live per user mode)
  const handleExecutePaperTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setTradeError('Please sign in to execute trade orders.');
      return;
    }

    const qty = parseFloat(tradeQuantity);
    const price = parseFloat(tradePrice);

    if (isNaN(qty) || qty <= 0) {
      setTradeError('Please enter a valid positive share quantity.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      setTradeError('Please enter a valid positive price.');
      return;
    }

    setTradeSubmitting(true);
    setTradeError(null);
    setTradeSuccess(null);

    try {
      // Execute through Broker Order API
      const result = await placeBrokerOrderApi(
        {
          symbol,
          type: tradeType,
          quantity: qty,
          price,
          orderType: 'MARKET',
        },
        accessToken,
      );

      // Also record in Portfolio Transactions
      await createTransactionApi(
        {
          symbol,
          type: tradeType,
          quantity: qty,
          price,
        },
        accessToken,
      ).catch(() => {});

      setTradeSuccess(`✓ Order filled (${brokerStatus.tradingMode} mode): ${tradeType} ${qty} ${symbol} @ ₹${price}`);
      setTimeout(() => {
        setTradeModalOpen(false);
        setTradeSuccess(null);
      }, 2000);
    } catch (err: any) {
      setTradeError(err.message || 'Failed to place order.');
    } finally {
      setTradeSubmitting(false);
    }
  };

  const isPositive = (stockDetail?.change ?? 0) >= 0;
  const fundamentals = stockDetail?.fundamentals;

  // Calculate Period High & Low from real price points
  const validPrices = priceHistory.map((p) => p.close).filter((c) => !isNaN(c));
  const periodHigh = validPrices.length > 0 ? Math.max(...validPrices) : stockDetail?.currentPrice || 0;
  const periodLow = validPrices.length > 0 ? Math.min(...validPrices) : stockDetail?.currentPrice || 0;

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'technical', label: 'Technical Trend', icon: ShieldCheck },
    { id: 'fundamentals', label: 'Valuation & Fundamentals', icon: PieChart },
    { id: 'news', label: 'Market Intelligence', icon: Newspaper },
    { id: 'derivatives', label: 'F&O Derivatives', icon: Layers },
  ];

  // Watchlist sidebar items
  const activeWatchlist = userWatchlists[0];
  const watchlistItems = activeWatchlist?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/dashboard" style={{ color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600 }}>
          <ChevronLeft size={16} /> Back to Dashboard
        </Link>
        <Link href="/watchlist" style={{ color: '#4f46e5', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700 }}>
          View All Watchlists →
        </Link>
      </div>

      {/* Trading Terminal Header */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            {symbol.toUpperCase().endsWith('.BO') ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  background: '#fffbeb',
                  color: '#b45309',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                BSE · Bombay Stock Exchange
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.75rem',
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid rgba(79, 70, 229, 0.3)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                NSE · National Stock Exchange
              </span>
            )}
            <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
              {stockDetail?.sector || 'Equities'}
            </span>

            {/* Market Open / Closed Status Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.65rem',
                borderRadius: '12px',
                background: marketStatus.isOpen ? '#ecfdf5' : '#f1f5f9',
                color: marketStatus.isOpen ? '#059669' : '#64748b',
                border: marketStatus.isOpen ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #e2e8f0',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: marketStatus.isOpen ? '#059669' : '#94a3b8',
                }}
              />
              {marketStatus.text}
            </div>
          </div>

          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {stockDetail?.symbol}
            <span style={{ fontSize: '1.05rem', fontWeight: 500, color: '#64748b' }}>
              {stockDetail?.name}
            </span>
          </h1>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0f172a' }}>
              {formatCurrency(stockDetail?.currentPrice || 0)}
            </span>
            <span
              className={isPositive ? 'badge-positive' : 'badge-negative'}
              style={{ fontSize: '0.95rem', padding: '0.3rem 0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              {isPositive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {isPositive ? '+' : ''}{formatCurrency(stockDetail?.change || 0)} ({formatPercent(stockDetail?.changePercent || 0)})
            </span>
          </div>
        </div>

        {/* Header Actions & Quick Trade Entry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => openTradeModal('BUY')}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: 'white',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(5, 150, 105, 0.3)',
              }}
            >
              BUY ₹{stockDetail?.currentPrice?.toFixed(2) || '1000'}
            </button>
            <button
              onClick={() => openTradeModal('SELL')}
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(220, 38, 38, 0.3)',
              }}
            >
              SELL ₹{stockDetail?.currentPrice?.toFixed(2) || '1000'}
            </button>
            <button
              onClick={handleAddToWatchlist}
              disabled={addingToWatchlist}
              className="btn-secondary"
              style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {watchlistSuccess ? <BookmarkCheck size={16} color="#059669" /> : <Bookmark size={16} />}
              {addingToWatchlist ? 'Saving...' : watchlistSuccess ? watchlistSuccess : 'Watchlist'}
            </button>
            <Link href={`/assistant?symbol=${symbol}`} style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} />
                Ask AI
              </button>
            </Link>
          </div>

          {watchlistError && (
            <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>{watchlistError}</span>
          )}
        </div>
      </div>

      {/* Tab Navigation Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                background: isActive ? '#eef2ff' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #4f46e5' : '2px solid transparent',
                color: isActive ? '#4338ca' : '#64748b',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <Icon size={16} color={isActive ? '#4f46e5' : '#64748b'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT SECTIONS */}

      {/* 1. OVERVIEW TAB — TRADING TERMINAL LAYOUT */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* THREE-COLUMN LAYOUT: Main Chart Area (~70% width) + Right Sidebar (~30% width) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>

            {/* LEFT / CENTER: MAIN AREA (~70% width) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Price Performance Smooth Line / Area Chart + BUY/SELL Overlay */}
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} color="#4f46e5" /> Price Performance & Trend
                  </h2>
                </div>

                {/* Chart Container */}
                <div style={{ position: 'relative', width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 0' }}>
                  {historyLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '360px', gap: '0.75rem' }}>
                      <RefreshCw size={24} className="animate-spin" color="#4f46e5" />
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Loading {selectedRange} price data...</span>
                    </div>
                  ) : historyError || priceHistory.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '360px', padding: '2rem', textAlign: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={24} color="#d97706" />
                      <span style={{ fontSize: '0.9rem', color: '#b45309', fontWeight: 700 }}>Historical Data Unavailable</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {historyError || 'No price points recorded for this timeframe.'}
                      </span>
                    </div>
                  ) : (
                    <TradingViewChart
                      data={priceHistory}
                      height={360}
                      currentPrice={stockDetail?.currentPrice}
                      previousClose={
                        stockDetail?.currentPrice !== undefined && stockDetail?.change !== undefined
                          ? Number((stockDetail.currentPrice - stockDetail.change).toFixed(2))
                          : undefined
                      }
                      onBuyClick={() => openTradeModal('BUY')}
                      onSellClick={() => openTradeModal('SELL')}
                    />
                  )}
                </div>

                {/* Timeframe Selector & TradingView External Link beneath the chart */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <a
                    href={getTradingViewExternalUrl(symbol)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <button
                      className="btn-secondary"
                      style={{
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: '#4f46e5',
                        borderColor: '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      <ExternalLink size={14} />
                      View on TradingView
                    </button>
                  </a>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Timeframe:</span>
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '0.2rem' }}>
                      {(['1D', '1W', '1M', '1Y', '5Y'] as StockHistoryRange[]).map((rng) => (
                        <button
                          key={rng}
                          onClick={() => {
                            setSelectedRange(rng);
                            fetchHistoryForRange(rng);
                          }}
                          style={{
                            padding: '0.4rem 0.9rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: selectedRange === rng ? '#ffffff' : 'transparent',
                            color: selectedRange === rng ? '#4f46e5' : '#64748b',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            boxShadow: selectedRange === rng ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                            transition: 'all 0.15s',
                          }}
                        >
                          {rng}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR (~30% width) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* 1. Watchlist Panel */}
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                    <List size={16} color="#4f46e5" /> Watchlist Items
                  </h3>
                  <Link href="/watchlist" style={{ fontSize: '0.75rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 700 }}>
                    Manage →
                  </Link>
                </div>

                {!accessToken ? (
                  <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                    <p style={{ margin: '0 0 0.75rem 0' }}>Sign in to view your real watchlist items here.</p>
                    <Link href="/login" style={{ textDecoration: 'none' }}>
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Sign In</button>
                    </Link>
                  </div>
                ) : watchlistLoading ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                    <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 0.4rem auto' }} />
                    Loading watchlist...
                  </div>
                ) : watchlistItems.length === 0 ? (
                  <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                    No stocks in active watchlist.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {watchlistItems.map((item) => {
                      const itemStock = item.stock;
                      const itemIsPositive = (itemStock.change ?? 0) >= 0;
                      const isCurrent = itemStock.symbol.toUpperCase() === symbol.toUpperCase();

                      return (
                        <div
                          key={item.id}
                          onClick={() => router.push(`/stock/${itemStock.symbol}`)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            background: isCurrent ? '#eef2ff' : '#ffffff',
                            border: isCurrent ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid #f1f5f9',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isCurrent) e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isCurrent) e.currentTarget.style.background = '#ffffff';
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>{itemStock.symbol}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {itemStock.name}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                              {itemStock.currentPrice ? formatCurrency(itemStock.currentPrice) : 'N/A'}
                            </div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: itemIsPositive ? '#059669' : '#dc2626',
                                fontWeight: 700,
                              }}
                            >
                              {itemIsPositive ? '+' : ''}{itemStock.changePercent ? formatPercent(itemStock.changePercent) : '0%'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Compact Key Stats Card */}
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <Activity size={16} color="#4f46e5" /> Compact Key Stats
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>P/E Ratio</span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{fundamentals?.peRatio ?? 'N/A'}</strong>
                  </div>
                  <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Market Cap</span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                      {fundamentals?.marketCap ? `₹${(fundamentals.marketCap / 10000000).toFixed(0)} Cr` : 'N/A'}
                    </strong>
                  </div>
                  <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Day High / Low</span>
                    <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                      ₹{periodHigh.toFixed(0)} / ₹{periodLow.toFixed(0)}
                    </strong>
                  </div>
                  <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>P/B Ratio</span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{fundamentals?.pbRatio ?? 'N/A'}</strong>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* BELOW FULL WIDTH: News Feed */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Newspaper size={18} color="#4f46e5" /> Market Intelligence & News Feed
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: isMockNews ? '#b45309' : '#4338ca',
                  background: isMockNews ? '#fffbeb' : '#eef2ff',
                  border: isMockNews ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(79, 70, 229, 0.3)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                {isMockNews ? 'Demo Feed' : 'Marketaux Feed'}
              </span>
            </div>

            {newsLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                Fetching news coverage for {symbol}...
              </div>
            ) : newsArticles.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No recent news coverage indexed for {symbol}.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                {newsArticles.map((article) => {
                  const sentimentClass = article.sentiment === 'POSITIVE'
                    ? 'badge-positive'
                    : article.sentiment === 'NEGATIVE'
                    ? 'badge-negative'
                    : 'badge-neutral';

                  return (
                    <div key={article.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>
                          {article.source} • {new Date(article.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <span className={sentimentClass}>{article.sentiment}</span>
                      </div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.4, margin: '0.2rem 0', color: '#0f172a' }}>
                        {article.url && article.url !== '#' ? (
                          <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                            {article.title}
                          </a>
                        ) : (
                          article.title
                        )}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
                        {article.summary}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 2. TECHNICAL TAB */}
      {activeTab === 'technical' && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="#4f46e5" /> Server-Computed Technical Trend Indicators
            </h2>
          </div>

          {indicatorsLoading || !indicators ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto' }} />
              Computing mathematical momentum indicators...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {/* RSI Section */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Relative Strength Index (RSI 14)</span>
                  <span style={{ fontWeight: 800, fontSize: '1.25rem', color: indicators.rsi.value >= 70 ? '#dc2626' : indicators.rsi.value <= 30 ? '#059669' : '#4f46e5' }}>
                    {indicators.rsi.value} / 100
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', position: 'relative', margin: '0.75rem 0' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${indicators.rsi.value}%`,
                      background: indicators.rsi.value >= 70 ? '#dc2626' : indicators.rsi.value <= 30 ? '#059669' : 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0 0 0', lineHeight: 1.4 }}>
                  {indicators.rsi.interpretation}
                </p>
              </div>

              {/* MACD Section */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>MACD (12, 26, 9)</span>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: indicators.macd.histogram >= 0 ? '#059669' : '#dc2626' }}>
                    Histogram: {indicators.macd.histogram >= 0 ? '+' : ''}{indicators.macd.histogram}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0' }}>
                  <span>MACD Line: <strong style={{ color: '#0f172a' }}>{indicators.macd.macdLine}</strong></span>
                  <span>Signal Line: <strong style={{ color: '#0f172a' }}>{indicators.macd.signalLine}</strong></span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0 0 0', lineHeight: 1.4 }}>
                  {indicators.macd.interpretation}
                </p>
              </div>

              {/* Moving Averages Section */}
              <div className="glass-card" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.75rem', color: '#0f172a' }}>Moving Averages (SMA) & Crossover Status</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>50-Day Simple Moving Average</div>
                    <div style={{ fontWeight: 800, fontSize: '1.4rem', marginTop: '0.2rem', color: '#0f172a' }}>₹{indicators.sma50.value}</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 600, color: indicators.sma50.differencePercent >= 0 ? '#059669' : '#dc2626' }}>
                      {indicators.sma50.differencePercent >= 0 ? '+' : ''}{indicators.sma50.differencePercent}% variance from current price
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>200-Day Simple Moving Average</div>
                    <div style={{ fontWeight: 800, fontSize: '1.4rem', marginTop: '0.2rem', color: '#0f172a' }}>₹{indicators.sma200.value}</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 600, color: indicators.sma200.differencePercent >= 0 ? '#059669' : '#dc2626' }}>
                      {indicators.sma200.differencePercent >= 0 ? '+' : ''}{indicators.sma200.differencePercent}% variance from current price
                    </div>
                  </div>
                </div>
                <div style={{ background: '#eef2ff', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#4338ca', fontWeight: 700, textTransform: 'uppercase' }}>Crossover Signal: {indicators.maCrossover.status}</div>
                  <div style={{ fontSize: '0.85rem', color: '#1e1b4b', marginTop: '0.2rem', fontWeight: 500 }}>{indicators.maCrossover.interpretation}</div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* 3. FUNDAMENTALS TAB */}
      {activeTab === 'fundamentals' && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChart size={20} color="#4f46e5" /> Financial Valuation & Balance Sheet Fundamentals
            </h2>
            {fundamentals?.fiscalPeriod && (
              <span style={{ fontSize: '0.8rem', color: '#4338ca', background: '#eef2ff', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 700 }}>
                {fundamentals.fiscalPeriod}
              </span>
            )}
          </div>

          {!fundamentals ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <AlertCircle size={32} color="#94a3b8" style={{ margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>Data Not Available</div>
              <p style={{ fontSize: '0.85rem', marginTop: '0.4rem', color: '#64748b' }}>
                Audited financial statements and valuation ratios are not yet seeded for {symbol}.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Price to Earnings (P/E)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.3rem', color: '#0f172a' }}>{fundamentals.peRatio ?? 'N/A'}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>Valuation Multiple</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Price to Book (P/B)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.3rem', color: '#0f172a' }}>{fundamentals.pbRatio ?? 'N/A'}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>Book Value Multiple</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Return on Equity (ROE)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.3rem', color: '#059669' }}>
                  {fundamentals.roe ? `${fundamentals.roe}%` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>Management Efficiency</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Return on Capital (ROCE)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.3rem', color: '#059669' }}>
                  {fundamentals.roce ? `${fundamentals.roce}%` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>Capital Return Metric</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Earnings Per Share (EPS TTM)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.3rem', color: '#0f172a' }}>
                  {fundamentals.eps ? `₹${fundamentals.eps}` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>Trailing 12 Months</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Debt to Equity</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.3rem', color: '#0f172a' }}>{fundamentals.debtToEquity ?? 'N/A'}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>Solvency Leverage</div>
              </div>
              <div className="glass-card" style={{ padding: '1.25rem', gridColumn: 'span 2' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Market Capitalization</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.3rem', color: '#4f46e5' }}>
                  {fundamentals.marketCap ? `₹${(fundamentals.marketCap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Crores` : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. NEWS TAB */}
      {activeTab === 'news' && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Newspaper size={20} color="#4f46e5" /> Indexed Market Intelligence & News
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                color: isMockNews ? '#b45309' : '#4338ca',
                background: isMockNews ? '#fffbeb' : '#eef2ff',
                border: isMockNews ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(79, 70, 229, 0.3)',
                padding: '0.25rem 0.65rem',
                borderRadius: '6px',
                fontWeight: 700,
              }}
            >
              {isMockNews ? 'Demo News Feed' : 'Live Marketaux Feed'}
            </span>
          </div>

          {newsLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem auto' }} />
              Fetching news coverage for {symbol}...
            </div>
          ) : newsArticles.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              No recent news coverage indexed for {symbol}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {newsArticles.map((article) => {
                const sentimentClass = article.sentiment === 'POSITIVE'
                  ? 'badge-positive'
                  : article.sentiment === 'NEGATIVE'
                  ? 'badge-negative'
                  : 'badge-neutral';

                return (
                  <div key={article.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>
                        {article.source} • {new Date(article.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className={sentimentClass}>{article.sentiment}</span>
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.2rem 0', lineHeight: 1.4, color: '#0f172a' }}>
                      {article.url && article.url !== '#' ? (
                        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                          {article.title}
                        </a>
                      ) : (
                        article.title
                      )}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                      {article.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. DERIVATIVES TAB */}
      {activeTab === 'derivatives' && (
        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={32} color="#4f46e5" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>F&O Derivatives & Options Analytics</h2>
          <p style={{ color: '#64748b', maxWidth: '480px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Futures open interest tracking, option chain Greeks analysis, and implied volatility matrix features are coming soon in Phase 7B.
          </p>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#b45309', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
            COMING SOON — PHASE 7B
          </div>
        </div>
      )}

      {/* PAPER-TRADING TRANSACTION MODAL */}
      {tradeModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              width: '100%',
              maxWidth: '440px',
              padding: '1.75rem',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: tradeType === 'BUY' ? '1px solid #a7f3d0' : '1px solid #fecaca',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    color: 'white',
                    background: tradeType === 'BUY' ? '#059669' : '#dc2626',
                  }}
                >
                  {tradeType} ORDER
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>{symbol}</h3>
                <TradingModeBadge mode={brokerStatus.tradingMode} size="small" />
              </div>
              <button
                onClick={() => setTradeModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {tradeSuccess ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle2 size={40} color="#059669" />
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{tradeSuccess}</div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Your paper portfolio has been updated.
                </p>
              </div>
            ) : (
              <form onSubmit={handleExecutePaperTrade} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {tradeError && (
                  <div style={{ padding: '0.65rem 0.85rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.82rem' }}>
                    {tradeError}
                  </div>
                )}

                {/* Toggle Order Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTradeType('BUY')}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: tradeType === 'BUY' ? '#059669' : 'transparent',
                      color: tradeType === 'BUY' ? 'white' : '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeType('SELL')}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: tradeType === 'SELL' ? '#dc2626' : 'transparent',
                      color: tradeType === 'SELL' ? 'white' : '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    SELL
                  </button>
                </div>

                {/* Quantity Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#334155', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Quantity (Shares)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={tradeQuantity}
                    onChange={(e) => setTradeQuantity(e.target.value)}
                    placeholder="e.g. 10"
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      color: '#0f172a',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Execution Price Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#334155', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Execution Price (₹ per share)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tradePrice}
                    onChange={(e) => setTradePrice(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      color: '#0f172a',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Total Value summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Estimated Total:</span>
                  <strong style={{ color: '#0f172a', fontWeight: 800 }}>
                    ₹{((parseFloat(tradeQuantity) || 0) * (parseFloat(tradePrice) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </strong>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={tradeSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.8rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: tradeType === 'BUY' ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                    boxShadow: tradeType === 'BUY' ? '0 4px 12px rgba(5, 150, 105, 0.3)' : '0 4px 12px rgba(220, 38, 38, 0.3)',
                  }}
                >
                  {tradeSubmitting ? <RefreshCw size={18} className="animate-spin" /> : `Execute ${tradeType} Paper Trade`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
