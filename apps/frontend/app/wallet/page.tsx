'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import {
  Wallet,
  WalletTransaction,
  WalletTransactionType,
} from '@finpilot/shared-types';
import {
  getWalletApi,
  createTopupOrderApi,
  verifyTopupApi,
  getWalletTransactionsApi,
} from '../../lib/wallet';
import {
  Wallet as WalletIcon,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  CreditCard,
  TrendingUp,
  History,
  X,
  ExternalLink,
} from 'lucide-react';

export default function WalletPage() {
  const { user, accessToken } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'TOPUP' | 'PAPER_TRADE'>('ALL');
  const [page, setPage] = useState(1);

  // Top-Up Modal State
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<string>('1000');
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [topupSuccess, setTopupSuccess] = useState<string | null>(null);

  const presetAmounts = [500, 1000, 2500, 5000, 10000, 25000];

  // Fetch Wallet & Transactions
  const fetchWalletData = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [walletRes, txRes] = await Promise.all([
        getWalletApi(accessToken),
        getWalletTransactionsApi(accessToken, page, 15),
      ]);
      setWallet(walletRes);
      setTransactions(txRes.transactions);
      setTotalTransactions(txRes.total);
    } catch (err: any) {
      console.error('Failed to load wallet:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, page]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
  };

  // Dynamically load Razorpay Checkout Script
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Handle Top-Up Flow (Razorpay UPI / Test Mode)
  const handleInitiateTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setTopupError('Please sign in to add funds.');
      return;
    }

    const amountNum = parseFloat(topupAmount);
    if (isNaN(amountNum) || amountNum < 10) {
      setTopupError('Minimum top-up amount is ₹10');
      return;
    }

    if (amountNum > 500000) {
      setTopupError('Maximum top-up amount is ₹5,00,000');
      return;
    }

    setTopupSubmitting(true);
    setTopupError(null);
    setTopupSuccess(null);

    try {
      // 1. Create order on backend
      const orderRes = await createTopupOrderApi(amountNum, accessToken);

      // 2. Load Razorpay Checkout SDK
      const isLoaded = await loadRazorpayScript();

      if (isLoaded && (window as any).Razorpay && orderRes.keyId.startsWith('rzp_live')) {
        // Live/Real Razorpay Modal
        const options = {
          key: orderRes.keyId,
          amount: orderRes.amount,
          currency: orderRes.currency,
          name: 'FinPilot AI',
          description: 'Paper Trading Simulation Wallet Top-Up',
          order_id: orderRes.orderId,
          prefill: {
            name: user?.fullName || 'Trader',
            email: user?.email || '',
          },
          theme: {
            color: '#6366f1',
          },
          handler: async function (response: any) {
            try {
              const verifyRes = await verifyTopupApi(
                {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  amount: amountNum,
                },
                accessToken,
              );
              setTopupSuccess(verifyRes.message);
              setWallet(verifyRes.wallet);
              fetchWalletData();
              setTimeout(() => {
                setTopupModalOpen(false);
                setTopupSuccess(null);
              }, 1800);
            } catch (err: any) {
              setTopupError(err.message || 'Signature verification failed.');
            }
          },
          modal: {
            ondismiss: function () {
              setTopupSubmitting(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Test Mode Simulation (Instant Verification)
        const mockPaymentId = `pay_test_${Date.now()}`;
        const mockSignature = `test_sig_${orderRes.orderId}_${mockPaymentId}`;

        const verifyRes = await verifyTopupApi(
          {
            razorpayOrderId: orderRes.orderId,
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: mockSignature,
            amount: amountNum,
          },
          accessToken,
        );

        setTopupSuccess(`✓ Added ₹${amountNum.toLocaleString('en-IN')} to your paper wallet (Razorpay Test Mode).`);
        setWallet(verifyRes.wallet);
        fetchWalletData();
        setTimeout(() => {
          setTopupModalOpen(false);
          setTopupSuccess(null);
        }, 1500);
      }
    } catch (err: any) {
      setTopupError(err.message || 'Failed to complete top-up.');
    } finally {
      setTopupSubmitting(false);
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filterType === 'TOPUP') return tx.type === 'TOPUP';
    if (filterType === 'PAPER_TRADE') return tx.type === 'PAPER_TRADE_DEBIT' || tx.type === 'PAPER_TRADE_CREDIT';
    return true;
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        padding: '2rem 1.5rem',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header Strip */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.75rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                }}
              >
                <WalletIcon size={20} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Paper Trading Wallet
              </h1>
            </div>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.88rem', color: '#64748b' }}>
              Real-money UPI top-ups funding simulated market paper orders with live execution feeds
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.55rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setTopupModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1.25rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <PlusCircle size={16} />
              Add Money
            </button>
          </div>
        </div>

        {/* Permanent Mandatory Disclaimer Notice */}
        <div
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '0.9rem 1.2rem',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <AlertCircle size={20} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <span style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.88rem' }}>
              Brokerage Isolation Disclaimer:
            </span>{' '}
            <span style={{ color: '#1e3a8a', fontSize: '0.86rem', lineHeight: '1.4' }}>
              This wallet funds <strong>paper trading simulations only</strong>. It is <strong>not connected</strong> to your live Angel One or external brokerage account, and cannot execute real-money stock exchange transactions.
            </span>
          </div>
        </div>

        {/* Top Cards Row: Generic Minimalist Balance Card & Quick Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          {/* Card 1: Generic Minimal Digital Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              borderRadius: '20px',
              padding: '1.75rem',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '220px',
            }}
          >
            {/* Card Background Glow */}
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, rgba(99, 102, 241, 0) 70%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', fontWeight: 600 }}>
                  FinPilot Paper Account
                </span>
                <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>
                  Simulated Cash Ledger
                </h3>
              </div>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#a5b4fc',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <ShieldCheck size={12} />
                TEST MODE
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Available Balance</span>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
                ₹{loading ? '...' : (wallet?.balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                Account: {user?.fullName || 'Active Trader'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Currency: INR (₹)
              </span>
            </div>
          </div>

          {/* Card 2: Quick Actions & Overview Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '1.75rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Quick Top-Up via UPI
              </h3>
              <p style={{ margin: 0, fontSize: '0.83rem', color: '#64748b' }}>
                Select a preset amount to top-up instantly through Razorpay simulated checkout.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.6rem',
                  margin: '1rem 0',
                }}
              >
                {presetAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setTopupAmount(amt.toString());
                      setTopupModalOpen(true);
                    }}
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.6rem 0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eef2ff';
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.color = '#4338ca';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#1e293b';
                    }}
                  >
                    +₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '0.75rem',
                borderTop: '1px solid #f1f5f9',
                fontSize: '0.8rem',
                color: '#64748b',
              }}
            >
              <span>Instant Confirmation</span>
              <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={13} /> 100% Server Verified
              </span>
            </div>
          </div>
        </div>

        {/* Transaction History Section */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            padding: '1.75rem',
          }}
        >
          {/* Section Header with Tabs */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} color="#4f46e5" />
                Ledger Activity & History
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Showing {filteredTransactions.length} of {totalTransactions} total entries
              </span>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
              {(['ALL', 'TOPUP', 'PAPER_TRADE'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterType(tab)}
                  style={{
                    backgroundColor: filterType === tab ? '#ffffff' : 'transparent',
                    color: filterType === tab ? '#0f172a' : '#64748b',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: filterType === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab === 'ALL' ? 'All Activity' : tab === 'TOPUP' ? 'Top-Ups' : 'Paper Trades'}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions List / Table */}
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} color="#4f46e5" />
              <span>Loading ledger history...</span>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div
              style={{
                padding: '3.5rem 1rem',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <WalletIcon size={36} color="#cbd5e1" style={{ margin: '0 auto 0.75rem auto' }} />
              <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.98rem', fontWeight: 700, color: '#334155' }}>
                No Ledger Transactions Found
              </h4>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.83rem', color: '#64748b' }}>
                Add funds via UPI or execute simulated paper orders on the stock terminal to see activity here.
              </p>
              <button
                onClick={() => setTopupModalOpen(true)}
                style={{
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Add First Top-Up
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Transaction</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const isCredit = tx.type === 'TOPUP' || tx.type === 'PAPER_TRADE_CREDIT';
                    const isTopup = tx.type === 'TOPUP';

                    return (
                      <tr
                        key={tx.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Transaction Name & Icon */}
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isTopup
                                  ? '#ecfdf5'
                                  : isCredit
                                  ? '#f0fdf4'
                                  : '#fef2f2',
                                color: isTopup
                                  ? '#059669'
                                  : isCredit
                                  ? '#16a34a'
                                  : '#dc2626',
                              }}
                            >
                              {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                {tx.description || (isTopup ? 'UPI Wallet Deposit' : 'Paper Market Order')}
                              </div>
                              {tx.razorpayPaymentId && (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                  Ref: {tx.razorpayPaymentId}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              backgroundColor: isTopup
                                ? '#e0e7ff'
                                : isCredit
                                ? '#dcfce7'
                                : '#fee2e2',
                              color: isTopup
                                ? '#4338ca'
                                : isCredit
                                ? '#15803d'
                                : '#b91c1c',
                            }}
                          >
                            {tx.type.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Date */}
                        <td style={{ padding: '0.9rem 1rem', color: '#64748b', fontSize: '0.82rem' }}>
                          {new Date(tx.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: tx.status === 'SUCCESS' ? '#059669' : tx.status === 'PENDING' ? '#d97706' : '#dc2626',
                            }}
                          >
                            {tx.status === 'SUCCESS' ? (
                              <CheckCircle2 size={13} />
                            ) : tx.status === 'PENDING' ? (
                              <Clock size={13} />
                            ) : (
                              <AlertCircle size={13} />
                            )}
                            {tx.status}
                          </span>
                        </td>

                        {/* Amount */}
                        <td
                          style={{
                            padding: '0.9rem 1rem',
                            textAlign: 'right',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            color: isCredit ? '#059669' : '#dc2626',
                          }}
                        >
                          {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top-Up Modal with Razorpay UPI & Preset Controls */}
      {topupModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '460px',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              color: '#0f172a',
            }}
          >
            {/* Modal Close Button */}
            <button
              onClick={() => {
                setTopupModalOpen(false);
                setTopupError(null);
                setTopupSuccess(null);
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
              }}
            >
              <X size={20} />
            </button>

            {/* Modal Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#eef2ff',
                  color: '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlusCircle size={18} />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>
                Add Money to Paper Wallet
              </h2>
            </div>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.84rem', color: '#64748b' }}>
              Top-up via UPI / Razorpay test mode to fund simulated paper orders.
            </p>

            {/* Modal Disclaimer */}
            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '0.6rem 0.8rem',
                fontSize: '0.78rem',
                color: '#1e3a8a',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ShieldCheck size={16} color="#2563eb" style={{ flexShrink: 0 }} />
              <span>Funds paper simulations only · Isolated from live broker.</span>
            </div>

            {/* Top-up Form */}
            <form onSubmit={handleInitiateTopup}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                Amount (₹ INR)
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.6rem 0.9rem',
                  marginBottom: '1rem',
                  backgroundColor: '#ffffff',
                }}
              >
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginRight: '0.4rem' }}>
                  ₹
                </span>
                <input
                  type="number"
                  min="10"
                  max="500000"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="1000"
                  required
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                />
              </div>

              {/* Preset Chips */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {presetAmounts.map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setTopupAmount(amt.toString())}
                    style={{
                      backgroundColor: topupAmount === amt.toString() ? '#4f46e5' : '#f1f5f9',
                      color: topupAmount === amt.toString() ? '#ffffff' : '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              {/* Error & Success Messages */}
              {topupError && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                  }}
                >
                  {topupError}
                </div>
              )}

              {topupSuccess && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#047857',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                  }}
                >
                  {topupSuccess}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={topupSubmitting}
                style={{
                  width: '100%',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: topupSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {topupSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    Pay ₹{parseFloat(topupAmount || '0').toLocaleString('en-IN')} via Razorpay UPI
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
