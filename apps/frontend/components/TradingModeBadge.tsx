'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface TradingModeBadgeProps {
  mode: 'PAPER' | 'LIVE';
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

export default function TradingModeBadge({
  mode,
  size = 'medium',
  showIcon = true,
}: TradingModeBadgeProps) {
  const isLive = mode === 'LIVE';

  const padding = size === 'small' ? '0.2rem 0.5rem' : size === 'large' ? '0.45rem 0.95rem' : '0.3rem 0.75rem';
  const fontSize = size === 'small' ? '0.7rem' : size === 'large' ? '0.85rem' : '0.78rem';
  const iconSize = size === 'small' ? 12 : size === 'large' ? 16 : 14;

  if (isLive) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding,
          borderRadius: '20px',
          background: '#fef2f2',
          border: '1.5px solid #dc2626',
          color: '#dc2626',
          fontSize,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.18)',
        }}
      >
        {showIcon && <AlertTriangle size={iconSize} color="#dc2626" className="animate-pulse" />}
        LIVE TRADING — REAL MONEY
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding,
        borderRadius: '20px',
        background: '#eef2ff',
        border: '1px solid rgba(79, 70, 229, 0.3)',
        color: '#4338ca',
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
      }}
    >
      {showIcon && <ShieldCheck size={iconSize} color="#4f46e5" />}
      PAPER TRADING
    </span>
  );
}
