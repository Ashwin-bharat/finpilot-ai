'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, TrendingUp, X } from 'lucide-react';
import { StockSearchResult } from '@finpilot/shared-types';
import { searchStocksApi } from '../lib/market';

export default function StockSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const matches = await searchStocksApi(query);
        setResults(matches);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (symbol: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(`/stock/${symbol}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[0].symbol);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: '#ffffff',
          border: isOpen ? '1px solid #4f46e5' : '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.45rem 0.75rem',
          boxShadow: isOpen ? '0 0 0 3px rgba(79, 70, 229, 0.12)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.18s ease',
        }}
      >
        <Search size={15} color="#64748b" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search 7,200+ NSE & BSE stocks..."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#0f172a',
            fontSize: '0.85rem',
            fontWeight: 500,
            width: '100%',
          }}
        />
        {loading ? (
          <Loader2 size={14} className="animate-spin" color="#4f46e5" />
        ) : query ? (
          <X
            size={14}
            color="#64748b"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
          />
        ) : null}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
            zIndex: 100,
            maxHeight: '320px',
            overflowY: 'auto',
            padding: '0.4rem',
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: '0.75rem', fontSize: '0.82rem', color: '#64748b', textAlign: 'center' }}>
              No NSE or BSE stocks match &quot;{query}&quot;
            </div>
          ) : (
            results.map((item) => {
              const hasDualListing =
                item.exchanges && item.exchanges.length > 1 && item.exchangeSymbols;

              return (
                <div
                  key={item.symbol}
                  onClick={() => handleSelect(item.symbol)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    gap: '0.5rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                        {item.symbol.replace(/\.(NS|BO)$/i, '')}
                      </span>

                      {/* Dual-listed Exchange Selector Buttons or Single Badge */}
                      {hasDualListing ? (
                        <div
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.exchanges?.map((exch) => {
                            const targetSym = item.exchangeSymbols?.[exch] || item.symbol;
                            const isNse = exch === 'NSE';
                            return (
                              <button
                                key={exch}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelect(targetSym);
                                }}
                                title={`View on ${exch}`}
                                style={{
                                  fontSize: '0.65rem',
                                  background: isNse ? '#eef2ff' : '#fffbeb',
                                  color: isNse ? '#4338ca' : '#b45309',
                                  border: isNse
                                    ? '1px solid rgba(79, 70, 229, 0.3)'
                                    : '1px solid rgba(245, 158, 11, 0.3)',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.06)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                              >
                                {exch}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            background: item.exchange?.includes('BSE') ? '#fffbeb' : '#eef2ff',
                            color: item.exchange?.includes('BSE') ? '#b45309' : '#4338ca',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '3px',
                            fontWeight: 700,
                          }}
                        >
                          {item.exchange || (item.symbol.endsWith('.BO') ? 'BSE' : 'NSE')}
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </span>
                  </div>

                  <TrendingUp size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
