'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  PieChart,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Sparkles,
  DollarSign,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import { Portfolio, PortfolioAnalysis, CryptoPortfolio, CryptoHolding } from '@finpilot/shared-types';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { useAssetClass } from '../../context/asset-class-context';
import AssetClassToggle from '../../components/AssetClassToggle';
import IndiaCryptoTaxDisclaimer from '../../components/IndiaCryptoTaxDisclaimer';
import { getPortfolioApi, getPortfolioAnalysisApi, createTransactionApi } from '../../lib/portfolio';
import { getCryptoPortfolioApi, createCryptoTransactionApi } from '../../lib/crypto';

export default function PortfolioPage() {
  const { user, accessToken, loading: authLoading, isReady } = useRequireAuth();
  const { isCrypto } = useAssetClass();

  // Stock Portfolio State
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);

  // Crypto Portfolio State
  const [cryptoPortfolio, setCryptoPortfolio] = useState<CryptoPortfolio | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Transaction form state
  const [showModal, setShowModal] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPortfolioData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    if (isCrypto) {
      try {
        const cPort = await getCryptoPortfolioApi(accessToken);
        setCryptoPortfolio(cPort);
      } catch (err: any) {
        setError(err.message || 'Failed to load crypto portfolio data');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const [port, ana] = await Promise.all([
          getPortfolioApi(accessToken),
          getPortfolioAnalysisApi(accessToken),
        ]);
        setPortfolio(port);
        setAnalysis(ana);
      } catch (err: any) {
        setError(err.message || 'Failed to load stock portfolio data');
      } finally {
        setLoading(false);
      }
    }
  }, [accessToken, isCrypto]);

  useEffect(() => {
    if (isReady && accessToken) {
      fetchPortfolioData();
    }
  }, [isReady, accessToken, fetchPortfolioData]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setFormError(null);

    const qtyNum = parseFloat(quantity);
    const priceNum = parseFloat(price);

    if (!symbol.trim()) {
      setFormError(isCrypto ? 'Symbol is required (e.g. BTC, ETH, SOL)' : 'Symbol is required (e.g. TCS.NS, INFY.NS)');
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setFormError('Quantity must be greater than 0');
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Price must be greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      if (isCrypto) {
        await createCryptoTransactionApi(
          {
            symbol: symbol.trim().toUpperCase(),
            type,
            quantity: qtyNum,
            price: priceNum,
          },
          accessToken,
        );
      } else {
        await createTransactionApi(
          {
            symbol: symbol.trim().toUpperCase(),
            type,
            quantity: qtyNum,
            price: priceNum,
          },
          accessToken,
        );
      }

      // Reset form & close modal
      setSymbol('');
      setQuantity('');
      setPrice('');
      setShowModal(false);

      // Refresh portfolio
      await fetchPortfolioData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to execute transaction');
    } finally {
      setSubmitting(false);
    }
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
            Verifying security credentials...
          </p>
        </div>
      </div>
    );
  }

  // Stock Portfolio Derived
  const stockHoldings = portfolio?.holdings || [];

  // Crypto Portfolio Derived
  const cryptoHoldings = cryptoPortfolio?.holdings || [];
  const cryptoTotalValue = cryptoPortfolio?.totalValue || 0;
  const cryptoTotalInvestment = cryptoHoldings.reduce(
    (sum, h) => sum + (h.quantity * (h.avgBuyPrice || 0)),
    0,
  );
  const cryptoTotalProfit = cryptoTotalValue - cryptoTotalInvestment;
  const cryptoTotalProfitPercent =
    cryptoTotalInvestment > 0 ? (cryptoTotalProfit / cryptoTotalInvestment) * 100 : 0;

  // Crypto Allocation
  const cryptoAllocations = cryptoHoldings.map((h) => ({
    symbol: h.cryptoAsset?.symbol || 'CR',
    name: h.cryptoAsset?.name || 'Asset',
    value: h.currentValue,
    percentage: cryptoTotalValue > 0 ? (h.currentValue / cryptoTotalValue) * 100 : 0,
  }));

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

      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.75rem 2rem', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
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
            {isCrypto ? <Coins size={14} /> : <Briefcase size={14} />}
            {isCrypto ? 'ISOLATED CRYPTO PORTFOLIO' : 'ACTIVE STOCK PORTFOLIO'}
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
            {isCrypto ? 'My Cryptocurrency Portfolio' : 'My Stock Portfolio'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            {isCrypto
              ? 'Real-time CoinDCX cryptocurrency portfolio valuation, transaction tracking, and 24/7 exposure analytics.'
              : 'Real-time portfolio valuation, trade transaction execution, and Herfindahl sector diversification analytics.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={fetchPortfolioData}
            className="btn-secondary"
            disabled={loading}
            style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link
            href={
              isCrypto
                ? '/assistant?q=Analyze the risk and 24h momentum of my crypto portfolio'
                : '/assistant?q=Analyze my portfolio allocation and risk'
            }
            style={{ textDecoration: 'none' }}
          >
            <button
              className="btn-secondary"
              style={{
                padding: '0.65rem 1.1rem',
                fontSize: '0.85rem',
                color: isCrypto ? '#b45309' : '#4338ca',
                fontWeight: 700,
              }}
            >
              <Sparkles size={15} color={isCrypto ? '#f59e0b' : '#4f46e5'} />
              Ask AI Review
            </button>
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.85rem',
              background: isCrypto ? '#f59e0b' : undefined,
            }}
          >
            <PlusCircle size={16} />
            Record Transaction
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem 1rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      {isCrypto ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {/* Metric 1: Total Investment */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <span>TOTAL CRYPTO INVESTED</span>
              <DollarSign size={16} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
              {formatCurrency(cryptoTotalInvestment)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
              {cryptoHoldings.length} Active Positions
            </div>
          </div>

          {/* Metric 2: Live Portfolio Value */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <span>CURRENT CRYPTO VALUE</span>
              <PieChart size={16} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
              {formatCurrency(cryptoTotalValue)}
            </div>
            <div style={{ fontSize: '0.78rem', color: (cryptoPortfolio?.dayChange || 0) >= 0 ? '#059669' : '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>
              {(cryptoPortfolio?.dayChange || 0) >= 0 ? '+' : ''}{formatCurrency(cryptoPortfolio?.dayChange || 0)} 24h ({formatPercent(cryptoPortfolio?.dayChangePercent || 0)})
            </div>
          </div>

          {/* Metric 3: Total Profit / Loss */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <span>TOTAL RETURN (P&L)</span>
              {cryptoTotalProfit >= 0 ? <TrendingUp size={16} color="#059669" /> : <TrendingDown size={16} color="#dc2626" />}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: cryptoTotalProfit >= 0 ? '#059669' : '#dc2626' }}>
              {cryptoTotalProfit >= 0 ? '+' : ''}{formatCurrency(cryptoTotalProfit)}
            </div>
            <div style={{ display: 'inline-flex', marginTop: '0.3rem' }}>
              <span className={cryptoTotalProfit >= 0 ? 'badge-positive' : 'badge-negative'} style={{ fontSize: '0.75rem' }}>
                {cryptoTotalProfit >= 0 ? '+' : ''}{formatPercent(cryptoTotalProfitPercent)} All Time
              </span>
            </div>
          </div>

          {/* Metric 4: Volatility Warning */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <span>MARKET TRADING REGIME</span>
              <ShieldAlert size={16} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
              24/7 High Volatility
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
              Recalibrated to 365-day annualization
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {/* Metric 1: Total Investment */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <span>TOTAL INVESTMENT</span>
              <DollarSign size={16} color="#4f46e5" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
              {formatCurrency(analysis?.totalInvestment || 0)}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
              {stockHoldings.length} Active Positions Recorded
            </div>
          </div>

          {/* Metric 2: Live Portfolio Value */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <span>CURRENT VALUE</span>
              <PieChart size={16} color="#7c3aed" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#0f172a' }}>
              {formatCurrency(analysis?.currentValue || 0)}
            </div>
            <div style={{ fontSize: '0.78rem', color: (portfolio?.dayChange || 0) >= 0 ? '#059669' : '#dc2626', marginTop: '0.3rem', fontWeight: 600 }}>
              {(portfolio?.dayChange || 0) >= 0 ? '+' : ''}{formatCurrency(portfolio?.dayChange || 0)} Today ({formatPercent(portfolio?.dayChangePercent || 0)})
            </div>
          </div>

          {/* Metric 3: Total Profit / Loss */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <span>TOTAL RETURN (P&L)</span>
              {(analysis?.totalProfit || 0) >= 0 ? <TrendingUp size={16} color="#059669" /> : <TrendingDown size={16} color="#dc2626" />}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: (analysis?.totalProfit || 0) >= 0 ? '#059669' : '#dc2626' }}>
              {(analysis?.totalProfit || 0) >= 0 ? '+' : ''}{formatCurrency(analysis?.totalProfit || 0)}
            </div>
            <div style={{ display: 'inline-flex', marginTop: '0.3rem' }}>
              <span className={(analysis?.totalProfit || 0) >= 0 ? 'badge-positive' : 'badge-negative'} style={{ fontSize: '0.75rem' }}>
                {(analysis?.totalProfit || 0) >= 0 ? '+' : ''}{formatPercent(analysis?.totalProfitPercent || 0)} All Time
              </span>
            </div>
          </div>

          {/* Metric 4: Diversification Score Card */}
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em' }}>
              <span>DIVERSIFICATION SCORE</span>
              <ShieldCheck size={16} color="#4f46e5" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.4rem', color: '#4f46e5' }}>
              {analysis?.diversificationScore || 0} <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>/ 100</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
              {(analysis?.diversificationScore || 0) > 70 ? 'Well Diversified Portfolio' : (analysis?.diversificationScore || 0) > 40 ? 'Moderate Sector Exposure' : 'High Single-Sector Exposure'}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Holdings Table + Asset Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '1.5rem' }}>

        {/* Holdings Table Card */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isCrypto ? <Coins size={18} color="#f59e0b" /> : <Briefcase size={18} color="#4f46e5" />}
            {isCrypto ? `Current Crypto Holdings (${cryptoHoldings.length})` : `Current Holdings (${stockHoldings.length})`}
          </h2>

          {isCrypto ? (
            cryptoHoldings.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <p style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>No cryptocurrency holdings recorded in your portfolio yet.</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="btn-primary"
                  style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', background: '#f59e0b' }}
                >
                  Record Your First Crypto Trade
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Coin / Asset</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Category</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Avg Buy (₹)</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Live Price (₹)</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Current Value</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cryptoHoldings.map((h) => {
                      const isProfitable = h.totalReturn >= 0;
                      const sym = h.cryptoAsset?.symbol || 'CR';
                      return (
                        <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                          <td style={{ padding: '0.85rem 0.5rem' }}>
                            <Link href={`/crypto/${sym}`} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 800 }}>
                              {sym}
                            </Link>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{h.cryptoAsset?.name}</div>
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', color: '#64748b' }}>{h.cryptoAsset?.category || 'Layer 1'}</td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {h.quantity < 1 ? h.quantity.toFixed(4) : h.quantity.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', color: '#64748b' }}>{formatCurrency(h.avgBuyPrice)}</td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {formatCurrency(h.cryptoAsset?.currentPrice || h.avgBuyPrice)}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {formatCurrency(h.currentValue)}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                            <div style={{ color: isProfitable ? '#059669' : '#dc2626', fontWeight: 800 }}>
                              {isProfitable ? '+' : ''}{formatCurrency(h.totalReturn)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: isProfitable ? '#059669' : '#dc2626', fontWeight: 700 }}>
                              {isProfitable ? '+' : ''}{formatPercent(h.totalReturnPercent)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            stockHoldings.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <p style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>No stock holdings recorded in your portfolio yet.</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="btn-primary"
                  style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                >
                  Record Your First Trade
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Symbol / Company</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Sector</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Avg Price</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Live Price</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Current Value</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockHoldings.map((h) => {
                      const isProfitable = h.totalReturn >= 0;
                      return (
                        <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                          <td style={{ padding: '0.85rem 0.5rem' }}>
                            <Link href={`/stock/${h.stock.symbol}`} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 800 }}>
                              {h.stock.symbol}
                            </Link>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{h.stock.name}</div>
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', color: '#64748b' }}>{h.stock.sector}</td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{h.quantity}</td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', color: '#64748b' }}>{formatCurrency(h.avgBuyPrice)}</td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {formatCurrency(h.stock.currentPrice || h.avgBuyPrice)}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {formatCurrency(h.currentValue)}
                          </td>
                          <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                            <div style={{ color: isProfitable ? '#059669' : '#dc2626', fontWeight: 800 }}>
                              {isProfitable ? '+' : ''}{formatCurrency(h.totalReturn)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: isProfitable ? '#059669' : '#dc2626', fontWeight: 700 }}>
                              {isProfitable ? '+' : ''}{formatPercent(h.totalReturnPercent)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Asset / Sector Allocation Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={18} color={isCrypto ? '#f59e0b' : '#4f46e5'} />
            {isCrypto ? 'Crypto Asset Weighting' : 'Real Sector Allocation'}
          </h2>

          {isCrypto ? (
            cryptoAllocations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cryptoAllocations.map((item) => (
                  <div key={item.symbol}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.symbol}</span>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>{formatPercent(item.percentage)} ({formatCurrency(item.value)})</span>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(item.percentage, 100)}%`,
                          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center', padding: '2rem 0' }}>
                Record buy transactions to view crypto asset distribution.
              </div>
            )
          ) : (
            analysis?.sectorAllocation && analysis.sectorAllocation.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {analysis.sectorAllocation.map((sec) => (
                  <div key={sec.sector}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{sec.sector}</span>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>{formatPercent(sec.percentage)} ({formatCurrency(sec.value)})</span>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(sec.percentage, 100)}%`,
                          background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center', padding: '2rem 0' }}>
                Record buy transactions to view real sector diversification breakdown.
              </div>
            )
          )}
        </div>

      </div>

      {/* Record Transaction Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', color: '#0f172a' }}>
              {isCrypto ? 'Record Crypto Trade' : 'Record Stock Trade'}
            </h2>

            {formError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  {isCrypto ? 'Crypto Symbol' : 'Stock Symbol'}
                </label>
                <input
                  type="text"
                  placeholder={isCrypto ? 'e.g. BTC, ETH, SOL, XRP' : 'e.g. TCS.NS, INFY.NS, RELIANCE.NS'}
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: '0.92rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Transaction Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setType('BUY')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: type === 'BUY' ? '2px solid #059669' : '1px solid #e2e8f0',
                      background: type === 'BUY' ? '#ecfdf5' : '#ffffff',
                      color: type === 'BUY' ? '#059669' : '#64748b',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('SELL')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: type === 'SELL' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                      background: type === 'SELL' ? '#fef2f2' : '#ffffff',
                      color: type === 'SELL' ? '#dc2626' : '#64748b',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={isCrypto ? '0.05' : '10'}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: '0.92rem', fontWeight: 600, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Price per Unit (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={isCrypto ? '5845000' : '3890.00'}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: '0.92rem', fontWeight: 600, outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.1rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{
                    padding: '0.6rem 1.3rem',
                    fontSize: '0.85rem',
                    background: isCrypto ? '#f59e0b' : undefined,
                  }}
                >
                  {submitting ? 'Executing...' : 'Submit Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
