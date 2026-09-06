'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  PlusCircle,
  Trash2,
  RefreshCw,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Coins,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@finpilot/shared-utils';
import { Watchlist, CryptoWatchlist } from '@finpilot/shared-types';
import { useRequireAuth } from '../../hooks/use-require-auth';
import { useAssetClass } from '../../context/asset-class-context';
import AssetClassToggle from '../../components/AssetClassToggle';
import IndiaCryptoTaxDisclaimer from '../../components/IndiaCryptoTaxDisclaimer';
import {
  getWatchlistsApi,
  createWatchlistApi,
  addWatchlistItemApi,
  removeWatchlistItemApi,
} from '../../lib/watchlist';
import {
  getCryptoWatchlistsApi,
  addCryptoWatchlistItemApi,
  removeCryptoWatchlistItemApi,
} from '../../lib/crypto';

export default function WatchlistPage() {
  const { user, accessToken, loading: authLoading, isReady } = useRequireAuth();
  const { isCrypto } = useAssetClass();

  // Stocks Watchlists State
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('');

  // Crypto Watchlists State
  const [cryptoWatchlists, setCryptoWatchlists] = useState<CryptoWatchlist[]>([]);
  const [activeCryptoWatchlistId, setActiveCryptoWatchlistId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add symbol state
  const [newSymbol, setNewSymbol] = useState('');
  const [addingSymbol, setAddingSymbol] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Create watchlist modal state (Stocks)
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  const fetchWatchlists = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    if (isCrypto) {
      try {
        const data = await getCryptoWatchlistsApi(accessToken);
        setCryptoWatchlists(data);
        if (data.length > 0 && !activeCryptoWatchlistId) {
          setActiveCryptoWatchlistId(data[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load crypto watchlists');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const data = await getWatchlistsApi(accessToken);
        setWatchlists(data);
        if (data.length > 0 && !activeWatchlistId) {
          setActiveWatchlistId(data[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load stock watchlists');
      } finally {
        setLoading(false);
      }
    }
  }, [accessToken, isCrypto, activeWatchlistId, activeCryptoWatchlistId]);

  useEffect(() => {
    if (isReady && accessToken) {
      fetchWatchlists();
    }
  }, [isReady, accessToken, fetchWatchlists]);

  // Reset input and error on tab switch
  useEffect(() => {
    setNewSymbol('');
    setAddError(null);
  }, [isCrypto]);

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId) || watchlists[0];
  const activeCryptoWatchlist =
    cryptoWatchlists.find((w) => w.id === activeCryptoWatchlistId) || cryptoWatchlists[0];

  const handleAddSymbol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!newSymbol.trim()) return;

    setAddError(null);
    setAddingSymbol(true);

    if (isCrypto) {
      if (!activeCryptoWatchlist) {
        setAddError('No active crypto watchlist found.');
        setAddingSymbol(false);
        return;
      }
      try {
        await addCryptoWatchlistItemApi(
          activeCryptoWatchlist.id,
          newSymbol.trim().toUpperCase(),
          accessToken,
        );
        setNewSymbol('');
        await fetchWatchlists();
      } catch (err: any) {
        setAddError(err.message || 'Failed to add crypto asset');
      } finally {
        setAddingSymbol(false);
      }
    } else {
      if (!activeWatchlist) {
        setAddError('No active stock watchlist found.');
        setAddingSymbol(false);
        return;
      }
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
        setAddingSymbol(false);
      }
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

  const handleRemoveCrypto = async (cryptoAssetId: string) => {
    if (!accessToken || !activeCryptoWatchlist) return;
    try {
      await removeCryptoWatchlistItemApi(activeCryptoWatchlist.id, cryptoAssetId, accessToken);
      await fetchWatchlists();
    } catch (err: any) {
      setError(err.message || 'Failed to remove crypto asset');
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

  const stockItems = activeWatchlist?.items || [];
  const cryptoItems = activeCryptoWatchlist?.items || [];

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
            {isCrypto ? <Coins size={14} /> : <Bookmark size={14} />}
            {isCrypto ? '24/7 CRYPTO WATCHLIST RADAR' : 'REAL-TIME WATCHLIST MONITOR'}
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
            {isCrypto ? 'Crypto Watchlists' : 'Active Stock Watchlists'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            {isCrypto
              ? 'Track 24/7 live CoinDCX cryptocurrency quotes, prices in INR, and 24-hour price action.'
              : 'Track real-time stock quotes, price performance, daily percentage shifts, and sector details.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={fetchWatchlists}
            className="btn-secondary"
            disabled={loading}
            style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {!isCrypto && (
            <button
              onClick={() => setShowNewListModal(true)}
              className="btn-primary"
              style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
            >
              <PlusCircle size={16} />
              New Watchlist
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem 1rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Watchlist Selection Tabs */}
      {!isCrypto && watchlists.length > 0 && (
        <div style={{ display: 'flex', gap: '0.6rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', overflowX: 'auto' }}>
          {watchlists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setActiveWatchlistId(wl.id)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: activeWatchlistId === wl.id ? '1px solid rgba(79, 70, 229, 0.35)' : '1px solid #e2e8f0',
                background: activeWatchlistId === wl.id ? '#eef2ff' : '#ffffff',
                color: activeWatchlistId === wl.id ? '#4338ca' : '#64748b',
                fontWeight: activeWatchlistId === wl.id ? 700 : 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: activeWatchlistId === wl.id ? '0 1px 3px rgba(79, 70, 229, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.15s ease',
              }}
            >
              {wl.name} ({wl.items?.length || 0})
            </button>
          ))}
        </div>
      )}

      {isCrypto && cryptoWatchlists.length > 0 && (
        <div style={{ display: 'flex', gap: '0.6rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', overflowX: 'auto' }}>
          {cryptoWatchlists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setActiveCryptoWatchlistId(wl.id)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: activeCryptoWatchlistId === wl.id ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #e2e8f0',
                background: activeCryptoWatchlistId === wl.id ? '#fffbeb' : '#ffffff',
                color: activeCryptoWatchlistId === wl.id ? '#b45309' : '#64748b',
                fontWeight: activeCryptoWatchlistId === wl.id ? 700 : 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: activeCryptoWatchlistId === wl.id ? '0 1px 3px rgba(245, 158, 11, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.15s ease',
              }}
            >
              {wl.name} ({wl.items?.length || 0})
            </button>
          ))}
        </div>
      )}

      {/* Add Symbol Search & Card Grid Container */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Inline Add Symbol Form */}
        <form onSubmit={handleAddSymbol} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder={
              isCrypto
                ? 'Enter cryptocurrency symbol (e.g. BTC, ETH, SOL, XRP, DOGE)...'
                : 'Enter Indian stock symbol (e.g. TATAMOTORS.NS, INFY.NS, RELIANCE.NS)...'
            }
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            style={{
              flex: 1,
              minWidth: '240px',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
              fontSize: '0.88rem',
              fontWeight: 500,
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            }}
          />
          <button
            type="submit"
            disabled={addingSymbol || !newSymbol.trim()}
            className="btn-primary"
            style={{
              padding: '0.65rem 1.3rem',
              fontSize: '0.85rem',
              whiteSpace: 'nowrap',
              background: isCrypto ? '#f59e0b' : undefined,
            }}
          >
            <Plus size={16} />
            {addingSymbol ? 'Adding...' : 'Add Symbol'}
          </button>
        </form>

        {addError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.6rem 0.85rem', color: '#b91c1c', fontSize: '0.82rem' }}>
            {addError}
          </div>
        )}

        {/* Watchlist Cards Grid */}
        {isCrypto ? (
          cryptoItems.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#334155', fontWeight: 600 }}>This crypto watchlist is currently empty.</p>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Enter a symbol like <code>BTC</code> or <code>ETH</code> above to track live 24/7 CoinDCX quotes.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              {cryptoItems.map((item) => {
                const asset = item.cryptoAsset;
                const isPositive = (asset?.change ?? 0) >= 0;
                return (
                  <div key={item.id} className="metric-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#fffbeb',
                              color: '#b45309',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            {asset?.symbol?.slice(0, 2) || 'CR'}
                          </div>
                          <div>
                            <Link href={`/crypto/${asset?.symbol}`} style={{ textDecoration: 'none' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                {asset?.symbol} <ExternalLink size={13} style={{ opacity: 0.7 }} color="#f59e0b" />
                              </span>
                            </Link>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                              {asset?.name}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveCrypto(asset?.id || item.cryptoAssetId)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          title="Remove from crypto watchlist"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                          {formatCurrency(asset?.currentPrice || 0)}
                        </div>
                        <span className={isPositive ? 'badge-positive' : 'badge-negative'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {isPositive ? '+' : ''}{formatPercent(asset?.changePercent || 0)}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                      <span style={{ fontWeight: 500 }}>Category: {asset?.category || 'Layer 1'}</span>
                      <Link href={`/crypto/${asset?.symbol}`} style={{ color: '#f59e0b', textDecoration: 'none', fontWeight: 700 }}>
                        24/7 Terminal →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          stockItems.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#334155', fontWeight: 600 }}>This watchlist is currently empty.</p>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Enter a symbol like <code>TATAMOTORS.NS</code> or <code>INFY.NS</code> above to track live quotes.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              {stockItems.map((item) => {
                const isPositive = (item.stock.change || 0) >= 0;
                return (
                  <div key={item.id} className="metric-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.25rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <Link href={`/stock/${item.stock.symbol}`} style={{ textDecoration: 'none' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              {item.stock.symbol} <ExternalLink size={13} style={{ opacity: 0.7 }} color="#4f46e5" />
                            </span>
                          </Link>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                            {item.stock.name}
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveStock(item.stock.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          title="Remove from watchlist"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                          {formatCurrency(item.stock.currentPrice || 0)}
                        </div>
                        <span className={isPositive ? 'badge-positive' : 'badge-negative'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                          {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {isPositive ? '+' : ''}{formatPercent(item.stock.changePercent || 0)}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                      <span style={{ fontWeight: 500 }}>Sector: {item.stock.sector}</span>
                      <Link href={`/stock/${item.stock.symbol}`} style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 700 }}>
                        View Terminal →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* New Watchlist Modal (Stocks) */}
      {showNewListModal && (
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
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', color: '#0f172a' }}>Create New Watchlist</h2>
            <form onSubmit={handleCreateWatchlist} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Watchlist Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. IT Bluechips, EV Stocks"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: '0.92rem', fontWeight: 600, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowNewListModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.6rem 1.1rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingList || !newListName.trim()}
                  className="btn-primary"
                  style={{ padding: '0.6rem 1.3rem', fontSize: '0.85rem' }}
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
