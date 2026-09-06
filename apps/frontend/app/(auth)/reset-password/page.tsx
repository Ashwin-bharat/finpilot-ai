'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, AlertCircle, CheckCircle2, Lock, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { resetPasswordApi } from '../../../lib/auth';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tokenParam = searchParams.get('token') || '';
  const [token, setToken] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError('Reset token is missing. Please use the link provided in your email.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordApi(trimmedToken, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      {/* Brand Pill */}
      <div style={styles.badgeWrapper}>
        <div style={styles.brandBadge}>
          <Sparkles size={12} color="#38bdf8" />
          <span style={styles.brandBadgeText}>FINPILOT AI</span>
        </div>
      </div>

      {success ? (
        <div style={styles.successWrapper}>
          <div style={styles.successIconWrapper}>
            <CheckCircle2 size={36} color="#10b981" />
          </div>
          <h1 style={styles.title}>Password Reset Complete</h1>
          <p style={styles.subtitle}>
            Your password has been successfully updated. All active sessions have been signed out for security.
          </p>
          <div style={{ marginTop: '1.75rem', width: '100%' }}>
            <Link href="/login" style={styles.submitButton}>
              Sign In with New Password
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div style={styles.header}>
            <h1 style={styles.title}>Set New Password</h1>
            <p style={styles.subtitle}>
              Choose a strong, unique password for your FinPilot AI account
            </p>
          </div>

          {error && (
            <div style={styles.errorBox} role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            {!tokenParam && (
              <div style={styles.fieldGroup}>
                <label style={styles.label} htmlFor="token">
                  Reset Token
                </label>
                <div style={styles.inputWrapper}>
                  <KeyRound size={16} color="#64748b" style={styles.inputIcon} />
                  <input
                    id="token"
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste reset token from email"
                    required
                    style={styles.input}
                  />
                </div>
              </div>
            )}

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="newPassword">
                New Password (min 8 characters)
              </label>
              <div style={styles.inputWrapper}>
                <Lock size={16} color="#64748b" style={styles.inputIcon} />
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...styles.input, paddingRight: '2.5rem' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={styles.passwordToggleBtn}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
                </button>
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <div style={styles.inputWrapper}>
                <Lock size={16} color="#64748b" style={styles.inputIcon} />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={styles.input}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitButton,
                opacity: loading ? 0.75 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>

          <div style={styles.footer}>
            <Link href="/login" style={styles.backLink}>
              Remembered your password? Sign In
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={styles.container}>
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />
      <Suspense
        fallback={
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 size={24} className="animate-spin" color="#38bdf8" />
            </div>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#07090e',
    backgroundImage: `
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37, 99, 235, 0.15), transparent),
      radial-gradient(ellipse 60% 40% at 50% 120%, rgba(14, 165, 233, 0.10), transparent)
    `,
    padding: '1.5rem',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
  },
  bgGlow1: {
    position: 'absolute',
    top: '20%',
    left: '25%',
    width: '320px',
    height: '320px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
    filter: 'blur(40px)',
    pointerEvents: 'none',
  },
  bgGlow2: {
    position: 'absolute',
    bottom: '20%',
    right: '25%',
    width: '360px',
    height: '360px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
    filter: 'blur(50px)',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '1.25rem',
    padding: '2.25rem',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    zIndex: 1,
  },
  badgeWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
  brandBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.35rem 0.85rem',
    borderRadius: '9999px',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.25)',
  },
  brandBadgeText: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#38bdf8',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.625rem',
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 0.5rem 0',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    margin: 0,
    lineHeight: 1.5,
  },
  successWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '1rem 0',
  },
  successIconWrapper: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.625rem',
    padding: '0.75rem 1rem',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '0.5rem',
    color: '#fca5a5',
    fontSize: '0.8125rem',
    marginBottom: '1.25rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.125rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#cbd5e1',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '0.875rem',
    pointerEvents: 'none',
  },
  passwordToggleBtn: {
    position: 'absolute',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '0.625rem',
    color: '#f8fafc',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#0284c7',
    backgroundImage: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '0.875rem',
    borderRadius: '0.625rem',
    border: 'none',
    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
    textDecoration: 'none',
    boxSizing: 'border-box',
  },
  footer: {
    marginTop: '1.5rem',
    display: 'flex',
    justifyContent: 'center',
  },
  backLink: {
    color: '#94a3b8',
    fontSize: '0.8125rem',
    textDecoration: 'none',
  },
};
