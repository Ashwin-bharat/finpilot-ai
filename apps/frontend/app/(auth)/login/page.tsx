'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, AlertCircle, Eye, EyeOff, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../../../context/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    try {
      setLoading(true);
      await login({ email, password });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    window.location.href = `${backendUrl}/auth/google`;
  };

  // Decorative mock market ticker items
  const tickerItems = [
    { symbol: 'NIFTY 50', price: '24,852.40', change: '+0.62%', up: true },
    { symbol: 'SENSEX', price: '81,332.10', change: '+0.54%', up: true },
    { symbol: 'BTC/INR', price: '₹5,425,000', change: '+2.35%', up: true },
    { symbol: 'ETH/INR', price: '₹284,900', change: '-0.42%', up: false },
    { symbol: 'RELIANCE', price: '₹2,985.20', change: '+1.12%', up: true },
    { symbol: 'TCS', price: '₹4,140.00', change: '-0.30%', up: false },
    { symbol: 'HDFCBANK', price: '₹1,642.50', change: '+0.78%', up: true },
    { symbol: 'SOL/INR', price: '₹12,450', change: '+4.80%', up: true },
  ];

  return (
    <div style={styles.container}>
      {/* Background Animated Hero Layer */}
      <div style={styles.backgroundLayer}>
        {/* Animated Multi-Stop Gradient Base */}
        <div style={styles.animatedGradientMesh} className="animate-gradient-mesh" />

        {/* Tactile Micro-Dot Texture Grid */}
        <div style={styles.dotGridOverlay} />

        {/* Saturated Glowing Accent Orbs (Drifting in elliptical paths + pulsing) */}
        {/* Orb 1: Saturated Brand Purple (#4f46e5) */}
        <div style={{ ...styles.orb, ...styles.orbPurple }} className="animate-orb-purple" />

        {/* Orb 2: Saturated Emerald (#059669) */}
        <div style={{ ...styles.orb, ...styles.orbEmerald }} className="animate-orb-emerald" />

        {/* Orb 3: Vivid Indigo / Violet (#7c3aed) */}
        <div style={{ ...styles.orb, ...styles.orbViolet }} className="animate-orb-violet" />

        {/* Orb 4: Radiant Teal / Cyan (#0d9488) */}
        <div style={{ ...styles.orb, ...styles.orbTeal }} className="animate-orb-teal" />

        {/* Abstract Candlestick Chart Clusters (Parallax Depths with Real Market Variations) */}
        {/* Cluster 1: Foreground Top-Left (Sharp, 6 candles, Bullish breakout) */}
        <div style={styles.cluster1} className="animate-candle-1">
          <svg width="150" height="110" viewBox="0 0 150 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Candle 1 (Green) */}
            <line x1="14" y1="26" x2="14" y2="88" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="8" y="44" width="12" height="30" rx="2" fill="rgba(5, 150, 105, 0.45)" stroke="#059669" strokeWidth="1.5" />
            {/* Candle 2 (Green) */}
            <line x1="38" y1="18" x2="38" y2="82" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="32" y="32" width="12" height="36" rx="2" fill="rgba(5, 150, 105, 0.50)" stroke="#059669" strokeWidth="1.5" />
            {/* Candle 3 (Red Pullback) */}
            <line x1="62" y1="28" x2="62" y2="94" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="56" y="36" width="12" height="26" rx="2" fill="rgba(225, 29, 72, 0.42)" stroke="#e11d48" strokeWidth="1.5" />
            {/* Candle 4 (Green Hammer) */}
            <line x1="86" y1="22" x2="86" y2="102" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="80" y="24" width="12" height="22" rx="2" fill="rgba(5, 150, 105, 0.48)" stroke="#059669" strokeWidth="1.5" />
            {/* Candle 5 (Red) */}
            <line x1="110" y1="18" x2="110" y2="78" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="104" y="22" width="12" height="28" rx="2" fill="rgba(225, 29, 72, 0.45)" stroke="#e11d48" strokeWidth="1.5" />
            {/* Candle 6 (Green Strong Close) */}
            <line x1="134" y1="8" x2="134" y2="68" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="128" y="14" width="12" height="42" rx="2" fill="rgba(5, 150, 105, 0.55)" stroke="#059669" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Cluster 2: Mid-Far Top-Right (Subtle blur 2.5px, 7 candles, Sideways accumulation) */}
        <div style={styles.cluster2} className="animate-candle-2">
          <svg width="170" height="110" viewBox="0 0 170 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* C1 Red */}
            <line x1="14" y1="18" x2="14" y2="76" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="9" y="30" width="10" height="32" rx="2" fill="rgba(225, 29, 72, 0.38)" stroke="#e11d48" strokeWidth="1" />
            {/* C2 Green */}
            <line x1="38" y1="24" x2="38" y2="82" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="33" y="38" width="10" height="26" rx="2" fill="rgba(79, 70, 229, 0.35)" stroke="#4f46e5" strokeWidth="1" />
            {/* C3 Red */}
            <line x1="62" y1="32" x2="62" y2="90" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="57" y="46" width="10" height="28" rx="2" fill="rgba(225, 29, 72, 0.35)" stroke="#e11d48" strokeWidth="1" />
            {/* C4 Green Doji */}
            <line x1="86" y1="20" x2="86" y2="92" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="81" y="48" width="10" height="8" rx="2" fill="rgba(5, 150, 105, 0.40)" stroke="#059669" strokeWidth="1" />
            {/* C5 Green */}
            <line x1="110" y1="16" x2="110" y2="75" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="105" y="28" width="10" height="32" rx="2" fill="rgba(5, 150, 105, 0.40)" stroke="#059669" strokeWidth="1" />
            {/* C6 Green */}
            <line x1="134" y1="10" x2="134" y2="68" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="129" y="18" width="10" height="36" rx="2" fill="rgba(79, 70, 229, 0.42)" stroke="#4f46e5" strokeWidth="1" />
            {/* C7 Green Spike */}
            <line x1="158" y1="6" x2="158" y2="60" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="153" y="12" width="10" height="38" rx="2" fill="rgba(5, 150, 105, 0.48)" stroke="#059669" strokeWidth="1" />
          </svg>
        </div>

        {/* Cluster 3: Deep-Far Center-Left (Blur 3.5px, 8 candles, Low opacity depth texture) */}
        <div style={styles.cluster3} className="animate-candle-3">
          <svg width="190" height="105" viewBox="0 0 190 105" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="12" y1="38" x2="12" y2="92" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="7" y="52" width="10" height="26" rx="2" fill="rgba(225, 29, 72, 0.30)" stroke="#e11d48" strokeWidth="1" />

            <line x1="36" y1="28" x2="36" y2="86" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="31" y="42" width="10" height="30" rx="2" fill="rgba(5, 150, 105, 0.32)" stroke="#059669" strokeWidth="1" />

            <line x1="60" y1="20" x2="60" y2="80" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="55" y="32" width="10" height="36" rx="2" fill="rgba(5, 150, 105, 0.35)" stroke="#059669" strokeWidth="1" />

            <line x1="84" y1="30" x2="84" y2="88" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="79" y="44" width="10" height="24" rx="2" fill="rgba(225, 29, 72, 0.30)" stroke="#e11d48" strokeWidth="1" />

            <line x1="108" y1="16" x2="108" y2="76" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="103" y="26" width="10" height="34" rx="2" fill="rgba(5, 150, 105, 0.35)" stroke="#059669" strokeWidth="1" />

            <line x1="132" y1="12" x2="132" y2="70" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="127" y="20" width="10" height="38" rx="2" fill="rgba(79, 70, 229, 0.35)" stroke="#4f46e5" strokeWidth="1" />

            <line x1="156" y1="22" x2="156" y2="82" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="151" y="34" width="10" height="28" rx="2" fill="rgba(225, 29, 72, 0.32)" stroke="#e11d48" strokeWidth="1" />

            <line x1="180" y1="10" x2="180" y2="65" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="175" y="16" width="10" height="36" rx="2" fill="rgba(5, 150, 105, 0.38)" stroke="#059669" strokeWidth="1" />
          </svg>
        </div>

        {/* Cluster 4: Mid Bottom-Right (Sharp, 6 candles, Reversal engulfing) */}
        <div style={styles.cluster4} className="animate-candle-4">
          <svg width="155" height="105" viewBox="0 0 155 105" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="14" y1="28" x2="14" y2="85" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="8" y="40" width="12" height="32" rx="2" fill="rgba(5, 150, 105, 0.42)" stroke="#059669" strokeWidth="1.2" />

            <line x1="40" y1="20" x2="40" y2="80" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="34" y="32" width="12" height="34" rx="2" fill="rgba(5, 150, 105, 0.45)" stroke="#059669" strokeWidth="1.2" />

            <line x1="66" y1="36" x2="66" y2="92" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="60" y="48" width="12" height="24" rx="2" fill="rgba(225, 29, 72, 0.40)" stroke="#e11d48" strokeWidth="1.2" />

            <line x1="92" y1="14" x2="92" y2="74" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="86" y="24" width="12" height="36" rx="2" fill="rgba(5, 150, 105, 0.48)" stroke="#059669" strokeWidth="1.2" />

            <line x1="118" y1="10" x2="118" y2="68" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="112" y="18" width="12" height="38" rx="2" fill="rgba(79, 70, 229, 0.45)" stroke="#4f46e5" strokeWidth="1.2" />

            <line x1="144" y1="6" x2="144" y2="58" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="138" y="12" width="12" height="36" rx="2" fill="rgba(5, 150, 105, 0.52)" stroke="#059669" strokeWidth="1.2" />
          </svg>
        </div>

        {/* Cluster 5: Mid-Far Bottom-Left (Blur 2px, 5 candles, Wave drift) */}
        <div style={styles.cluster5} className="animate-candle-5">
          <svg width="135" height="95" viewBox="0 0 135 95" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="14" y1="32" x2="14" y2="84" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="9" y="44" width="10" height="26" rx="2" fill="rgba(225, 29, 72, 0.35)" stroke="#e11d48" strokeWidth="1" />

            <line x1="40" y1="22" x2="40" y2="78" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="35" y="34" width="10" height="30" rx="2" fill="rgba(5, 150, 105, 0.38)" stroke="#059669" strokeWidth="1" />

            <line x1="66" y1="14" x2="66" y2="70" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="61" y="24" width="10" height="34" rx="2" fill="rgba(5, 150, 105, 0.42)" stroke="#059669" strokeWidth="1" />

            <line x1="92" y1="26" x2="92" y2="82" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="87" y="38" width="10" height="24" rx="2" fill="rgba(225, 29, 72, 0.35)" stroke="#e11d48" strokeWidth="1" />

            <line x1="118" y1="12" x2="118" y2="65" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="113" y="20" width="10" height="32" rx="2" fill="rgba(79, 70, 229, 0.42)" stroke="#4f46e5" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* Top / Bottom Glass Ticker Strip (Continuous Infinite Marquee) */}
      <div style={styles.tickerStrip}>
        <div style={styles.tickerTrack} className="animate-ticker-track">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, idx) => (
            <div key={idx} style={styles.tickerItem}>
              <span style={styles.tickerSymbol}>{item.symbol}</span>
              <span style={styles.tickerPrice}>{item.price}</span>
              <span
                style={{
                  ...styles.tickerChange,
                  color: item.up ? '#059669' : '#e11d48',
                  backgroundColor: item.up ? 'rgba(5, 150, 105, 0.10)' : 'rgba(225, 29, 72, 0.10)',
                }}
              >
                {item.up ? (
                  <TrendingUp size={11} style={{ marginRight: '3px' }} />
                ) : (
                  <TrendingDown size={11} style={{ marginRight: '3px' }} />
                )}
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Genuine Glassmorphic Login Card */}
      <div style={styles.card} className="animate-card-entrance">
        {/* Top Brand Pill Badge */}
        <div style={styles.badgeWrapper}>
          <div style={styles.brandBadge}>
            <div style={styles.brandIconWrapper}>
              <Sparkles size={12} color="#ffffff" />
            </div>
            <span style={styles.brandBadgeText}>FINPILOT AI</span>
          </div>
        </div>

        <div style={styles.header}>
          <h1 style={styles.title}>Welcome Back</h1>
          <p style={styles.subtitle}>Sign in to your FinPilot AI terminal</p>
        </div>

        {error && (
          <div style={styles.errorBox} role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="login-input"
              style={styles.input}
              autoComplete="email"
            />
          </div>

          <div style={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <label style={{ ...styles.label, marginBottom: 0 }} htmlFor="password">Password</label>
              <Link href="/forgot-password" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <div style={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="login-input"
                style={{ ...styles.input, paddingRight: '2.5rem' }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={styles.passwordToggleBtn}
                aria-label="Toggle visibility"
                title="Toggle visibility"
              >
                {showPassword ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="login-submit-btn"
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.75 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>OR CONTINUE WITH</span>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="login-google-btn"
          style={styles.googleButton}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '10px', flexShrink: 0 }}>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>

        <p style={styles.footerText}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={styles.link} className="login-link">
            Sign up
          </Link>
        </p>
      </div>

      {/* High-Performance Scoped CSS: Animations, Glow Effects & Micro-Interactions */}
      <style>{`
        /* Card Entrance: 400ms ease-out fade + scale */
        @keyframes cardEntrance {
          0% {
            opacity: 0;
            transform: translate3d(0, 16px, 0) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        /* Animated Multi-Stop Gradient Base (18s continuous loop) */
        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        /* Glow Orbs: Elliptical Drift & Opacity Pulse (20-30s loops) */
        @keyframes orbDriftPurple {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.22;
          }
          33% {
            transform: translate3d(120px, 80px, 0) scale(1.15);
            opacity: 0.32;
          }
          66% {
            transform: translate3d(60px, 160px, 0) scale(0.95);
            opacity: 0.25;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.22;
          }
        }

        @keyframes orbDriftEmerald {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.20;
          }
          33% {
            transform: translate3d(-110px, -70px, 0) scale(1.18);
            opacity: 0.30;
          }
          66% {
            transform: translate3d(-40px, -140px, 0) scale(0.92);
            opacity: 0.24;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.20;
          }
        }

        @keyframes orbDriftViolet {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.18;
          }
          50% {
            transform: translate3d(-80px, 90px, 0) scale(1.12);
            opacity: 0.28;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.18;
          }
        }

        @keyframes orbDriftTeal {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.19;
          }
          50% {
            transform: translate3d(90px, -80px, 0) scale(1.14);
            opacity: 0.29;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.19;
          }
        }

        /* Candlestick Vertical Drift (40-60px over 15-26s) */
        @keyframes candleFloat1 {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -50px, 0);
          }
        }

        @keyframes candleFloat2 {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -45px, 0);
          }
        }

        @keyframes candleFloat3 {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -55px, 0);
          }
        }

        @keyframes candleFloat4 {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -48px, 0);
          }
        }

        @keyframes candleFloat5 {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -52px, 0);
          }
        }

        /* Continuous Infinite Ticker Scroll */
        @keyframes tickerScroll {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-33.333%, 0, 0);
          }
        }

        .animate-card-entrance {
          animation: cardEntrance 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: opacity, transform;
        }

        .animate-gradient-mesh {
          animation: gradientShift 18s ease infinite;
          background-size: 300% 300%;
        }

        .animate-orb-purple {
          animation: orbDriftPurple 22s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .animate-orb-emerald {
          animation: orbDriftEmerald 26s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .animate-orb-violet {
          animation: orbDriftViolet 28s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .animate-orb-teal {
          animation: orbDriftTeal 24s ease-in-out infinite;
          will-change: transform, opacity;
        }

        .animate-candle-1 {
          animation: candleFloat1 16s ease-in-out infinite;
          will-change: transform;
        }

        .animate-candle-2 {
          animation: candleFloat2 22s ease-in-out infinite;
          will-change: transform;
        }

        .animate-candle-3 {
          animation: candleFloat3 26s ease-in-out infinite;
          will-change: transform;
        }

        .animate-candle-4 {
          animation: candleFloat4 19s ease-in-out infinite;
          will-change: transform;
        }

        .animate-candle-5 {
          animation: candleFloat5 23s ease-in-out infinite;
          will-change: transform;
        }

        .animate-ticker-track {
          animation: tickerScroll 32s linear infinite;
          will-change: transform;
        }

        /* Micro-Interactions: Inputs Focus Ring Glow (150ms) */
        .login-input {
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
        }
        .login-input:focus {
          border-color: #4f46e5 !important;
          box-shadow: 0 0 0 3.5px rgba(79, 70, 229, 0.20) !important;
          background-color: #ffffff !important;
        }

        /* Sign In Button: Hover Lift (Scale 1.02) + Active Tap Feedback (Scale 0.98) */
        .login-submit-btn {
          transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1), filter 0.15s ease;
        }
        .login-submit-btn:hover:not(:disabled) {
          transform: scale(1.02);
          box-shadow: 0 10px 25px -4px rgba(79, 70, 229, 0.42) !important;
          filter: brightness(1.06);
        }
        .login-submit-btn:active:not(:disabled) {
          transform: scale(0.98);
          filter: brightness(0.96);
        }

        /* Google Button: Subtle Lift & Shadow */
        .login-google-btn {
          transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .login-google-btn:hover {
          transform: translateY(-1px);
          background-color: rgba(255, 255, 255, 0.95) !important;
          border-color: #cbd5e1 !important;
          box-shadow: 0 4px 14px -2px rgba(15, 23, 42, 0.08) !important;
        }
        .login-google-btn:active {
          transform: translateY(0);
        }

        .login-link {
          transition: color 0.15s ease;
        }
        .login-link:hover {
          color: #3730a3 !important;
          text-decoration: underline !important;
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#fbf9f5',
    overflowY: 'auto',
    padding: '1.5rem',
  },
  backgroundLayer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 0,
  },
  animatedGradientMesh: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(-45deg, #fdfbf7 0%, #ede9fe 25%, #e0e7ff 50%, #ccfbf1 75%, #f5f3ff 100%)',
    backgroundSize: '300% 300%',
  },
  dotGridOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(rgba(100, 116, 139, 0.14) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    opacity: 0.65,
  },
  orb: {
    position: 'absolute',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  orbPurple: {
    width: '320px',
    height: '320px',
    top: '-60px',
    left: '12%',
    background: 'radial-gradient(circle, rgba(79, 70, 229, 0.48) 0%, rgba(79, 70, 229, 0) 70%)',
    filter: 'blur(95px)',
  },
  orbEmerald: {
    width: '300px',
    height: '300px',
    bottom: '-50px',
    right: '10%',
    background: 'radial-gradient(circle, rgba(5, 150, 105, 0.42) 0%, rgba(5, 150, 105, 0) 70%)',
    filter: 'blur(90px)',
  },
  orbViolet: {
    width: '260px',
    height: '260px',
    bottom: '15%',
    left: '-50px',
    background: 'radial-gradient(circle, rgba(124, 58, 237, 0.38) 0%, rgba(124, 58, 237, 0) 70%)',
    filter: 'blur(85px)',
  },
  orbTeal: {
    width: '250px',
    height: '250px',
    top: '8%',
    right: '-40px',
    background: 'radial-gradient(circle, rgba(13, 148, 136, 0.38) 0%, rgba(13, 148, 136, 0) 70%)',
    filter: 'blur(85px)',
  },

  // Candlestick Clusters at varying depths & opacities
  cluster1: {
    position: 'absolute',
    top: '12%',
    left: '8%',
    opacity: 0.25,
    transform: 'scale(1.1)',
  },
  cluster2: {
    position: 'absolute',
    top: '10%',
    right: '8%',
    opacity: 0.18,
    filter: 'blur(2.5px)',
    transform: 'scale(0.85)',
  },
  cluster3: {
    position: 'absolute',
    top: '44%',
    left: '2%',
    opacity: 0.15,
    filter: 'blur(3.5px)',
    transform: 'scale(0.72)',
  },
  cluster4: {
    position: 'absolute',
    bottom: '14%',
    right: '6%',
    opacity: 0.22,
    transform: 'scale(0.95)',
  },
  cluster5: {
    position: 'absolute',
    bottom: '12%',
    left: '14%',
    opacity: 0.18,
    filter: 'blur(2px)',
    transform: 'scale(0.88)',
  },

  // Ticker Strip along the bottom edge
  tickerStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '38px',
    backgroundColor: 'rgba(255, 255, 255, 0.50)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderTop: '1px solid rgba(255, 255, 255, 0.65)',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 10,
  },
  tickerTrack: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    width: 'max-content',
  },
  tickerItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0 1.25rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    borderRight: '1px solid rgba(148, 163, 184, 0.2)',
  },
  tickerSymbol: {
    color: '#0f172a',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  tickerPrice: {
    color: '#475569',
    fontWeight: 500,
  },
  tickerChange: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 5px',
    borderRadius: '4px',
    fontWeight: 700,
    fontSize: '0.72rem',
  },

  // Genuine Glassmorphic Login Card
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: '430px',
    backgroundColor: 'rgba(255, 255, 255, 0.60)',
    backdropFilter: 'blur(22px) saturate(160%)',
    WebkitBackdropFilter: 'blur(22px) saturate(160%)',
    border: '1px solid rgba(255, 255, 255, 0.65)',
    borderRadius: '20px',
    padding: '2.25rem 2.25rem 2rem 2.25rem',
    boxShadow:
      '0 25px 50px -12px rgba(15, 23, 42, 0.15), 0 10px 25px -5px rgba(79, 70, 229, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9), inset 0 -1px 1px rgba(255, 255, 255, 0.3)',
    zIndex: 20,
    marginBottom: '2rem',
  },
  badgeWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  brandBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.32rem 0.85rem',
    borderRadius: '9999px',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.9)',
    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.12)',
  },
  brandIconWrapper: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: '#312e81',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '0.35rem',
    letterSpacing: '-0.025em',
  },
  subtitle: {
    fontSize: '0.88rem',
    color: '#475569',
    margin: 0,
    fontWeight: 500,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    fontSize: '0.84rem',
    marginBottom: '1.25rem',
    fontWeight: 600,
    backdropFilter: 'blur(8px)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.05rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#1e293b',
    letterSpacing: '-0.01em',
  },
  input: {
    width: '100%',
    padding: '0.72rem 0.95rem',
    borderRadius: '10px',
    border: '1px solid rgba(203, 213, 225, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    color: '#0f172a',
    fontSize: '0.92rem',
    fontWeight: 500,
    outline: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
    boxSizing: 'border-box',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  passwordToggleBtn: {
    position: 'absolute',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: '4px',
  },
  submitButton: {
    marginTop: '0.35rem',
    padding: '0.82rem',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '0.94rem',
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
  },
  divider: {
    position: 'relative',
    textAlign: 'center',
    margin: '1.35rem 0',
    borderBottom: '1px solid rgba(203, 213, 225, 0.6)',
    lineHeight: '0.1em',
  },
  dividerText: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(8px)',
    padding: '0 0.75rem',
    color: '#64748b',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  googleButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem',
    borderRadius: '10px',
    border: '1px solid rgba(203, 213, 225, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.80)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    color: '#0f172a',
    fontWeight: 600,
    fontSize: '0.88rem',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
  },
  footerText: {
    textAlign: 'center',
    marginTop: '1.35rem',
    fontSize: '0.85rem',
    color: '#475569',
    fontWeight: 500,
  },
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontWeight: 700,
  },
};
