'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Coins,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import { useAssetClass } from '../../context/asset-class-context';
import AssetClassToggle from '../../components/AssetClassToggle';
import IndiaCryptoTaxDisclaimer from '../../components/IndiaCryptoTaxDisclaimer';
import { Stock, MarketIndex, GainerLoserItem, CryptoAsset, CryptoTopMoversResponse } from '@finpilot/shared-types';
import { getStocksApi, getTopMoversApi } from '../../lib/market';
import { getCryptoTopMoversApi, searchCryptoApi } from '../../lib/crypto';

export default function MarketsPage() {
  const { assetClass, isCrypto } = useAssetClass();

  // Equities state
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [stockIndices, setStockIndices] = useState<MarketIndex[]>([]);
  const [stockGainers, setStockGainers] = useState<GainerLoserItem[]>([]);
  const [stockLosers, setStockLosers] = useState<GainerLoserItem[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stocksLoading, setStocksLoading] = useState(true);

  // Crypto state
  const [cryptoTopMovers, setCryptoTopMovers] = useState<CryptoTopMoversResponse | null>(null);
  const [cryptoAssets, setCryptoAssets] = useState<CryptoAsset[]>([]);
  const [cryptoSearchQuery, setCryptoSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cryptoLoading, setCryptoLoading] = useState(true);

  // Active Movers Tab
  const [moversTab, setMoversTab] = useState<'gainers' | 'losers'>('gainers');

  // Load Equities
  const loadEquities = useCallback(async () => {
    setStocksLoading(true);
    try {
      const [movers, stockList] = await Promise.all([
        getTopMoversApi().catch(() => null),
        getStocksApi().catch(() => []),
      ]);
      if (movers?.indices) setStockIndices(movers.indices);
      if (movers?.gainers) setStockGainers(movers.gainers);
      if (movers?.losers) setStockLosers(movers.losers);
      setStocks(stockList || []);
    } catch {
      // Keep fallbacks
    } finally {
      setStocksLoading(false);
    }
  }, []);

  // Load Crypto
  const loadCrypto = useCallback(async () => {
    setCryptoLoading(true);
    try {
      const [topMovers, allCrypto] = await Promise.all([
        getCryptoTopMoversApi().catch(() => null),
        searchCryptoApi().catch(() => []),
      ]);
      if (topMovers) setCryptoTopMovers(topMovers);
      setCryptoAssets(allCrypto || topMovers?.topCoins || []);
    } catch {
      // Keep fallbacks
    } finally {
      setCryptoLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEquities();
    loadCrypto();
  }, [loadEquities, loadCrypto]);

  // Filtered equities
  const filteredStocks = stocks.filter((s) => {
    if (!stockSearchQuery) return true;
    const q = stockSearchQuery.toLowerCase();
    return s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q);
  });

  // Filtered crypto
  const filteredCrypto = (cryptoTopMovers?.topCoins || cryptoAssets).filter((c) => {
    const matchesSearch =
      !cryptoSearchQuery ||
      c.symbol.toLowerCase().includes(cryptoSearchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(cryptoSearchQuery.toLowerCase());

    const matchesCat =
      selectedCategory === 'All' ||
      (c.category && c.category.toLowerCase().includes(selectedCategory.toLowerCase()));

    return matchesSearch && matchesCat;
  });

  const cryptoCategories = ['All', 'Layer 1', 'DeFi', 'Layer 2', 'Meme', 'Payment', 'AI', 'Storage'];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Top Center Asset Class Toggle Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
        <AssetClassToggle />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0', letterSpacing: '-0.02em' }}>
            {isCrypto ? 'Cryptocurrency Markets' : 'Equity Markets'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            {isCrypto
              ? 'Real-time CoinDCX spot prices, 24/7 trading pairs, and crypto sector analytics'
              : 'National Stock Exchange (NSE) & Bombay Stock Exchange (BSE) live market coverage'}
          </p>
        </div>
      </div>

      {/* India Tax Warning for Crypto */}
      {isCrypto && <IndiaCryptoTaxDisclaimer />}

      {/* BENCHMARK INDICES CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {isCrypto ? (
          (cryptoTopMovers?.indices || []).map((idx) => (
            <div
              key={idx.name}
              className="glass-panel"
              style={{
                padding: '1.1rem 1.25rem',
                borderLeft: idx.isPositive ? '4px solid #10b981' : '4px solid #ef4444',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>{idx.name}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: idx.isPositive ? '#059669' : '#dc2626' }}>
                  {idx.percent}
                </span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{idx.value}</div>
              <div style={{ fontSize: '0.75rem', color: idx.isPositive ? '#059669' : '#dc2626', marginTop: '0.25rem', fontWeight: 600 }}>
                {idx.change} (24h)
              </div>
            </div>
          ))
        ) : (
          stockIndices.map((idx) => (
            <div
              key={idx.name}
              className="glass-panel"
              style={{
                padding: '1.1rem 1.25rem',
                borderLeft: idx.isPositive ? '4px solid #10b981' : '4px solid #ef4444',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>{idx.name}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: idx.isPositive ? '#059669' : '#dc2626' }}>
                  {idx.percent}
                </span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{idx.value}</div>
              <div style={{ fontSize: '0.75rem', color: idx.isPositive ? '#059669' : '#dc2626', marginTop: '0.25rem', fontWeight: 600 }}>
                {idx.change} today
              </div>
            </div>
          ))
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        
        {/* LEFT COLUMN: SEARCH & ASSETS LIST */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Search Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {isCrypto ? 'Verified Crypto Assets' : 'All Listed Equities'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                {isCrypto ? 'Browse top cryptocurrencies by market capitalization' : 'Search and filter active NSE & BSE equities'}
              </p>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                value={isCrypto ? cryptoSearchQuery : stockSearchQuery}
                onChange={(e) => (isCrypto ? setCryptoSearchQuery(e.target.value) : setStockSearchQuery(e.target.value))}
                placeholder={isCrypto ? 'Search BTC, ETH, SOL...' : 'Search TCS, Reliance...'}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.85rem 0.45rem 2rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Crypto Category Filters */}
          {isCrypto && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {cryptoCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '16px',
                    border: selectedCategory === cat ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                    background: selectedCategory === cat ? '#eef2ff' : '#ffffff',
                    color: selectedCategory === cat ? '#4338ca' : '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: selectedCategory === cat ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Assets Table */}
          <div style={{ overflowX: 'auto' }}>
            {isCrypto ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Asset</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Category</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Price (INR)</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>24h Change</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCrypto.map((coin) => {
                    const isPos = (coin.changePercent || 0) >= 0;
                    return (
                      <tr key={coin.symbol} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.88rem' }}>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <Link
                            href={`/crypto/${coin.symbol}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: '#0f172a' }}
                          >
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                color: '#4f46e5',
                              }}
                            >
                              {coin.symbol.slice(0, 3)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{coin.symbol}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{coin.name}</div>
                            </div>
                          </Link>
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                            {coin.category || 'Layer 1'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          ₹{(coin.currentPrice || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td
                          style={{
                            padding: '0.85rem 0.5rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isPos ? '#059669' : '#dc2626',
                          }}
                        >
                          {isPos ? '+' : ''}
                          {(coin.changePercent || 0).toFixed(2)}%
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                          <Link href={`/crypto/${coin.symbol}`} style={{ textDecoration: 'none' }}>
                            <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
                              Analyze
                            </button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Company</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Sector</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Price (INR)</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Day Change</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.slice(0, 20).map((stock) => {
                    const isPos = (stock.changePercent || 0) >= 0;
                    return (
                      <tr key={stock.symbol} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.88rem' }}>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <Link
                            href={`/stock/${stock.symbol}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: '#0f172a' }}
                          >
                            <div>
                              <div style={{ fontWeight: 700 }}>{stock.symbol}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{stock.name}</div>
                            </div>
                          </Link>
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                            {stock.sector}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          ₹{(stock.currentPrice || 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td
                          style={{
                            padding: '0.85rem 0.5rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isPos ? '#059669' : '#dc2626',
                          }}
                        >
                          {isPos ? '+' : ''}
                          {(stock.changePercent || 0).toFixed(2)}%
                        </td>
                        <td style={{ padding: '0.85rem 0.5rem', textAlign: 'right' }}>
                          <Link href={`/stock/${stock.symbol}`} style={{ textDecoration: 'none' }}>
                            <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
                              Analyze
                            </button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: TOP MOVERS & HIGHLIGHTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {isCrypto ? 'CoinDCX Top Movers' : 'Market Movers'}
              </h3>
              
              {/* Movers Tab Toggle */}
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
                <button
                  onClick={() => setMoversTab('gainers')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: moversTab === 'gainers' ? '#ffffff' : 'transparent',
                    color: moversTab === 'gainers' ? '#059669' : '#64748b',
                    boxShadow: moversTab === 'gainers' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  Gainers
                </button>
                <button
                  onClick={() => setMoversTab('losers')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: moversTab === 'losers' ? '#ffffff' : 'transparent',
                    color: moversTab === 'losers' ? '#dc2626' : '#64748b',
                    boxShadow: moversTab === 'losers' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  Losers
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {isCrypto ? (
                (moversTab === 'gainers' ? cryptoTopMovers?.gainers || [] : cryptoTopMovers?.losers || []).map((coin) => (
                  <Link
                    key={coin.symbol}
                    href={`/crypto/${coin.symbol}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.65rem 0.85rem',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{coin.symbol}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{coin.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                        ₹{(coin.price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: coin.changePercent >= 0 ? '#059669' : '#dc2626',
                        }}
                      >
                        {coin.changePercent >= 0 ? '+' : ''}
                        {coin.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                (moversTab === 'gainers' ? stockGainers : stockLosers).map((stock) => (
                  <Link
                    key={stock.symbol}
                    href={`/stock/${stock.symbol}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.65rem 0.85rem',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      textDecoration: 'none',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{stock.symbol}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{stock.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                        ₹{(stock.price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: stock.changePercent >= 0 ? '#059669' : '#dc2626',
                        }}
                      >
                        {stock.changePercent >= 0 ? '+' : ''}
                        {stock.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick AI Assistant Card */}
          <div
            className="glass-panel"
            style={{
              padding: '1.25rem',
              background: 'linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)',
              border: '1px solid rgba(79, 70, 229, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Sparkles size={18} color="#4f46e5" />
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#3730a3' }}>AI Market Insights</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#4338ca', lineHeight: 1.45, margin: '0 0 0.85rem 0' }}>
              {isCrypto
                ? 'Ask FinPilot AI to analyze 24/7 crypto liquidity, market structure shifts, and volatility regimes for Bitcoin, Solana, and Ethereum.'
                : 'Ask FinPilot AI to evaluate multi-timeframe trends, breakout levels, and valuation multiples for NSE & BSE stocks.'}
            </p>
            <Link href="/assistant" style={{ textDecoration: 'none' }}>
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', fontWeight: 700 }}
              >
                Launch FinPilot Assistant
              </button>
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}
