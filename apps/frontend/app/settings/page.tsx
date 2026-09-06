'use client';

import React, { useEffect, useState } from 'react';
import TradingModeBadge from '../../components/TradingModeBadge';
import {
  getAllBrokersStatusApi,
  connectAngelOneApi,
  connectZerodhaApi,
  connectCoinDcxApi,
  disconnectBrokerApi,
  toggleTradingModeApi,
  MultiBrokerStatus,
  BrokerInfo,
} from '../../lib/broker';
import { getMeApi, updateExplanationStyleApi } from '../../lib/auth';
import {
  Shield,
  Key,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  Sparkles,
  X,
  Trash2,
  ExternalLink,
  Coins,
  TrendingUp,
  Building2,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function SettingsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [multiStatus, setMultiStatus] = useState<MultiBrokerStatus>({
    tradingMode: 'PAPER',
    liveTradingEnabled: false,
    cryptoTradingMode: 'PAPER',
    cryptoLiveTradingEnabled: false,
    brokers: [],
  });
  const [loading, setLoading] = useState(true);

  // Broker Action State
  const [activeModalBroker, setActiveModalBroker] = useState<'ANGEL_ONE' | 'ZERODHA' | 'COINDCX' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnectBroker, setConfirmDisconnectBroker] = useState<string | null>(null);
  const [brokerSuccess, setBrokerSuccess] = useState<string | null>(null);
  const [brokerError, setBrokerError] = useState<string | null>(null);

  // Modal Form States
  const [angelForm, setAngelForm] = useState({ apiKey: '', clientCode: '', pin: '', totpSecret: '' });
  const [zerodhaForm, setZerodhaForm] = useState({ apiKey: '', apiSecret: '' });
  const [coindcxForm, setCoindcxForm] = useState({ apiKey: '', apiSecret: '' });
  const [showSecret, setShowSecret] = useState(false);

  // Explanation Style State
  const [explanationStyle, setExplanationStyle] = useState<'BEGINNER' | 'ADVANCED'>('BEGINNER');
  const [styleUpdating, setStyleUpdating] = useState(false);
  const [styleMessage, setStyleMessage] = useState<string | null>(null);

  // Warning Modal State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [updatingMode, setUpdatingMode] = useState(false);
  const [modeSuccess, setModeSuccess] = useState<string | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    setToken(savedToken);
    if (savedToken) {
      loadAllStatus(savedToken);
      getMeApi(savedToken)
        .then((u) => {
          if (u.explanationStyle) setExplanationStyle(u.explanationStyle);
        })
        .catch(() => {
          const cached = localStorage.getItem('finpilot_explanation_style');
          if (cached === 'BEGINNER' || cached === 'ADVANCED') setExplanationStyle(cached);
        });
    } else {
      const cached = localStorage.getItem('finpilot_explanation_style');
      if (cached === 'BEGINNER' || cached === 'ADVANCED') setExplanationStyle(cached);
      setLoading(false);
    }
  }, []);

  const loadAllStatus = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await getAllBrokersStatusApi(authToken);
      setMultiStatus(res);
    } catch {
      // default fallback
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConnectModal = (brokerName: 'ANGEL_ONE' | 'ZERODHA' | 'COINDCX') => {
    setActiveModalBroker(brokerName);
    setBrokerError(null);
    setBrokerSuccess(null);
    setShowSecret(false);
  };

  const handleCloseModal = () => {
    setActiveModalBroker(null);
    setConnecting(false);
    setShowSecret(false);
  };

  const handleConnectAngelOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!angelForm.apiKey || !angelForm.clientCode || !angelForm.pin || !angelForm.totpSecret) {
      setBrokerError('Please complete all 4 Angel One credentials fields.');
      return;
    }

    setConnecting(true);
    setBrokerError(null);
    try {
      const res = await connectAngelOneApi(angelForm, token);
      setBrokerSuccess(`Angel One SmartAPI connected successfully (Client Code: ${res.clientCode})`);
      setAngelForm({ apiKey: '', clientCode: '', pin: '', totpSecret: '' });
      handleCloseModal();
      await loadAllStatus(token);
    } catch (err: any) {
      setBrokerError(err.message || 'Failed to connect Angel One account');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectZerodha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!zerodhaForm.apiKey || !zerodhaForm.apiSecret) {
      setBrokerError('Please provide both Kite API Key and API Secret.');
      return;
    }

    setConnecting(true);
    setBrokerError(null);
    try {
      await connectZerodhaApi(zerodhaForm, token);
      setBrokerSuccess('Zerodha Kite Connect account connected successfully');
      setZerodhaForm({ apiKey: '', apiSecret: '' });
      handleCloseModal();
      await loadAllStatus(token);
    } catch (err: any) {
      setBrokerError(err.message || 'Failed to connect Zerodha account');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectCoinDcx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!coindcxForm.apiKey || !coindcxForm.apiSecret) {
      setBrokerError('Please provide both CoinDCX API Key and API Secret.');
      return;
    }

    setConnecting(true);
    setBrokerError(null);
    try {
      await connectCoinDcxApi(coindcxForm, token);
      setBrokerSuccess('CoinDCX crypto broker account connected successfully');
      setCoindcxForm({ apiKey: '', apiSecret: '' });
      handleCloseModal();
      await loadAllStatus(token);
    } catch (err: any) {
      setBrokerError(err.message || 'Failed to connect CoinDCX account');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (brokerName: string) => {
    if (!token) return;
    setDisconnecting(brokerName);
    setBrokerError(null);
    setBrokerSuccess(null);
    try {
      await disconnectBrokerApi(brokerName, token);
      setBrokerSuccess(`${brokerName} account disconnected. Credentials deleted.`);
      setConfirmDisconnectBroker(null);
      await loadAllStatus(token);
    } catch (err: any) {
      setBrokerError(err.message || `Failed to disconnect ${brokerName}`);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleModeToggleClick = (targetMode: 'PAPER' | 'LIVE') => {
    if (targetMode === 'LIVE') {
      setShowWarningModal(true);
    } else {
      executeToggle('PAPER', false);
    }
  };

  const executeToggle = async (mode: 'PAPER' | 'LIVE', confirmLiveTrading: boolean) => {
    if (!token) return;
    setUpdatingMode(true);
    setModeError(null);
    setModeSuccess(null);

    try {
      const res = await toggleTradingModeApi(mode, confirmLiveTrading, token);
      setModeSuccess(res.message);
      setShowWarningModal(false);
      await loadAllStatus(token);
    } catch (err: any) {
      setModeError(err.message || 'Failed to switch trading mode');
    } finally {
      setUpdatingMode(false);
    }
  };

  const handleExplanationStyleChange = async (newStyle: 'BEGINNER' | 'ADVANCED') => {
    setExplanationStyle(newStyle);
    localStorage.setItem('finpilot_explanation_style', newStyle);
    if (!token) return;
    setStyleUpdating(true);
    setStyleMessage(null);
    try {
      await updateExplanationStyleApi(newStyle, token);
      setStyleMessage(
        `AI explanation style updated to "${newStyle === 'BEGINNER' ? 'Simple explanations' : 'Technical terms'}"`,
      );
    } catch (err: any) {
      setStyleMessage(err.message || 'Failed to update preference');
    } finally {
      setStyleUpdating(false);
    }
  };

  const angelOneInfo = multiStatus.brokers.find((b) => b.brokerName === 'ANGEL_ONE');
  const zerodhaInfo = multiStatus.brokers.find((b) => b.brokerName === 'ZERODHA');
  const coindcxInfo = multiStatus.brokers.find((b) => b.brokerName === 'COINDCX');

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.75rem 2rem', marginBottom: '2rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#eef2ff', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', color: '#4338ca', fontWeight: 700, marginBottom: '0.6rem', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
          <Key size={14} /> MULTI-BROKER CONNECTIVITY & SAFETY CONTROLS
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
          Account & Broker Settings
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
          Manage your personal broker accounts with zero shared credentials. All API keys and secrets are encrypted at rest with AES-256-GCM.
        </p>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={24} className="animate-spin" color="#4f46e5" style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ color: '#64748b' }}>Loading account and broker statuses...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* SECTION 1: TRADING MODE & SAFETY CONTROLS */}
          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                  <Shield size={20} color="#4f46e5" /> Trading Mode & Safety Controls
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                  Controls whether order placements execute as simulated fills or route live to connected brokers.
                </p>
              </div>
              <TradingModeBadge mode={multiStatus.tradingMode} size="large" />
            </div>

            {modeSuccess && (
              <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#059669', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <CheckCircle2 size={16} /> {modeSuccess}
              </div>
            )}

            {modeError && (
              <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <AlertTriangle size={16} /> {modeError}
              </div>
            )}

            {/* Mode Selection Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
              
              {/* PAPER MODE CARD */}
              <div
                onClick={() => handleModeToggleClick('PAPER')}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: multiStatus.tradingMode === 'PAPER' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  background: multiStatus.tradingMode === 'PAPER' ? '#eef2ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: multiStatus.tradingMode === 'PAPER' ? '0 2px 8px rgba(79, 70, 229, 0.12)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: '#4338ca' }}>Paper Trading (Default)</span>
                  <Shield size={18} color="#4f46e5" />
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.4', margin: 0 }}>
                  Simulates trades at live market prices with virtual ₹1,00,000 capital. Zero real money at risk.
                </p>
                <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: multiStatus.tradingMode === 'PAPER' ? '#4f46e5' : '#94a3b8', fontWeight: 700 }}>
                  {multiStatus.tradingMode === 'PAPER' ? '✓ Currently Active' : 'Click to select Paper Mode'}
                </div>
              </div>

              {/* LIVE MODE CARD - VISUALLY ALARMING AND PROMINENT */}
              <div
                onClick={() => handleModeToggleClick('LIVE')}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: multiStatus.tradingMode === 'LIVE' ? '2px solid #dc2626' : '1px solid #fca5a5',
                  background: multiStatus.tradingMode === 'LIVE' ? '#fef2f2' : '#fff5f5',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: multiStatus.tradingMode === 'LIVE' ? '0 4px 14px rgba(220, 38, 38, 0.2)' : '0 1px 3px rgba(220, 38, 38, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Live Trading — Real Money
                  </span>
                  <AlertTriangle size={18} color="#dc2626" />
                </div>
                <p style={{ fontSize: '0.82rem', color: '#991b1b', lineHeight: '1.4', margin: 0, fontWeight: 500 }}>
                  Routes real orders directly to your connected broker account. Real capital is at risk. Requires explicit warning confirmation.
                </p>
                <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: '#dc2626', fontWeight: 800 }}>
                  {multiStatus.tradingMode === 'LIVE' ? '⚠️ Live Trading Active — Real Capital' : '⚠️ Requires explicit confirmation modal'}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: MULTI-BROKER CONNECTIONS */}
          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                  <Key size={20} color="#059669" /> Connected Broker Accounts
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                  Connect your individual trading accounts. Each connection is isolated strictly to your user profile.
                </p>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lock size={12} color="#059669" /> Encrypted at Rest (AES-256-GCM)
              </div>
            </div>

            {brokerSuccess && (
              <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#059669', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <CheckCircle2 size={16} /> {brokerSuccess}
              </div>
            )}

            {brokerError && (
              <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <AlertTriangle size={16} /> {brokerError}
              </div>
            )}

            {/* BROKER LIST TABLE / COLUMN LAYOUT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* BROKER ROW 1: ANGEL ONE */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#eef2ff', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontWeight: 800 }}>
                    <Building2 size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>Angel One SmartAPI</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                        NSE / BSE Equities
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {angelOneInfo?.connected ? (
                        <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={13} /> Connected (Client: {angelOneInfo.clientCode || 'Active'})
                          {multiStatus.tradingMode === 'LIVE' && (
                            <span style={{ background: '#fef2f2', color: '#dc2626', padding: '0.1rem 0.4rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, border: '1px solid #fecaca' }}>
                              LIVE TRADING ENABLED
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Not Connected — Connect your SmartAPI credentials to trade</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {angelOneInfo?.connected ? (
                    <>
                      <button
                        onClick={() => handleOpenConnectModal('ANGEL_ONE')}
                        className="btn-secondary"
                        style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <RefreshCw size={13} /> Refresh Session
                      </button>
                      <button
                        onClick={() => setConfirmDisconnectBroker('ANGEL_ONE')}
                        disabled={disconnecting === 'ANGEL_ONE'}
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Trash2 size={13} /> {disconnecting === 'ANGEL_ONE' ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleOpenConnectModal('ANGEL_ONE')}
                      className="btn-primary"
                      style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <ArrowRight size={14} /> Connect Angel One
                    </button>
                  )}
                </div>
              </div>

              {/* BROKER ROW 2: ZERODHA */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c', fontWeight: 800 }}>
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>Zerodha (Kite Connect)</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                        NSE / BSE Equities
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {zerodhaInfo?.connected ? (
                        <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={13} /> Connected with Kite Connect API
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Not Connected — Connect your Kite Connect API Key & Secret</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {zerodhaInfo?.connected ? (
                    <button
                      onClick={() => setConfirmDisconnectBroker('ZERODHA')}
                      disabled={disconnecting === 'ZERODHA'}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Trash2 size={13} /> {disconnecting === 'ZERODHA' ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenConnectModal('ZERODHA')}
                      className="btn-primary"
                      style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ea580c', borderColor: '#ea580c' }}
                    >
                      <ArrowRight size={14} /> Connect Zerodha
                    </button>
                  )}
                </div>
              </div>

              {/* BROKER ROW 3: COINDCX CRYPTO */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1.25rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', fontWeight: 800 }}>
                    <Coins size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>CoinDCX Crypto Exchange</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '12px', background: '#f0fdf4', color: '#15803d', fontWeight: 700, border: '1px solid #bbf7d0' }}>
                        Crypto Spot & Futures
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {coindcxInfo?.connected ? (
                        <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={13} /> Connected with CoinDCX API
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Not Connected — Connect your CoinDCX API Key & Secret</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {coindcxInfo?.connected ? (
                    <button
                      onClick={() => setConfirmDisconnectBroker('COINDCX')}
                      disabled={disconnecting === 'COINDCX'}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <Trash2 size={13} /> {disconnecting === 'COINDCX' ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenConnectModal('COINDCX')}
                      className="btn-primary"
                      style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#059669', borderColor: '#059669' }}
                    >
                      <ArrowRight size={14} /> Connect CoinDCX
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* SECTION 3: AI ASSISTANT EXPLANATION STYLE */}
          <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                <Sparkles size={20} color="#4f46e5" /> AI Assistant Explanation Style
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                Control how the FinPilot AI Assistant communicates findings. All underlying numbers, valuations, risk ratings, and data points remain identical.
              </p>
            </div>

            {styleMessage && (
              <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#059669', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <CheckCircle2 size={16} /> {styleMessage}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {/* Option 1: Simple explanations */}
              <div
                id="settings-style-simple"
                onClick={() => handleExplanationStyleChange('BEGINNER')}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: explanationStyle === 'BEGINNER' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  background: explanationStyle === 'BEGINNER' ? '#f5f3ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: explanationStyle === 'BEGINNER' ? '#4f46e5' : '#0f172a' }}>
                    Simple explanations
                  </span>
                  {explanationStyle === 'BEGINNER' && (
                    <span style={{ background: '#4f46e5', color: '#ffffff', borderRadius: '12px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700 }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, margin: 0 }}>
                  Plain everyday English. Explains financial metrics the first time they are introduced, with short sentences and zero unexplained jargon.
                </p>
              </div>

              {/* Option 2: Technical terms */}
              <div
                id="settings-style-technical"
                onClick={() => handleExplanationStyleChange('ADVANCED')}
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: explanationStyle === 'ADVANCED' ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  background: explanationStyle === 'ADVANCED' ? '#f5f3ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: explanationStyle === 'ADVANCED' ? '#4f46e5' : '#0f172a' }}>
                    Technical terms
                  </span>
                  {explanationStyle === 'ADVANCED' && (
                    <span style={{ background: '#4f46e5', color: '#ffffff', borderRadius: '12px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700 }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, margin: 0 }}>
                  Institutional financial terminology (RSI, MACD, Piotroski score, DCF valuation, Order Blocks, Beta). Unchanged traditional analytical phrasing.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* DISCONNECT CONFIRMATION MODAL */}
      {confirmDisconnectBroker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 350, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '440px', padding: '1.75rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '10px', background: '#fef2f2', color: '#dc2626' }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Disconnect {confirmDisconnectBroker}?</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>This will remove your encrypted credentials from the database.</span>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.4, margin: 0 }}>
              Your encrypted session and API keys for <strong>{confirmDisconnectBroker}</strong> will be permanently deleted. You will revert to Paper Trading for this asset class until reconnected.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setConfirmDisconnectBroker(null)}
                className="btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDisconnect(confirmDisconnectBroker)}
                disabled={!!disconnecting}
                style={{ background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BROKER CONNECTION MODAL */}
      {activeModalBroker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 300, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '520px', padding: '2rem', borderRadius: '16px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {activeModalBroker === 'ANGEL_ONE' && 'Connect Angel One SmartAPI'}
                  {activeModalBroker === 'ZERODHA' && 'Connect Zerodha Kite Connect'}
                  {activeModalBroker === 'COINDCX' && 'Connect CoinDCX Crypto'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Enter your credentials below. Encrypted via AES-256-GCM.
                </span>
              </div>
              <button
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {brokerError && (
              <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <AlertTriangle size={16} /> {brokerError}
              </div>
            )}

            {/* FORM FOR ANGEL ONE */}
            {activeModalBroker === 'ANGEL_ONE' && (
              <form onSubmit={handleConnectAngelOne} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    SmartAPI Key <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. YOUR_SMARTAPI_KEY"
                    value={angelForm.apiKey}
                    onChange={(e) => setAngelForm({ ...angelForm, apiKey: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Client Code <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. YOUR_CLIENT_CODE"
                    value={angelForm.clientCode}
                    onChange={(e) => setAngelForm({ ...angelForm, clientCode: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      Trading MPIN <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="4-digit PIN"
                      maxLength={6}
                      value={angelForm.pin}
                      onChange={(e) => setAngelForm({ ...angelForm, pin: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      TOTP Secret <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showSecret ? 'text' : 'password'}
                        required
                        placeholder="Base32 Key"
                        value={angelForm.totpSecret}
                        onChange={(e) => setAngelForm({ ...angelForm, totpSecret: e.target.value })}
                        style={{ width: '100%', padding: '0.65rem 2.2rem 0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                      >
                        {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                  💡 <strong>Where to find this:</strong> Enable SmartAPI in your Angel One developer dashboard and generate your TOTP secret from your profile security settings.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={handleCloseModal} className="btn-secondary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={connecting} className="btn-primary" style={{ padding: '0.65rem 1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {connecting ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />}
                    {connecting ? 'Validating & Connecting...' : 'Connect Angel One'}
                  </button>
                </div>
              </form>
            )}

            {/* FORM FOR ZERODHA */}
            {activeModalBroker === 'ZERODHA' && (
              <form onSubmit={handleConnectZerodha} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Kite Connect API Key <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Kite API Key"
                    value={zerodhaForm.apiKey}
                    onChange={(e) => setZerodhaForm({ ...zerodhaForm, apiKey: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Kite Connect API Secret <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSecret ? 'text' : 'password'}
                      required
                      placeholder="Kite API Secret"
                      value={zerodhaForm.apiSecret}
                      onChange={(e) => setZerodhaForm({ ...zerodhaForm, apiSecret: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem 2.2rem 0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '0.75rem', fontSize: '0.78rem', color: '#9a3412', lineHeight: 1.4 }}>
                  💡 <strong>Kite Connect:</strong> Generated from your Zerodha Kite Connect developer console. Your credentials are encrypted and stored solely in your private profile.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={handleCloseModal} className="btn-secondary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={connecting} className="btn-primary" style={{ padding: '0.65rem 1.5rem', fontSize: '0.85rem', background: '#ea580c', borderColor: '#ea580c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {connecting ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />}
                    {connecting ? 'Saving & Encrypting...' : 'Connect Zerodha'}
                  </button>
                </div>
              </form>
            )}

            {/* FORM FOR COINDCX */}
            {activeModalBroker === 'COINDCX' && (
              <form onSubmit={handleConnectCoinDcx} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    CoinDCX API Key <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CoinDCX API Key"
                    value={coindcxForm.apiKey}
                    onChange={(e) => setCoindcxForm({ ...coindcxForm, apiKey: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    CoinDCX API Secret <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSecret ? 'text' : 'password'}
                      required
                      placeholder="CoinDCX API Secret"
                      value={coindcxForm.apiSecret}
                      onChange={(e) => setCoindcxForm({ ...coindcxForm, apiSecret: e.target.value })}
                      style={{ width: '100%', padding: '0.65rem 2.2rem 0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', fontSize: '0.78rem', color: '#166534', lineHeight: 1.4 }}>
                  💡 <strong>Security Notice:</strong> HMAC-SHA256 request signatures are generated server-side. Your API secret never leaves the encrypted backend environment.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={handleCloseModal} className="btn-secondary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={connecting} className="btn-primary" style={{ padding: '0.65rem 1.5rem', fontSize: '0.85rem', background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {connecting ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />}
                    {connecting ? 'Saving & Encrypting...' : 'Connect CoinDCX'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* EXPLICIT LIVE TRADING WARNING MODAL */}
      {showWarningModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 400, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '520px', padding: '2rem', borderRadius: '16px', border: '2px solid #dc2626', background: '#ffffff', boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.35)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.65rem', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fca5a5' }}>
                <AlertTriangle size={28} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', margin: 0 }}>WARNING: REAL MONEY AT RISK</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Explicit confirmation required before enabling live mode</span>
              </div>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1.1rem', borderRadius: '10px', fontSize: '0.88rem', color: '#991b1b', lineHeight: '1.5', fontWeight: 500 }}>
              You are about to enable <strong>LIVE TRADING MODE</strong>. Every buy or sell order submitted will execute as a <strong>real trade on the National Stock Exchange (NSE) via your connected broker using real capital</strong>.
              <br /><br />
              Orders cannot be reversed once filled. Please confirm you understand that actual funds will be deducted from your broker account.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowWarningModal(false)}
                className="btn-secondary"
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
              >
                Cancel (Keep Paper Mode)
              </button>

              <button
                onClick={() => executeToggle('LIVE', true)}
                disabled={updatingMode}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1.25rem',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {updatingMode ? <RefreshCw size={16} className="animate-spin" /> : null}
                {updatingMode ? 'Enabling...' : 'I Understand, Enable Live Mode'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
