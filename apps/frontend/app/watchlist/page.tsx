'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  PlusCircle,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import { Watchlist } from '@finpilot/shared-types';
import { useRequireAuth } from '../../hooks/use-require-auth';
import {
  getWatchlistsApi,
  createWatchlistApi,
  addWatchlistItemApi,
  removeWatchlistItemApi,
} from '../../lib/watchlist';

export default function WatchlistPage() {
  const { user, accessToken, loading: authLoading, isReady } = useRequireAuth();

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add stock state
  const [newSymbol, setNewSymbol] = useState('');
  const [addingStock, setAddingStock] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Create watchlist state
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  const fetchWatchlists = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const data = await getWatchlistsApi(accessToken);
      setWatchlists(data);
      if (data.length > 0 && !activeWatchlistId) {
        setActiveWatchlistId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeWatchlistId]);

  useEffect(() => {
    if (isReady && accessToken) {
      fetchWatchlists();
    }
  }, [isReady, accessToken, fetchWatchlists]);

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId) || watchlists[0];

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !activeWatchlist) return;
    if (!newSymbol.trim()) return;

    setAddError(null);
    setAddingStock(true);

    try {
      await addWatchlistItemApi(
        activeWatchlist.id,
        { symbol: newSymbol.trim().toUpperCase() },
        accessToken,
      );
      setNewSymbol('');
      await fetchWatchlists();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add stock');
    } finally {
      setAddingStock(false);
    }
  };

  const handleRemoveStock = async (stockId: string) => {
    if (!accessToken || !activeWatchlist) return;

    try {
      await removeWatchlistItemApi(activeWatchlist.id, stockId, accessToken);
      await fetchWatchlists();
    } catch (err: any) {
      setError(err.message || 'Failed to remove stock');
    }
  };

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newListName.trim()) return;

    setCreatingList(true);
    try {
      const created = await createWatchlistApi({ name: newListName.trim() }, accessToken);
      setNewListName('');
      setShowNewListModal(false);
      await fetchWatchlists();
      setActiveWatchlistId(created.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create watchlist');
    } finally {
      setCreatingList(false);
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

  const items = activeWatchlist?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(139, 92, 246, 0.2)', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', color: '#c4b5fd', fontWeight: 600, marginBottom: '0.75rem' }}>
            <Bookmark size={14} /> LIVE PRICE WATCHLISTS
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Watchlists</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Monitor real-time ticker prices, daily percentage changes, and industry trends.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={fetchWatchlists}
            className="btn-secondary"
            disabled={loading}
            style={{ padding: '0.8rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={15} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowNewListModal(true)}
            className="btn-primary"
            style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PlusCircle size={18} />
            New Watchlist
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '1rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Watchlist Tabs */}
      {watchlists.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          {watchlists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setActiveWatchlistId(wl.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: activeWatchlistId === wl.id ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent',
                background: activeWatchlistId === wl.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                color: activeWatchlistId === wl.id ? 'white' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              {wl.name} ({wl.items?.length || 0})
            </button>
          ))}
        </div>
      )}

      {/* Add Stock Bar & Table */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Inline Add Stock Form */}
        <form onSubmit={handleAddStock} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Enter stock ticker symbol (e.g. TCS.NS, RELIANCE.NS, INFY.NS)..."
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            style={{
              flex: 1,
              padding: '0.7rem 1rem',
              borderRadius: '8px',
              background: '#1f2937',
              border: '1px solid #374151',
              color: 'white',
              fontSize: '0.9rem',
            }}
          />
          <button
            type="submit"
            disabled={addingStock || !newSymbol.trim()}
            className="btn-primary"
            style={{ padding: '0.7rem 1.4rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={16} />
            {addingStock ? 'Adding...' : 'Add Stock'}
          </button>
        </form>

        {addError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', padding: '0.6rem 0.85rem', color: '#f87171', fontSize: '0.85rem' }}>
            {addError}
          </div>
        )}

        {/* Watchlist Table */}
        {items.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Your watchlist is currently empty.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>Type a symbol like <code>TCS.NS</code> or <code>RELIANCE.NS</code> above to start tracking.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Symbol</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Company</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Sector</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Live Price</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Daily Change</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isPositive = (item.stock.change || 0) >= 0;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '0.85rem 0.5rem' }}>
                        <Link href={`/stock/${item.stock.symbol}`} style={{ color: 'white', textDecoration: 'none', fontWeight: 700 }}>
                          {item.stock.symbol}
                        </Link>
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-muted)' }}>{item.stock.name}</td>
                      <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-subtle)' }}>{item.stock.sector}</td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(item.stock.currentPrice || 0)}
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                        <span className={isPositive ? 'badge-positive' : 'badge-negative'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          {isPositive ? '+' : ''}{formatCurrency(item.stock.change || 0)} ({formatPercent(item.stock.changePercent || 0)})
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleRemoveStock(item.stock.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            padding: '0.35rem',
                          }}
                          title="Remove from watchlist"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Watchlist Modal */}
      {showNewListModal && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>Create New Watchlist</h2>
            <form onSubmit={handleCreateWatchlist} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Watchlist Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dividend Bluechips, Green Energy"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#1f2937', border: '1px solid #374151', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowNewListModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 1.2rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingList || !newListName.trim()}
                  className="btn-primary"
                  style={{ padding: '0.65rem 1.4rem' }}
                >
                  {creatingList ? 'Creating...' : 'Create Watchlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
