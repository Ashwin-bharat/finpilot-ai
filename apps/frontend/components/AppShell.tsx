'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, Bot, Sparkles } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('finpilot_sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('finpilot_sidebar_collapsed', String(next));
      return next;
    });
  };

  const isAuthRoute = pathname === '/login' || pathname === '/signup';

  // If on auth routes (/login, /signup), render children cleanly without sidebar
  if (isAuthRoute) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#fafaf9' }}>
        {children}
      </main>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#fafaf9' }}>
      {/* Mobile Top Header (Visible only on small viewports) */}
      <header
        className="mobile-top-bar"
        style={{
          display: 'none',
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
          zIndex: 80,
          padding: '0 1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#0f172a',
            cursor: 'pointer',
            padding: '0.4rem',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>

        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bot size={16} color="white" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            FinPilot <span style={{ color: '#4f46e5' }}>AI</span>
          </span>
        </Link>

        <Link
          href="/assistant"
          style={{
            background: '#eef2ff',
            border: '1px solid rgba(79, 70, 229, 0.3)',
            borderRadius: '6px',
            color: '#4338ca',
            padding: '0.35rem 0.6rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <Sparkles size={13} />
          <span>AI</span>
        </Link>
      </header>

      {/* Global Desktop & Mobile Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Beside Sidebar */}
      <div
        className="main-content-container"
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: mounted ? (collapsed ? '72px' : '260px') : '260px',
          transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fafaf9',
        }}
      >
        <main
          style={{
            flex: 1,
            width: '100%',
            maxWidth: '1440px',
            margin: '0 auto',
            padding: '2rem 2rem 3.5rem 2rem',
          }}
          className="app-main-view"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
