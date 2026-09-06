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
  DollarSign,
  Clock,
  Coins,
  ShieldAlert,
  ExternalLink,
  Info,
  CheckCircle2,
  X,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import {
  CryptoAssetQuote,
  CryptoPricePoint,
  TechnicalIndicators,
  NewsArticle,
  CryptoWatchlist,
  CryptoBrokerStatus,
} from '@finpilot/shared-types';
import { useAuth } from '../../../context/auth-context';
import {
  getCryptoQuoteApi,
  getCryptoHistoryApi,
  getCryptoIndicatorsApi,
  getCryptoWatchlistsApi,
  addCryptoWatchlistItemApi,
  getCryptoBrokerStatusApi,
  toggleCryptoTradingModeApi,
  placeCryptoBrokerOrderApi,
  createCryptoTransactionApi,
} from '../../../lib/crypto';
import { getNewsApi } from '../../../lib/news';
import TradingViewChart from '../../../components/TradingViewChart';
import IndiaCryptoTaxDisclaimer from '../../../components/IndiaCryptoTaxDisclaimer';

interface PageProps {
  params: Promise<{ symbol: string }>;
}

type TabType = 'overview' | 'technical' | 'fundamentals' | 'news';

export default function CryptoDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const symbol = decodeURIComponent(resolvedParams.symbol).toUpperCase();

  const router = useRouter();
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Crypto Core Data State
  const [quote, setQuote] = useState<CryptoAssetQuote | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>('1M');
  const [priceHistory, setPriceHistory] = useState<CryptoPricePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Indicators, News & Watchlist State
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);

  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [isMockNews, setIsMockNews] = useState(true);
  const [newsLoading, setNewsLoading] = useState(false);

  const [userWatchlists, setUserWatchlists] = useState<CryptoWatchlist[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [watchlistSuccess, setWatchlistSuccess] = useState<string | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  // Broker & Paper/Live Trading Modal State
  const [brokerStatus, setBrokerStatus] = useState<CryptoBrokerStatus>({
    tradingMode: 'PAPER',
    liveTradingEnabled: false,
    brokerConnected: false,
    brokerName: 'CoinDCX',
  });
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeQuantity, setTradeQuantity] = useState<string>('0.01');
  const [tradePrice, setTradePrice] = useState<string>('');
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  // Live Trading Warning Modal Confirmation State
  const [showLiveWarningModal, setShowLiveWarningModal] = useState(false);
  const [confirmLiveCheckbox, setConfirmLiveCheckbox] = useState(false);

  // 1. Fetch Core Crypto Quote
  const fetchQuote = useCallback(async () => {
    try {
      const data = await getCryptoQuoteApi(symbol);
      setQuote(data);
      if (!tradePrice && data.currentPrice) {
        setTradePrice(data.currentPrice.toString());
      }
    } catch (err: any) {
      console.error('Failed to load crypto quote:', err.message);
    }
  }, [symbol, tradePrice]);

  // 2. Fetch Historical Candlesticks
  const fetchHistory = useCallback(async (range: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const history = await getCryptoHistoryApi(symbol, range);
      if (!history || history.length === 0) {
        setHistoryError('Historical candles currently unavailable.');
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
      const data = await getCryptoIndicatorsApi(symbol);
      setIndicators(data);
    } catch {
      // Handled gracefully
    } finally {
      setIndicatorsLoading(false);
    }
  }, [symbol]);

  // 4. Fetch Crypto News
  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await getNewsApi('CRYPTO', 5);
      setNewsArticles(res.articles);
      setIsMockNews(res.isMock);
    } catch {
      // Fallback
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // 5. Fetch Crypto Watchlists
  const fetchWatchlists = useCallback(async () => {
    if (!accessToken) return;
    setWatchlistLoading(true);
    try {
      const lists = await getCryptoWatchlistsApi(accessToken);
      setUserWatchlists(lists);
    } catch {
      setUserWatchlists([]);
    } finally {
      setWatchlistLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchQuote();
    fetchHistory(selectedRange);
    fetchIndicators();
    fetchNews();
    if (accessToken) {
      fetchWatchlists();
      getCryptoBrokerStatusApi(accessToken)
        .then((st) => setBrokerStatus(st))
        .catch(() => {});
    }
  }, [fetchQuote, fetchHistory, selectedRange, fetchIndicators, fetchNews, fetchWatchlists, accessToken]);

  // Handle Add to Watchlist
  const handleAddToWatchlist = async () => {
    if (!accessToken) {
      setWatchlistError('Please sign in to save assets to your crypto watchlist.');
      return;
    }

    setAddingToWatchlist(true);
    setWatchlistError(null);
    setWatchlistSuccess(null);

    try {
      let lists = userWatchlists;
      if (lists.length === 0) {
        lists = await getCryptoWatchlistsApi(accessToken);
      }
      if (lists.length === 0) {
        throw new Error('No active crypto watchlist found.');
      }
      const targetWatchlist = lists[0];
      await addCryptoWatchlistItemApi(targetWatchlist.id, symbol, accessToken);
      setWatchlistSuccess(`Saved to "${targetWatchlist.name}"!`);
      fetchWatchlists();
      setTimeout(() => setWatchlistSuccess(null), 3500);
    } catch (err: any) {
      setWatchlistError(err.message || 'Failed to add crypto to watchlist.');
    } finally {
      setAddingToWatchlist(false);
    }
  };

  // Open Trade Modal
  const openTradeModal = async (type: 'BUY' | 'SELL') => {
    setTradeType(type);
    if (quote?.currentPrice) {
      setTradePrice(quote.currentPrice.toString());
    }
    setTradeError(null);
    setTradeSuccess(null);
    if (accessToken) {
      try {
        const st = await getCryptoBrokerStatusApi(accessToken);
        setBrokerStatus(st);
      } catch {}
    }
    setTradeModalOpen(true);
  };

  // Toggle Paper / Live Mode
  const handleToggleMode = async (targetMode: 'PAPER' | 'LIVE') => {
    if (targetMode === 'LIVE' && !brokerStatus.liveTradingEnabled) {
      // Trigger confirmation warning modal
      setShowLiveWarningModal(true);
      return;
    }

    if (!accessToken) return;
    try {
      const updated = await toggleCryptoTradingModeApi(targetMode, false, accessToken);
      setBrokerStatus(updated);
    } catch (err: any) {
      setTradeError(err.message || 'Failed to toggle trading mode');
    }
  };

  // Confirm Live Mode from Warning Modal
  const handleConfirmLiveMode = async () => {
    if (!accessToken || !confirmLiveCheckbox) return;
    try {
      const updated = await toggleCryptoTradingModeApi('LIVE', true, accessToken);
      setBrokerStatus(updated);
      setShowLiveWarningModal(false);
      setConfirmLiveCheckbox(false);
    } catch (err: any) {
      setTradeError(err.message || 'Failed to enable live trading');
    }
  };

  // Execute Trade (Paper or Live per user mode)
  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setTradeError('Please sign in to execute crypto trade orders.');
      return;
    }

    const qty = parseFloat(tradeQuantity);
    const price = parseFloat(tradePrice);

    if (isNaN(qty) || qty <= 0) {
      setTradeError('Please enter a valid positive coin quantity.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      setTradeError('Please enter a valid positive price in INR.');
      return;
    }

    setTradeSubmitting(true);
    setTradeError(null);
    setTradeSuccess(null);

    try {
      // 1. Execute order through CoinDCX broker endpoint
      const result = await placeCryptoBrokerOrderApi(
        {
          symbol,
          type: tradeType,
          quantity: qty,
          price,
          orderType: 'MARKET',
          confirmLiveTrading: brokerStatus.tradingMode === 'LIVE',
        },
        accessToken,
      );

      // 2. Also mirror into isolated crypto portfolio
      await createCryptoTransactionApi(
        {
          symbol,
          type: tradeType,
          quantity: qty,
          price,
        },
        accessToken,
      ).catch(() => {});

      setTradeSuccess(
        `✓ Order filled (${brokerStatus.tradingMode} mode): ${tradeType} ${qty} ${symbol} @ ₹${price.toLocaleString('en-IN')}`,
      );
      setTimeout(() => {
        setTradeModalOpen(false);
        setTradeSuccess(null);
      }, 2500);
    } catch (err: any) {
      setTradeError(err.message || 'Failed to place crypto order.');
    } finally {
      setTradeSubmitting(false);
    }
  };

  const isPositive = (quote?.change ?? 0) >= 0;
  const currentPrice = quote?.currentPrice || 0;

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'technical', label: 'Technical Trend', icon: ShieldCheck },
    { id: 'fundamentals', label: 'Valuation & Tokenomics', icon: PieChart },
    { id: 'news', label: 'Market Intelligence', icon: Newspaper },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Back Link */}
      <div>
        <Link
          href="/markets"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#64748b',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <ChevronLeft size={16} /> Back to Markets
        </Link>
      </div>

      {/* INDIA CRYPTO TAX BANNER */}
      <IndiaCryptoTaxDisclaimer />

      {/* 1. HERO HEADER */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#fffbeb',
                color: '#b45309',
                fontWeight: 800,
                fontSize: '1.1rem',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)',
              }}
            >
              {symbol.slice(0, 2)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {symbol}
                </h1>
                <span
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                  }}
                >
                  {quote?.category || 'Crypto'}
                </span>
                {/* 24/7 OPEN BADGE */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '16px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#10b981',
                      display: 'inline-block',
                      boxShadow: '0 0 6px #10b981',
                    }}
                  />
                  Market Open 24/7
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
                {quote?.name || 'Cryptocurrency'} • CoinDCX Spot & Global Liquidity
              </p>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>
              {formatCurrency(currentPrice)}
            </span>
            <span
              className={isPositive ? 'badge-positive' : 'badge-negative'}
              style={{ fontSize: '0.88rem', padding: '0.3rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              {isPositive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {isPositive ? '+' : ''}{formatCurrency(quote?.change || 0)} ({isPositive ? '+' : ''}{formatPercent(quote?.changePercent || 0)})
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleAddToWatchlist}
              disabled={addingToWatchlist}
              className="btn-secondary"
              style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
            >
              {watchlistSuccess ? (
                <>
                  <BookmarkCheck size={16} color="#059669" />
                  <span style={{ color: '#059669' }}>Saved</span>
                </>
              ) : (
                <>
                  <Bookmark size={16} />
                  {addingToWatchlist ? 'Saving...' : 'Add to Watchlist'}
                </>
              )}
            </button>

            <Link href={`/assistant?q=Provide a technical analysis and risk assessment for cryptocurrency ${symbol}`} style={{ textDecoration: 'none' }}>
              <button className="btn-secondary" style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', color: '#f59e0b', fontWeight: 700 }}>
                <Sparkles size={16} color="#f59e0b" />
                Ask AI Co-Pilot
              </button>
            </Link>
          </div>

          {/* Trade CTA Buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', width: '100%', justifyContent: 'flex-end' }}>
            <button
              onClick={() => openTradeModal('BUY')}
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.4rem',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                transition: 'all 0.15s',
              }}
            >
              BUY / LONG
            </button>
            <button
              onClick={() => openTradeModal('SELL')}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.4rem',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                transition: 'all 0.15s',
              }}
            >
              SELL / SHORT
            </button>
          </div>

          {watchlistError && (
            <span style={{ color: '#dc2626', fontSize: '0.78rem' }}>{watchlistError}</span>
          )}
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
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
                gap: '0.45rem',
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? '#fffbeb' : 'transparent',
                color: isActive ? '#b45309' : '#64748b',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 2px rgba(245, 158, 11, 0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} color={isActive ? '#f59e0b' : '#64748b'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. TAB PANELS */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Chart Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  24/7 Price Performance & Depth
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Live CoinDCX candlesticks denominated in INR
                </span>
              </div>

              {/* Range Selector */}
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '0.2rem', gap: '0.2rem' }}>
                {['1D', '1W', '1M', '1Y', 'ALL'].map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setSelectedRange(r);
                      fetchHistory(r);
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: selectedRange === r ? '#ffffff' : 'transparent',
                      color: selectedRange === r ? '#b45309' : '#64748b',
                      fontWeight: selectedRange === r ? 800 : 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      boxShadow: selectedRange === r ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* TradingView / Lightweight Chart */}
            <div style={{ height: '360px', width: '100%', position: 'relative' }}>
              {historyLoading ? (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#64748b' }}>
                  <div style={{ textAlign: 'center' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', color: '#f59e0b' }} />
                    <span style={{ fontSize: '0.85rem' }}>Loading price stream...</span>
                  </div>
                </div>
              ) : historyError ? (
                <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#dc2626', fontSize: '0.85rem' }}>
                  {historyError}
                </div>
              ) : (
                <TradingViewChart
                  data={priceHistory}
                  height={360}
                  currentPrice={currentPrice}
                  onBuyClick={() => openTradeModal('BUY')}
                  onSellClick={() => openTradeModal('SELL')}
                />
              )}
            </div>

            {/* External Charting Links */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
              <a
                href={`https://www.tradingview.com/symbols/${symbol}USDT/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#4f46e5', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
              >
                View on TradingView <ExternalLink size={12} />
              </a>
              <a
                href={`https://coindcx.com/trade/${symbol}INR`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#f59e0b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
              >
                View on CoinDCX <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div className="metric-card">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>24H HIGH</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.3rem', color: '#0f172a' }}>
                {formatCurrency(quote?.high24h || currentPrice * 1.03)}
              </div>
            </div>
            <div className="metric-card">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>24H LOW</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.3rem', color: '#0f172a' }}>
                {formatCurrency(quote?.low24h || currentPrice * 0.97)}
              </div>
            </div>
            <div className="metric-card">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>24H VOLUME (INR)</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.3rem', color: '#0f172a' }}>
                {formatCurrency(quote?.volume24h || 154200000)}
              </div>
            </div>
            <div className="metric-card">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>BENCHMARK PAIR</span>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.3rem', color: '#f59e0b' }}>
                BTC / INR (365d)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TECHNICAL TREND */}
      {activeTab === 'technical' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* RSI Gauge */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>MOMENTUM OSCILLATOR</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0 0 0' }}>RSI (14)</h3>
              </div>
              <span
                style={{
                  background: (indicators?.rsi?.value ?? 50) >= 70 ? '#fef2f2' : (indicators?.rsi?.value ?? 50) <= 30 ? '#ecfdf5' : '#fffbeb',
                  color: (indicators?.rsi?.value ?? 50) >= 70 ? '#dc2626' : (indicators?.rsi?.value ?? 50) <= 30 ? '#059669' : '#b45309',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                }}
              >
                {(indicators?.rsi?.value ?? 50) >= 70 ? 'Overbought' : (indicators?.rsi?.value ?? 50) <= 30 ? 'Oversold' : 'Neutral'}
              </span>
            </div>

            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', textAlign: 'center', margin: '1rem 0' }}>
              {indicators?.rsi?.value ?? 52.4}
            </div>

            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, margin: 0 }}>
              {indicators?.rsi?.interpretation || 'Moderate momentum with balanced buyer and seller activity across global spot books.'}
            </p>
          </div>

          {/* Moving Averages */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TREND ALIGNMENT</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0 0 0' }}>Moving Averages (50 / 200)</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '0.5rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>50-Period SMA:</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(indicators?.sma50?.value || currentPrice * 0.98)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>200-Period SMA:</span>
                <strong style={{ color: '#0f172a' }}>{formatCurrency(indicators?.sma200?.value || currentPrice * 0.92)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Status:</span>
                <strong style={{ color: '#059669' }}>{indicators?.maCrossover?.status || 'BULLISH_ALIGNMENT'}</strong>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, margin: 0 }}>
              {indicators?.maCrossover?.interpretation || '50-period SMA is holding above 200-period baseline, confirming sustained trend health.'}
            </p>
          </div>

          {/* MACD */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>TREND CONVERGENCE</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0 0 0' }}>MACD (12, 26, 9)</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '0.5rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>MACD Line:</span>
                <strong style={{ color: '#0f172a' }}>{indicators?.macd?.macdLine ?? 124.5}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Signal Line:</span>
                <strong style={{ color: '#0f172a' }}>{indicators?.macd?.signalLine ?? 98.2}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Histogram:</span>
                <strong style={{ color: '#059669' }}>+{indicators?.macd?.histogram ?? 26.3}</strong>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, margin: 0 }}>
              {indicators?.macd?.interpretation || 'Bullish momentum indicated by MACD histogram expanding above the zero threshold.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: FUNDAMENTALS & TOKENOMICS (EXPLICITLY SKIPPED FOR CRYPTO) */}
      {activeTab === 'fundamentals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Explicit Policy Notice Panel */}
          <div
            className="glass-panel"
            style={{
              padding: '2rem',
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div
                style={{
                  background: '#f59e0b',
                  color: 'white',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                }}
              >
                <Info size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  VALUATION METHODOLOGY POLICY
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0 0.5rem 0' }}>
                  Fundamental Equity Models Do Not Apply to Cryptocurrencies
                </h2>
                <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
                  <strong>Discounted Cash Flow (DCF), Graham Number, and Piotroski F-Score</strong> rely strictly on corporate balance sheets, reported GAAP net income, and retained earnings. Cryptocurrencies do not possess corporate earnings statements. Instead, cryptocurrency valuations are driven by network adoption, protocol fee generation, on-chain liquidity velocity, and supply emissions.
                </p>
              </div>
            </div>
          </div>

          {/* Comparison Matrix */}
          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Equity Fundamentals vs. Crypto Tokenomics
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
                  Traditional Equities (NSE / BSE)
                </h4>
                <ul style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, paddingLeft: '1.2rem', margin: 0 }}>
                  <li>Price-to-Earnings (P/E) & Price-to-Book (P/B) Multiples</li>
                  <li>Free Cash Flow Discounting (DCF)</li>
                  <li>Piotroski 9-point financial stability score</li>
                  <li>Quarterly SEBI audited corporate filings</li>
                </ul>
              </div>

              <div style={{ background: '#fffbeb', padding: '1.25rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#b45309', marginBottom: '0.6rem' }}>
                  Crypto & Digital Assets (CoinDCX)
                </h4>
                <ul style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, paddingLeft: '1.2rem', margin: 0 }}>
                  <li>Network Value to Transactions (NVT Ratio)</li>
                  <li>Total Value Locked (TVL) & Protocol Fee Accrual</li>
                  <li>Maximum Token Supply & Halving Emission Schedules</li>
                  <li>24/7 Global Order Book Depth & Staking APRs</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NEWS */}
      {activeTab === 'news' && (
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Newspaper size={18} color="#f59e0b" /> Cryptocurrency Market Intelligence
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                color: isMockNews ? '#b45309' : '#059669',
                background: isMockNews ? '#fffbeb' : '#ecfdf5',
                border: isMockNews ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              {isMockNews ? 'Demo Feed' : 'Live Crypto Stream'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {newsArticles.map((news) => (
              <div key={news.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>
                    {news.source} • {new Date(news.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className={news.sentiment === 'POSITIVE' ? 'badge-positive' : news.sentiment === 'NEGATIVE' ? 'badge-negative' : 'badge-neutral'}>
                    {news.sentiment}
                  </span>
                </div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>
                  {news.url && news.url !== '#' ? (
                    <a href={news.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      {news.title} <ExternalLink size={12} style={{ opacity: 0.7 }} />
                    </a>
                  ) : (
                    news.title
                  )}
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45, margin: 0 }}>{news.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. REAL MONEY TRADING & PAPER ORDER MODAL */}
      {tradeModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              position: 'relative',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setTradeModalOpen(false)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            {/* Header with Mode Switcher */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Order Ticket: {symbol}
                </h2>
                {/* Paper / Live Mode Toggle */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '16px', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleMode('PAPER')}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '14px',
                      border: 'none',
                      background: brokerStatus.tradingMode === 'PAPER' ? '#ffffff' : 'transparent',
                      color: brokerStatus.tradingMode === 'PAPER' ? '#4f46e5' : '#64748b',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      boxShadow: brokerStatus.tradingMode === 'PAPER' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    PAPER
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMode('LIVE')}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '14px',
                      border: 'none',
                      background: brokerStatus.tradingMode === 'LIVE' ? '#dc2626' : 'transparent',
                      color: brokerStatus.tradingMode === 'LIVE' ? '#ffffff' : '#64748b',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      boxShadow: brokerStatus.tradingMode === 'LIVE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    LIVE (REAL)
                  </button>
                </div>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {brokerStatus.tradingMode === 'LIVE'
                  ? '⚠️ REAL MONEY ORDER: Executing on CoinDCX'
                  : 'Simulated Paper Trading Mode (Zero Real Capital Risk)'}
              </span>
            </div>

            {/* Persistent Tax Warning in Modal */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                padding: '0.6rem 0.85rem',
                color: '#b45309',
                fontSize: '0.75rem',
                lineHeight: 1.4,
                marginBottom: '1rem',
              }}
            >
              <strong>India Crypto Tax Note:</strong> Flat 30% tax on gains + 1% TDS deducted per Section 194S. Losses cannot offset equity profits.
            </div>

            {tradeError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', color: '#b91c1c', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {tradeError}
              </div>
            )}

            {tradeSuccess && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '0.75rem', color: '#065f46', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {tradeSuccess}
              </div>
            )}

            <form onSubmit={handleExecuteTrade} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Buy / Sell Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Order Side
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setTradeType('BUY')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: tradeType === 'BUY' ? '2px solid #059669' : '1px solid #e2e8f0',
                      background: tradeType === 'BUY' ? '#ecfdf5' : '#ffffff',
                      color: tradeType === 'BUY' ? '#059669' : '#64748b',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    BUY / LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeType('SELL')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: tradeType === 'SELL' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                      background: tradeType === 'SELL' ? '#fef2f2' : '#ffffff',
                      color: tradeType === 'SELL' ? '#dc2626' : '#64748b',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    SELL / SHORT
                  </button>
                </div>
              </div>

              {/* Quantity & Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Quantity ({symbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={tradeQuantity}
                    onChange={(e) => setTradeQuantity(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.92rem', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={tradePrice}
                    onChange={(e) => setTradePrice(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.92rem', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Total Estimated Cost */}
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Total Estimated Value:</span>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                  {formatCurrency((parseFloat(tradeQuantity) || 0) * (parseFloat(tradePrice) || 0))}
                </strong>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setTradeModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 1.2rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tradeSubmitting}
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: brokerStatus.tradingMode === 'LIVE' ? '#dc2626' : '#059669',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {tradeSubmitting ? 'Placing Order...' : `Confirm ${tradeType} (${brokerStatus.tradingMode})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. LIVE TRADING RISK CONFIRMATION WARNING MODAL */}
      {showLiveWarningModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '460px',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '2px solid #ef4444',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: '#fef2f2', padding: '0.6rem', borderRadius: '10px', color: '#dc2626' }}>
                <ShieldAlert size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                Real Money Trading Confirmation
              </h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              You are enabling <strong>LIVE CoinDCX Cryptocurrency Trading</strong>. Orders placed in this mode will transmit to CoinDCX and execute with <strong>REAL INR CAPITAL</strong>.
            </p>

            <ul style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, paddingLeft: '1.25rem', marginBottom: '1.25rem' }}>
              <li>Cryptocurrency prices are highly volatile 24 hours a day, 7 days a week.</li>
              <li>Under Indian law, a flat 30% tax applies to all gains, and a 1% TDS is deducted.</li>
              <li>Capital loss is possible. FinPilot AI provides tools and analysis, not financial advice.</li>
            </ul>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: '#0f172a', fontWeight: 700, cursor: 'pointer', marginBottom: '1.5rem' }}>
              <input
                type="checkbox"
                checked={confirmLiveCheckbox}
                onChange={(e) => setConfirmLiveCheckbox(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <span>I acknowledge the risks of real capital cryptocurrency trading on CoinDCX.</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowLiveWarningModal(false);
                  setConfirmLiveCheckbox(false);
                }}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.1rem', fontSize: '0.85rem' }}
              >
                Keep Paper Mode
              </button>
              <button
                type="button"
                disabled={!confirmLiveCheckbox}
                onClick={handleConfirmLiveMode}
                style={{
                  padding: '0.6rem 1.3rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: confirmLiveCheckbox ? '#dc2626' : '#94a3b8',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: confirmLiveCheckbox ? 'pointer' : 'not-allowed',
                }}
              >
                Enable Live Trading
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
