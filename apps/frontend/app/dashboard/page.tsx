'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Newspaper,
  PieChart,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
  ArrowUpRight,
  Zap,
  Wallet as WalletIcon,
  Coins,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import {
  MarketIndex,
  GainerLoserItem,
  Portfolio,
  PortfolioHolding,
  PortfolioAnalysis,
  SectorAllocation,
  NewsArticle,
  Wallet,
  CryptoPortfolio,
  CryptoHolding,
} from '@finpilot/shared-types';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { useAssetClass } from '../../context/asset-class-context';
import AssetClassToggle from '../../components/AssetClassToggle';
import IndiaCryptoTaxDisclaimer from '../../components/IndiaCryptoTaxDisclaimer';
import { getTopMoversApi } from '../../lib/market';
import { getPortfolioApi, getPortfolioAnalysisApi } from '../../lib/portfolio';
import { getNewsApi } from '../../lib/news';
import { getWalletApi } from '../../lib/wallet';
import { getCryptoTopMoversApi, getCryptoPortfolioApi } from '../../lib/crypto';

const DEFAULT_MARKET_INDICES: MarketIndex[] = [
  { name: 'NIFTY 50', value: '24,823.15', change: '+142.30', percent: '+0.58%', isPositive: true },
  { name: 'SENSEX', value: '81,332.72', change: '+412.50', percent: '+0.51%', isPositive: true },
  { name: 'BANK NIFTY', value: '51,120.40', change: '-85.20', percent: '-0.17%', isPositive: false },
  { name: 'NIFTY IT', value: '41,890.60', change: '+320.10', percent: '+0.77%', isPositive: true },
];

const DEFAULT_CRYPTO_INDICES: MarketIndex[] = [
  { name: 'BITCOIN (BTC)', value: '₹58,45,200', change: '+₹1,24,500', percent: '+2.18%', isPositive: true },
  { name: 'ETHEREUM (ETH)', value: '₹2,84,300', change: '+₹4,200', percent: '+1.50%', isPositive: true },
  { name: 'SOLANA (SOL)', value: '₹14,650', change: '-₹320', percent: '-2.14%', isPositive: false },
  { name: 'BINANCE COIN (BNB)', value: '₹48,900', change: '+₹650', percent: '+1.35%', isPositive: true },
];

const DEFAULT_TOP_GAINERS: GainerLoserItem[] = [
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Limited', price: 985.40, changePercent: 3.42 },
  { symbol: 'INFY.NS', name: 'Infosys Limited', price: 1892.15, changePercent: 2.15 },
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries', price: 2940.00, changePercent: 1.85 },
];

const DEFAULT_TOP_LOSERS: GainerLoserItem[] = [
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', price: 1610.50, changePercent: -1.24 },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited', price: 1180.20, changePercent: -0.92 },
  { symbol: 'WIPRO.NS', name: 'Wipro Limited', price: 540.30, changePercent: -0.85 },
];

export default function DashboardPage() {
  const { user, accessToken, loading: authLoading, isReady } = useRequireAuth();
  const { isCrypto } = useAssetClass();

  // Stocks State
  const [indices, setIndices] = useState<MarketIndex[]>(DEFAULT_MARKET_INDICES);
  const [gainers, setGainers] = useState<GainerLoserItem[]>(DEFAULT_TOP_GAINERS);
  const [losers, setLosers] = useState<GainerLoserItem[]>(DEFAULT_TOP_LOSERS);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);

  // Crypto State
  const [cryptoIndices, setCryptoIndices] = useState<MarketIndex[]>(DEFAULT_CRYPTO_INDICES);
  const [cryptoGainers, setCryptoGainers] = useState<GainerLoserItem[]>([]);
  const [cryptoLosers, setCryptoLosers] = useState<GainerLoserItem[]>([]);
  const [cryptoPortfolio, setCryptoPortfolio] = useState<CryptoPortfolio | null>(null);

  // Shared State
  const [newsList, setNewsList] = useState<NewsArticle[]>([]);
  const [isMockNews, setIsMockNews] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [moversTab, setMoversTab] = useState<'gainers' | 'losers'>('gainers');

  const fetchDashboardData = useCallback(async () => {
    setDataLoading(true);
    setWarningMessage(null);

    // 1. Fetch Market Data per Asset Class
    if (isCrypto) {
      try {
        const cryptoMovers = await getCryptoTopMoversApi();
        if (cryptoMovers.indices && cryptoMovers.indices.length > 0) {
          setCryptoIndices(cryptoMovers.indices);
        }
        if (cryptoMovers.gainers && cryptoMovers.gainers.length > 0) {
          setCryptoGainers(cryptoMovers.gainers);
        }
        if (cryptoMovers.losers && cryptoMovers.losers.length > 0) {
          setCryptoLosers(cryptoMovers.losers);
        }
      } catch {
        setWarningMessage('Live CoinDCX crypto stream unavailable; displaying cached crypto data.');
      }
    } else {
      try {
        const movers = await getTopMoversApi();
        if (movers.indices && movers.indices.length > 0) setIndices(movers.indices);
        if (movers.gainers && movers.gainers.length > 0) setGainers(movers.gainers);
        if (movers.losers && movers.losers.length > 0) setLosers(movers.losers);
      } catch {
        setWarningMessage('Live market data stream unavailable; displaying cached index data.');
      }
    }

    // 2. Fetch News Intelligence
    try {
      const newsData = await getNewsApi(isCrypto ? 'CRYPTO' : undefined, 5);
      setNewsList(newsData.articles);
      setIsMockNews(newsData.isMock);
    } catch {
      // Fallback
    }

    // 3. Fetch Real Isolated Portfolio Data & Paper Wallet if Authenticated
    if (accessToken) {
      if (isCrypto) {
        try {
          const [cPort, walletRes] = await Promise.all([
            getCryptoPortfolioApi(accessToken).catch(() => null),
            getWalletApi(accessToken).catch(() => null),
          ]);
          if (cPort) setCryptoPortfolio(cPort);
          if (walletRes) setWallet(walletRes);
        } catch {
          // Keep fallback
        }
      } else {
        try {
          const [port, analysis, walletRes] = await Promise.all([
            getPortfolioApi(accessToken).catch(() => null),
            getPortfolioAnalysisApi(accessToken).catch(() => null),
            getWalletApi(accessToken).catch(() => null),
          ]);
          if (port) setPortfolio(port);
          if (analysis) setPortfolioAnalysis(analysis);
          if (walletRes) setWallet(walletRes);
        } catch {
          // Keep fallback
        }
      }
    }

    setDataLoading(false);
  }, [accessToken, isCrypto]);

  useEffect(() => {
    if (isReady) {
      fetchDashboardData();
    }
  }, [isReady, fetchDashboardData]);

  if (authLoading || !isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ color: '#4f46e5', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <RefreshCw size={28} className="animate-spin" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
            Connecting to FinPilot
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            {isCrypto ? 'Synchronizing CoinDCX 24/7 crypto feeds...' : 'Synchronizing live NSE quotes & market feeds...'}
          </p>
        </div>
      </div>
    );
  }

  // Stock Portfolio Calculations
  const stockPortfolioDisplay = {
    currentValue: portfolioAnalysis?.currentValue || portfolio?.totalValue || 0,
    totalInvestment: portfolioAnalysis?.totalInvestment || 0,
    totalProfit: portfolioAnalysis?.totalProfit || (portfolio?.dayChange ?? 0),
    totalProfitPercent: portfolioAnalysis?.totalProfitPercent || (portfolio?.dayChangePercent ?? 0),
    diversificationScore: portfolioAnalysis?.diversificationScore ?? (portfolio ? 85 : 85),
    topSector: portfolioAnalysis?.sectorAllocation?.[0] || null,
    sectorAllocation: portfolioAnalysis?.sectorAllocation || [],
  };
  const stockHoldings = portfolio?.holdings || [];

  // Crypto Portfolio Calculations (Completely Separate)
  const cryptoHoldings = cryptoPortfolio?.holdings || [];
  const cryptoTotalValue = cryptoPortfolio?.totalValue || 0;
  const cryptoTotalProfit = cryptoPortfolio?.dayChange || 0;
  const cryptoTotalProfitPercent = cryptoPortfolio?.dayChangePercent || 0;
  
  // Calculate crypto allocations by asset
  const cryptoAllocations: SectorAllocation[] = cryptoHoldings.map((h) => ({
    sector: h.cryptoAsset.symbol,
    value: h.currentValue,
    percentage: cryptoTotalValue > 0 ? (h.currentValue / cryptoTotalValue) * 100 : 0,
  }));
  const topCryptoAsset = cryptoAllocations[0] || null;

  // Derive dynamic AI insight
  const getDynamicAiInsight = () => {
    if (isCrypto) {
      if (cryptoHoldings.length === 0) {
        return {
          title: 'Start Building Your Crypto Portfolio',
          body: 'No crypto holdings recorded yet. Explore 24/7 assets (BTC, ETH, SOL, BNB) to paper trade or record positions.',
          action: 'Explore Crypto',
          link: '/crypto/BTC',
        };
      }
      return {
        title: 'Crypto Market 24/7 Volatility Radar',
        body: `You have ${cryptoHoldings.length} active crypto position${cryptoHoldings.length > 1 ? 's' : ''}. Bitcoin benchmark risk factor is recalibrated to 365-day annualization.`,
        action: 'Ask AI Co-Pilot',
        link: '/assistant?q=Analyze the risk and 24h momentum of my crypto positions',
      };
    }

    if (!portfolioAnalysis || portfolioAnalysis.holdingsCount === 0) {
      return {
        title: 'Start Building Your Portfolio',
        body: 'No holdings recorded yet. Search Indian stocks (e.g. TATAMOTORS.NS, INFY.NS) to paper trade or record your real positions.',
        action: 'Explore Stocks',
        link: '/stock/TATAMOTORS.NS',
      };
    }

    if (stockPortfolioDisplay.diversificationScore <= 40) {
      return {
        title: 'Sector Rebalancing Opportunity',
        body: `Your portfolio shows high concentration in ${stockPortfolioDisplay.topSector?.sector || 'a single sector'} (${formatPercent(stockPortfolioDisplay.topSector?.percentage || 0)}). Ask AI to suggest diversification strategies.`,
        action: 'Ask FinPilot AI',
        link: `/assistant?q=How can I diversify my portfolio away from ${stockPortfolioDisplay.topSector?.sector || 'tech'}?`,
      };
    }

    return {
      title: 'Portfolio Health Check: Balanced',
      body: `Diversification score is ${stockPortfolioDisplay.diversificationScore}/100 across ${portfolioAnalysis.holdingsCount} active positions. Market exposure is healthy.`,
      action: 'Ask AI Review',
      link: '/assistant?q=Give me a comprehensive health check on my active portfolio',
    };
  };

  const aiInsight = getDynamicAiInsight();
  const activeIndices = isCrypto ? cryptoIndices : indices;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* TOP TOGGLE HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0.5rem 0',
        }}
      >
        <AssetClassToggle />
      </div>

      {/* INDIA CRYPTO TAX DISCLAIMER (WHEN IN CRYPTO MODE) */}
      {isCrypto && <IndiaCryptoTaxDisclaimer />}

      {/* 1. WELCOME HERO & QUICK SUMMARY */}
      <div
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: isCrypto ? '#fffbeb' : '#eef2ff',
              padding: '0.3rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.78rem',
              color: isCrypto ? '#b45309' : '#4338ca',
              fontWeight: 700,
              marginBottom: '0.6rem',
              border: isCrypto ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(79, 70, 229, 0.2)',
            }}
          >
            {isCrypto ? <Coins size={14} /> : <Zap size={14} />}
            {isCrypto ? 'CRYPTO ASSET HUB (24/7 LIVE)' : 'LIVE FINANCIAL DASHBOARD'}
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
            Welcome back, {user?.fullName?.split(' ')[0] || 'Investor'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            {isCrypto
              ? 'Real-time CoinDCX cryptocurrency market quotes, isolated crypto portfolio metrics, and 24/7 technical momentum.'
              : 'Unified real-time NSE & BSE quotes, mathematical technical signals, and simulated paper portfolio analytics.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {wallet && (
            <Link href="/wallet" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.9rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  fontWeight: 700,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <WalletIcon size={16} color={isCrypto ? '#f59e0b' : '#4f46e5'} />
                <span>Paper Wallet: ₹{wallet.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </Link>
          )}

          <button
            onClick={fetchDashboardData}
            className="btn-secondary"
            disabled={dataLoading}
            style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={dataLoading ? 'animate-spin' : ''} />
            {dataLoading ? 'Syncing...' : 'Refresh'}
          </button>

          <Link href="/assistant" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ padding: '0.65rem 1.2rem', fontSize: '0.85rem' }}>
              <Sparkles size={15} />
              Ask AI Co-Pilot
            </button>
          </Link>
        </div>
      </div>

      {warningMessage && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '0.75rem 1rem', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* 2. REAL-TIME AI RECOMMENDATION / INSIGHT CARD */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          background: isCrypto
            ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
            : 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
          border: isCrypto ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(79, 70, 229, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              background: isCrypto ? '#f59e0b' : '#4f46e5',
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              flexShrink: 0,
              boxShadow: isCrypto ? '0 4px 10px rgba(245, 158, 11, 0.3)' : '0 4px 10px rgba(79, 70, 229, 0.3)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: isCrypto ? '#b45309' : '#4338ca',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              FINPILOT AI {isCrypto ? 'CRYPTO' : ''} INSIGHT
            </div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0.15rem 0' }}>
              {aiInsight.title}
            </h4>
            <p style={{ color: '#475569', fontSize: '0.86rem', margin: 0, lineHeight: 1.4 }}>
              {aiInsight.body}
            </p>
          </div>
        </div>

        <Link href={aiInsight.link} style={{ textDecoration: 'none' }}>
          <button
            className="btn-primary"
            style={{
              padding: '0.55rem 1.1rem',
              fontSize: '0.82rem',
              whiteSpace: 'nowrap',
              background: isCrypto ? '#f59e0b' : undefined,
            }}
          >
            {aiInsight.action} →
          </button>
        </Link>
      </div>

      {/* 3. METRICS GRID (5 CARDS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem' }}>
        
        {/* Card 1: Total Portfolio Value */}
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            <span>{isCrypto ? 'CRYPTO VALUE' : 'PORTFOLIO VALUE'}</span>
            <PieChart size={16} color={isCrypto ? '#f59e0b' : '#4f46e5'} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
            {formatCurrency(isCrypto ? cryptoTotalValue : stockPortfolioDisplay.currentValue)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
            {isCrypto ? `${cryptoHoldings.length} crypto positions` : `${stockHoldings.length} active positions`}
          </div>
        </div>

        {/* Card 2: Total Return P&L */}
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            <span>TOTAL PROFIT / LOSS</span>
            {(isCrypto ? cryptoTotalProfit : stockPortfolioDisplay.totalProfit) >= 0 ? (
              <TrendingUp size={16} color="#059669" />
            ) : (
              <TrendingDown size={16} color="#dc2626" />
            )}
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              marginTop: '0.4rem',
              color: (isCrypto ? cryptoTotalProfit : stockPortfolioDisplay.totalProfit) >= 0 ? '#059669' : '#dc2626',
            }}
          >
            {(isCrypto ? cryptoTotalProfit : stockPortfolioDisplay.totalProfit) >= 0 ? '+' : ''}
            {formatCurrency(isCrypto ? cryptoTotalProfit : stockPortfolioDisplay.totalProfit)}
          </div>
          <div style={{ display: 'inline-flex', marginTop: '0.3rem' }}>
            <span
              className={(isCrypto ? cryptoTotalProfit : stockPortfolioDisplay.totalProfit) >= 0 ? 'badge-positive' : 'badge-negative'}
              style={{ fontSize: '0.75rem' }}
            >
              {(isCrypto ? cryptoTotalProfitPercent : stockPortfolioDisplay.totalProfitPercent) >= 0 ? '+' : ''}
              {formatPercent(isCrypto ? cryptoTotalProfitPercent : stockPortfolioDisplay.totalProfitPercent)} Return
            </span>
          </div>
        </div>

        {/* Card 3: Diversification / Risk Metric */}
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            <span>{isCrypto ? 'CRYPTO RISK PROFILE' : 'DIVERSIFICATION SCORE'}</span>
            <Shield size={16} color={isCrypto ? '#f59e0b' : '#4f46e5'} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: isCrypto ? '#f59e0b' : '#4f46e5' }}>
            {isCrypto ? 'HIGH VOL' : `${stockPortfolioDisplay.diversificationScore} `}
            {!isCrypto && <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>/ 100</span>}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
            {isCrypto ? '24/7 Global Trading' : stockPortfolioDisplay.diversificationScore > 70 ? 'Optimal allocation' : 'Moderate concentration'}
          </div>
        </div>

        {/* Card 4: Top Asset / Sector Weight */}
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            <span>{isCrypto ? 'TOP ASSET WEIGHT' : 'TOP SECTOR WEIGHT'}</span>
            <Layers size={16} color={isCrypto ? '#f59e0b' : '#4f46e5'} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isCrypto ? (topCryptoAsset ? topCryptoAsset.sector : 'None') : (stockPortfolioDisplay.topSector ? stockPortfolioDisplay.topSector.sector : 'Equities')}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
            {isCrypto
              ? topCryptoAsset ? `${formatPercent(topCryptoAsset.percentage)} of portfolio` : 'No holdings'
              : stockPortfolioDisplay.topSector ? `${formatPercent(stockPortfolioDisplay.topSector.percentage)} of portfolio` : 'No holdings'}
          </div>
        </div>

        {/* Card 5: Benchmark Live Pulse */}
        <div className="metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            <span>{isCrypto ? 'BTC BENCHMARK PULSE' : 'NIFTY 50 BENCHMARK'}</span>
            <ArrowUpRight size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
            {activeIndices[0]?.value || (isCrypto ? '₹58,45,200' : '24,823.15')}
          </div>
          <div style={{ fontSize: '0.78rem', color: activeIndices[0]?.isPositive ? '#059669' : '#dc2626', marginTop: '0.3rem', fontWeight: 700 }}>
            {activeIndices[0]?.change || '+2.18%'} ({activeIndices[0]?.percent || '+2.18%'})
          </div>
        </div>

      </div>

      {/* 4. DASHBOARD V2 PANELS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Panel A: Allocation Donut */}
        <AllocationPanel
          sectorAllocation={isCrypto ? cryptoAllocations : stockPortfolioDisplay.sectorAllocation}
          isCrypto={isCrypto}
        />

        {/* Panel B: Risk Lens */}
        <DiversificationPanel
          score={isCrypto ? (cryptoHoldings.length > 3 ? 75 : 45) : stockPortfolioDisplay.diversificationScore}
          holdingsCount={isCrypto ? cryptoHoldings.length : (portfolioAnalysis?.holdingsCount || stockHoldings.length)}
          isCrypto={isCrypto}
        />

        {/* Panel C: Top Holdings Preview */}
        <HoldingsPreview
          stockHoldings={stockHoldings}
          cryptoHoldings={cryptoHoldings}
          totalValue={isCrypto ? cryptoTotalValue : stockPortfolioDisplay.currentValue}
          isCrypto={isCrypto}
        />

      </div>

      {/* 5. SPLIT GRID: TOP MOVERS + NEWS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>

        {/* Column A: Top Gainers & Losers */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              {isCrypto ? 'CoinDCX Top Movers' : 'NSE Top Movers'}
            </h3>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '0.2rem' }}>
              <button
                onClick={() => setMoversTab('gainers')}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: moversTab === 'gainers' ? '#ffffff' : 'transparent',
                  color: moversTab === 'gainers' ? '#059669' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: moversTab === 'gainers' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Top Gainers
              </button>
              <button
                onClick={() => setMoversTab('losers')}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: moversTab === 'losers' ? '#ffffff' : 'transparent',
                  color: moversTab === 'losers' ? '#dc2626' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: moversTab === 'losers' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Top Losers
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {(isCrypto ? (moversTab === 'gainers' ? cryptoGainers : cryptoLosers) : (moversTab === 'gainers' ? gainers : losers)).map((item) => {
              const isGain = (item.changePercent ?? 0) >= 0;
              const linkUrl = isCrypto ? `/crypto/${item.symbol}` : `/stock/${item.symbol}`;

              return (
                <Link
                  key={item.symbol}
                  href={linkUrl}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: isCrypto ? '#fffbeb' : '#eef2ff',
                          color: isCrypto ? '#b45309' : '#4338ca',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {item.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{item.symbol}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.name}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                        {formatCurrency(item.price ?? 0)}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: isGain ? '#059669' : '#dc2626',
                          fontWeight: 700,
                        }}
                      >
                        {isGain ? '+' : ''}{formatPercent(item.changePercent ?? 0)}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Column B: News Feed */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Newspaper size={18} color={isCrypto ? '#f59e0b' : '#4f46e5'} /> Market Intelligence
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                color: isMockNews ? '#b45309' : '#4338ca',
                background: isMockNews ? '#fffbeb' : '#eef2ff',
                border: isMockNews ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(79, 70, 229, 0.3)',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              {isMockNews ? 'Demo Feed' : 'Live Stream'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {newsList.map((news) => {
              const sentimentClass = news.sentiment === 'POSITIVE'
                ? 'badge-positive'
                : news.sentiment === 'NEGATIVE'
                ? 'badge-negative'
                : 'badge-neutral';

              return (
                <div key={news.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>
                      {news.source} • {new Date(news.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={sentimentClass}>{news.sentiment}</span>
                  </div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.35, color: '#0f172a' }}>
                    {news.url && news.url !== '#' ? (
                      <a href={news.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        {news.title} <ExternalLink size={12} style={{ opacity: 0.7 }} />
                      </a>
                    ) : (
                      news.title
                    )}
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>{news.summary}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}

// ----------------------------------------------------------------------
// DASHBOARD V2 COMPONENTS
// ----------------------------------------------------------------------

function AllocationPanel({ sectorAllocation, isCrypto }: { sectorAllocation: SectorAllocation[]; isCrypto?: boolean }) {
  const totalSectors = sectorAllocation?.length || 0;
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b'];

  let gradientStr = 'conic-gradient(#e2e8f0 0% 100%)';
  if (totalSectors > 0) {
    let currentPct = 0;
    const parts: string[] = [];
    sectorAllocation.forEach((sec, idx) => {
      const color = COLORS[idx % COLORS.length];
      const start = currentPct;
      const end = currentPct + sec.percentage;
      currentPct = end;
      parts.push(`${color} ${start.toFixed(1)}% ${end.toFixed(1)}%`);
    });
    if (parts.length > 0) {
      gradientStr = `conic-gradient(${parts.join(', ')})`;
    }
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isCrypto ? 'CRYPTO ALLOCATION' : 'PORTFOLIO COMPOSITION'}
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
            {isCrypto ? 'Asset Distribution' : 'Sector Allocation'}
          </h3>
        </div>
        <Link href="/portfolio" style={{ fontSize: '0.8rem', color: isCrypto ? '#f59e0b' : '#4f46e5', textDecoration: 'none', fontWeight: 700 }}>
          Details →
        </Link>
      </div>

      {totalSectors === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          {isCrypto ? 'No active crypto positions recorded.' : 'No active positions recorded. Add holdings to view real sector distribution.'}
        </div>
      ) : (
        <div className="allocation-content" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div
            className="donut"
            style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: gradientStr,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '12px',
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
              }}
            />
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: '#0f172a', fontWeight: 800 }}>
                {totalSectors}
              </strong>
              <small style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>{isCrypto ? 'assets' : 'sectors'}</small>
            </div>
          </div>

          <div className="allocation-legend" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {sectorAllocation.map((sec, idx) => (
              <div key={sec.sector} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                <i
                  className="legend-dot"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: COLORS[idx % COLORS.length],
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#334155', fontWeight: 600 }}>{sec.sector}</span>
                <b style={{ marginLeft: 'auto', color: '#64748b', fontWeight: 700 }}>
                  {sec.percentage.toFixed(1)}%
                </b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiversificationPanel({ score, holdingsCount, isCrypto }: { score: number; holdingsCount: number; isCrypto?: boolean }) {
  let badgeLabel = 'Healthy';
  let badgeColor = '#059669';
  let badgeBg = '#ecfdf5';
  let badgeBorder = 'rgba(16, 185, 129, 0.3)';
  let description = isCrypto
    ? 'Crypto holdings are monitored against Bitcoin benchmark volatility.'
    : 'Well-balanced sector distribution across active holdings.';

  if (holdingsCount === 0) {
    badgeLabel = 'Unassigned';
    badgeColor = '#64748b';
    badgeBg = '#f1f5f9';
    badgeBorder = '#e2e8f0';
    description = isCrypto ? 'No crypto holdings recorded yet.' : 'No active holdings. Add stock positions to evaluate portfolio risk.';
  } else if (score <= 40) {
    badgeLabel = 'Concentrated';
    badgeColor = '#dc2626';
    badgeBg = '#fef2f2';
    badgeBorder = 'rgba(239, 68, 68, 0.3)';
    description = 'High concentration detected in single position. Consider diversifying.';
  } else if (score <= 70) {
    badgeLabel = 'Moderate';
    badgeColor = '#d97706';
    badgeBg = '#fffbeb';
    badgeBorder = 'rgba(245, 158, 11, 0.3)';
    description = 'Moderate asset weighting across active crypto positions.';
  }

  const clampedScore = holdingsCount === 0 ? 0 : Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = 157.08 - (157.08 * clampedScore) / 100;

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isCrypto ? 'CRYPTO RISK RADAR' : 'HERFINDAHL RISK LENS'}
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
            {isCrypto ? 'Concentration & Risk' : 'Diversification Score'}
          </h3>
        </div>
        <span
          style={{
            background: badgeBg,
            color: badgeColor,
            border: `1px solid ${badgeBorder}`,
            padding: '0.25rem 0.65rem',
            borderRadius: '16px',
            fontSize: '0.78rem',
            fontWeight: 700,
          }}
        >
          {badgeLabel}
        </span>
      </div>

      <div style={{ position: 'relative', width: '160px', height: '90px', margin: '0.5rem auto 0 auto', display: 'flex', justifyContent: 'center' }}>
        <svg width="160" height="90" viewBox="0 0 120 70">
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={badgeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="157.08"
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', bottom: '5px', textAlign: 'center' }}>
          <strong style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1 }}>
            {clampedScore}
          </strong>
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>/ 100</span>
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'center', lineHeight: 1.45, margin: 0 }}>
        {description}
      </p>

      <div style={{ textAlign: 'center' }}>
        <Link href="/portfolio" style={{ fontSize: '0.8rem', color: isCrypto ? '#f59e0b' : '#4f46e5', textDecoration: 'none', fontWeight: 700 }}>
          Explore Risk Factors →
        </Link>
      </div>
    </div>
  );
}

function HoldingsPreview({
  stockHoldings,
  cryptoHoldings,
  totalValue,
  isCrypto,
}: {
  stockHoldings: PortfolioHolding[];
  cryptoHoldings: CryptoHolding[];
  totalValue: number;
  isCrypto?: boolean;
}) {
  if (isCrypto) {
    const topCrypto = cryptoHoldings.slice(0, 4);
    return (
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              CRYPTO ASSETS
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
              Top Holdings ({cryptoHoldings.length})
            </h3>
          </div>
          <Link href="/portfolio" style={{ fontSize: '0.8rem', color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
            View Portfolio →
          </Link>
        </div>

        {topCrypto.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No crypto positions recorded yet.
          </div>
        ) : (
          <div className="compact-table" style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              className="table-head"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr',
                gap: '0.75rem',
                paddingBottom: '0.6rem',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
              }}
            >
              <span>Asset</span>
              <span style={{ textAlign: 'right' }}>Value</span>
              <span style={{ textAlign: 'right' }}>Return</span>
              <span style={{ textAlign: 'right' }}>Alloc.</span>
            </div>

            {topCrypto.map((h) => {
              const isProfitable = h.totalReturn >= 0;
              const allocationPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
              const sym = h.cryptoAsset?.symbol || 'CRYPTO';

              return (
                <Link
                  key={h.id}
                  href={`/crypto/${sym}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    className="table-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr',
                      gap: '0.75rem',
                      alignItems: 'center',
                      padding: '0.75rem 0',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '0.85rem',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <span
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: '#fffbeb',
                          color: '#b45309',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {sym.slice(0, 2)}
                      </span>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.85rem', fontWeight: 700 }}>
                          {sym}
                        </strong>
                      </div>
                    </div>

                    <span style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {formatCurrency(h.currentValue)}
                    </span>

                    <span
                      style={{ textAlign: 'right', fontWeight: 700, color: isProfitable ? '#059669' : '#dc2626' }}
                    >
                      {isProfitable ? '+' : ''}{formatPercent(h.totalReturnPercent)}
                    </span>

                    <span style={{ textAlign: 'right', color: '#64748b', fontWeight: 600 }}>
                      {allocationPct.toFixed(1)}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const topHoldings = stockHoldings.slice(0, 4);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            YOUR POSITIONS
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
            Top Holdings ({stockHoldings.length})
          </h3>
        </div>
        <Link href="/portfolio" style={{ fontSize: '0.8rem', color: '#4f46e5', textDecoration: 'none', fontWeight: 700 }}>
          View Portfolio →
        </Link>
      </div>

      {topHoldings.length === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          No active positions in your portfolio yet.
        </div>
      ) : (
        <div className="compact-table" style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            className="table-head"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr',
              gap: '0.75rem',
              paddingBottom: '0.6rem',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: '#64748b',
              textTransform: 'uppercase',
            }}
          >
            <span>Asset</span>
            <span style={{ textAlign: 'right' }}>Value</span>
            <span style={{ textAlign: 'right' }}>Return</span>
            <span style={{ textAlign: 'right' }}>Alloc.</span>
          </div>

          {topHoldings.map((h) => {
            const isProfitable = h.totalReturn >= 0;
            const allocationPct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;

            return (
              <Link
                key={h.id}
                href={`/stock/${h.stock.symbol}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="table-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: '0.85rem',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <span
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: '#eef2ff',
                        color: '#4338ca',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {h.stock.symbol.slice(0, 1)}
                    </span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.85rem', fontWeight: 700 }}>
                        {h.stock.symbol}
                      </strong>
                    </div>
                  </div>

                  <span style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                    {formatCurrency(h.currentValue)}
                  </span>

                  <span
                    style={{ textAlign: 'right', fontWeight: 700, color: isProfitable ? '#059669' : '#dc2626' }}
                  >
                    {isProfitable ? '+' : ''}{formatPercent(h.totalReturnPercent)}
                  </span>

                  <span style={{ textAlign: 'right', color: '#64748b', fontWeight: 600 }}>
                    {allocationPct.toFixed(1)}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
