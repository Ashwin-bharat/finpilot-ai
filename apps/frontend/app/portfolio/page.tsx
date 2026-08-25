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
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import { Portfolio, PortfolioAnalysis } from '@finpilot/shared-types';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { getPortfolioApi, getPortfolioAnalysisApi, createTransactionApi } from '../../lib/portfolio';

export default function PortfolioPage() {
  const { user, accessToken, loading: authLoading, isReady } = useRequireAuth();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
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

    try {
      const [port, ana] = await Promise.all([
        getPortfolioApi(accessToken),
        getPortfolioAnalysisApi(accessToken),
      ]);
      setPortfolio(port);
      setAnalysis(ana);
    } catch (err: any) {
      setError(err.message || 'Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

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
      setFormError('Symbol is required (e.g. TCS.NS, INFY.NS)');
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
      await createTransactionApi(
        {
          symbol: symbol.trim().toUpperCase(),
          type,
          quantity: qtyNum,
          price: priceNum,
        },
        accessToken,
      );

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

  const holdings = portfolio?.holdings || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(139, 92, 246, 0.2)', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', color: '#c4b5fd', fontWeight: 600, marginBottom: '0.75rem' }}>
            <Briefcase size={14} /> ACTIVE PORTFOLIO TRACKING
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>My Portfolio</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Real-time valuation, transaction execution, and sector diversification analytics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={fetchPortfolioData}
            className="btn-secondary"
            disabled={loading}
            style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={15} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link href="/assistant?q=Analyze my portfolio allocation and risk" style={{ textDecoration: 'none' }}>
            <button
              className="btn-secondary"
              style={{ padding: '0.8rem 1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#c7d2fe' }}
            >
              <Sparkles size={16} color="#818cf8" />
              Ask AI Review
            </button>
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
            style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PlusCircle size={18} />
            Record Transaction
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '1rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Investment</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {formatCurrency(analysis?.totalInvestment || 0)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
            {holdings.length} Active Positions
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Current Value (Live)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {formatCurrency(analysis?.currentValue || 0)}
          </div>
          <div style={{ fontSize: '0.8rem', color: (portfolio?.dayChange || 0) >= 0 ? '#10b981' : '#ef4444', marginTop: '0.25rem' }}>
            {(portfolio?.dayChange || 0) >= 0 ? '+' : ''}{formatCurrency(portfolio?.dayChange || 0)} Today ({formatPercent(portfolio?.dayChangePercent || 0)})
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Return / P&L</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem', color: (analysis?.totalProfit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
            {(analysis?.totalProfit || 0) >= 0 ? '+' : ''}{formatCurrency(analysis?.totalProfit || 0)}
          </div>
          <div style={{ fontSize: '0.8rem', color: (analysis?.totalProfit || 0) >= 0 ? '#10b981' : '#ef4444', marginTop: '0.25rem' }}>
            {(analysis?.totalProfit || 0) >= 0 ? '+' : ''}{formatPercent(analysis?.totalProfitPercent || 0)} All Time
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={16} color="#8b5cf6" /> Diversification Score
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.35rem', color: '#a78bfa' }}>
            {analysis?.diversificationScore || 0} / 100
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
            {(analysis?.diversificationScore || 0) > 70 ? 'Well Diversified' : (analysis?.diversificationScore || 0) > 40 ? 'Moderately Concentrated' : 'Highly Concentrated'}
          </div>
        </div>
      </div>

      {/* Main Content: Holdings Table + Sector Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '1.5rem' }}>

        {/* Holdings Table */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={20} color="#8b5cf6" /> Current Holdings ({holdings.length})
          </h2>

          {holdings.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1rem' }}>No stock holdings in this portfolio yet.</p>
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                Record Your First Buy
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Symbol / Name</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Sector</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Shares</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Avg Price</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Live Price</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Current Value</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Return</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const isProfitable = h.totalReturn >= 0;
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <Link href={`/stock/${h.stock.symbol}`} style={{ color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                            {h.stock.symbol}
                          </Link>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{h.stock.name}</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-muted)' }}>{h.stock.sector}</td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{h.quantity}</td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>{formatCurrency(h.avgBuyPrice)}</td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(h.stock.currentPrice || h.avgBuyPrice)}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(h.currentValue)}
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                          <div style={{ color: isProfitable ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {isProfitable ? '+' : ''}{formatCurrency(h.totalReturn)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: isProfitable ? '#10b981' : '#ef4444' }}>
                            {isProfitable ? '+' : ''}{formatPercent(h.totalReturnPercent)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sector Allocation Breakdown */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={20} color="#8b5cf6" /> Sector Allocation
          </h2>

          {analysis?.sectorAllocation && analysis.sectorAllocation.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {analysis.sectorAllocation.map((sec) => (
                <div key={sec.sector}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 600 }}>{sec.sector}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatPercent(sec.percentage)} ({formatCurrency(sec.value)})</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(sec.percentage, 100)}%`,
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
              Add positions to view sector diversification breakdown.
            </div>
          )}
        </div>

      </div>

      {/* Record Transaction Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>Record Trade / Transaction</h2>

            {formError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', padding: '0.75rem', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Stock Symbol
                </label>
                <input
                  type="text"
                  placeholder="e.g. TCS.NS, INFY.NS, RELIANCE.NS"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#1f2937', border: '1px solid #374151', color: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Transaction Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setType('BUY')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: type === 'BUY' ? '2px solid #10b981' : '1px solid #374151',
                      background: type === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : '#1f2937',
                      color: type === 'BUY' ? '#10b981' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('SELL')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '6px',
                      border: type === 'SELL' ? '2px solid #ef4444' : '1px solid #374151',
                      background: type === 'SELL' ? 'rgba(239, 68, 68, 0.2)' : '#1f2937',
                      color: type === 'SELL' ? '#ef4444' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    SELL
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="10"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#1f2937', border: '1px solid #374151', color: 'white' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Price per Share (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="3890.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#1f2937', border: '1px solid #374151', color: 'white' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 1.2rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{ padding: '0.65rem 1.4rem' }}
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
