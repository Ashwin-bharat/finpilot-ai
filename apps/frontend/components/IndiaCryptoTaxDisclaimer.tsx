'use client';

import React from 'react';
import { AlertTriangle, Scale } from 'lucide-react';

interface IndiaCryptoTaxDisclaimerProps {
  compact?: boolean;
  style?: React.CSSProperties;
}

export default function IndiaCryptoTaxDisclaimer({ compact = false, style }: IndiaCryptoTaxDisclaimerProps) {
  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.65rem 0.85rem',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          fontSize: '0.78rem',
          color: '#92400e',
          lineHeight: 1.45,
          fontWeight: 600,
          ...style,
        }}
        role="note"
        aria-label="India Cryptocurrency Tax Disclosure"
      >
        <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
        <div>
          <strong>India Crypto Tax Notice:</strong> Flat 30% tax on gains + 1% TDS applies per section 115BBH/194S. Not tax advice.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.85rem',
        padding: '0.95rem 1.15rem',
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        border: '1.5px solid #f59e0b',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.12)',
        ...style,
      }}
      role="note"
      aria-label="India Cryptocurrency Tax Disclosure"
    >
      <div
        style={{
          padding: '0.45rem',
          background: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '0.1rem',
        }}
      >
        <Scale size={20} color="#b45309" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#92400e', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            STATUTORY INDIA TAX DISCLOSURE (VDA REGIME)
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#78350f', lineHeight: 1.5, fontWeight: 500 }}>
          Cryptocurrency gains in India are taxed at a flat <strong>30% rate</strong> plus <strong>1% TDS on transactions</strong> — a different and stricter regime than equity capital gains. Losses cannot be offset against other income. This is not tax advice; consult a professional.
        </p>
      </div>
    </div>
  );
}
