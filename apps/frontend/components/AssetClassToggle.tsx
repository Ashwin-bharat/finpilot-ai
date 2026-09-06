'use client';

import React from 'react';
import { useAssetClass } from '../context/asset-class-context';
import { TrendingUp, Coins } from 'lucide-react';

interface AssetClassToggleProps {
  style?: React.CSSProperties;
  className?: string;
}

export default function AssetClassToggle({ style, className }: AssetClassToggleProps) {
  const { assetClass, setAssetClass } = useAssetClass();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#f1f5f9',
        padding: '3px',
        borderRadius: '24px',
        border: '1px solid #e2e8f0',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
        userSelect: 'none',
        ...style,
      }}
      className={`asset-class-toggle ${className || ''}`}
      role="group"
      aria-label="Asset class selector"
    >
      {/* Stocks Option */}
      <button
        type="button"
        onClick={() => setAssetClass('stocks')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.45rem 1rem',
          borderRadius: '20px',
          border: 'none',
          fontSize: '0.84rem',
          fontWeight: assetClass === 'stocks' ? 700 : 600,
          color: assetClass === 'stocks' ? '#1e293b' : '#64748b',
          background: assetClass === 'stocks' ? '#ffffff' : 'transparent',
          boxShadow: assetClass === 'stocks' ? '0 2px 6px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        id="toggle-stocks-btn"
      >
        <TrendingUp
          size={14}
          color={assetClass === 'stocks' ? '#4f46e5' : '#94a3b8'}
          strokeWidth={assetClass === 'stocks' ? 2.5 : 2}
        />
        <span>Stocks</span>
      </button>

      {/* Crypto Option */}
      <button
        type="button"
        onClick={() => setAssetClass('crypto')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.45rem 1rem',
          borderRadius: '20px',
          border: 'none',
          fontSize: '0.84rem',
          fontWeight: assetClass === 'crypto' ? 700 : 600,
          color: assetClass === 'crypto' ? '#0f172a' : '#64748b',
          background: assetClass === 'crypto' ? '#ffffff' : 'transparent',
          boxShadow: assetClass === 'crypto' ? '0 2px 6px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        id="toggle-crypto-btn"
      >
        <Coins
          size={14}
          color={assetClass === 'crypto' ? '#f59e0b' : '#94a3b8'}
          strokeWidth={assetClass === 'crypto' ? 2.5 : 2}
        />
        <span>Crypto</span>
      </button>
    </div>
  );
}
