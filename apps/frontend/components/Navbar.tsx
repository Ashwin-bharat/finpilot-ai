'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, Briefcase, Bookmark, Bot, LogIn, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import StockSearchBar from './StockSearchBar';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Markets', href: '/markets', icon: TrendingUp },
    { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
    { name: 'Watchlist', href: '/watchlist', icon: Bookmark },
    { name: 'AI Assistant', href: '/assistant', icon: Bot },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <header style={{ borderBottom: '1px solid #e2e8f0', background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        
        {/* Brand Logo */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(79, 70, 229, 0.3)'
          }}>
            <Bot size={22} color="white" />
          </div>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
              FinPilot <span style={{ color: '#4f46e5' }}>AI</span>
            </span>
            <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
              FINANCIAL INTELLIGENCE
            </div>
          </div>
        </Link>

        {/* Global Stock Search Bar */}
        <StockSearchBar />

        {/* Navigation Items */}
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: isActive ? '#4338ca' : '#64748b',
                  background: isActive ? '#eef2ff' : 'transparent',
                  border: isActive ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} color={isActive ? '#4f46e5' : '#64748b'} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155', fontSize: '0.85rem', fontWeight: 600 }}>
                <UserIcon size={14} color="#4f46e5" />
                <span>{user.fullName}</span>
              </div>
              <button
                onClick={() => logout()}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          ) : (
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <LogIn size={15} />
                Sign In
              </button>
            </Link>
          )}
          <Link href="/assistant" style={{ textDecoration: 'none' }}>
            <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Ask FinPilot AI
            </button>
          </Link>
        </div>

      </div>
    </header>
  );
}
