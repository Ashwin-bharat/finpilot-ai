'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Bookmark,
  Bot,
  Settings,
  Sparkles,
  Wallet as WalletIcon,
  LogOut,
  LogIn,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/auth-context';
import StockSearchBar from './StockSearchBar';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Markets',
      href: '/markets',
      icon: TrendingUp,
      isActive: (p: string) => p.startsWith('/markets') || p.startsWith('/stock') || p.startsWith('/crypto'),
    },
    {
      name: 'Portfolio',
      href: '/portfolio',
      icon: Briefcase,
      isActive: (p: string) => p.startsWith('/portfolio'),
    },
    {
      name: 'Wallet',
      href: '/wallet',
      icon: WalletIcon,
      isActive: (p: string) => p.startsWith('/wallet'),
    },
    {
      name: 'Watchlist',
      href: '/watchlist',
      icon: Bookmark,
      isActive: (p: string) => p.startsWith('/watchlist'),
    },
    {
      name: 'AI Assistant',
      href: '/assistant',
      icon: Bot,
      isActive: (p: string) => p.startsWith('/assistant'),
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      isActive: (p: string) => p.startsWith('/settings'),
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
          className="mobile-backdrop"
        />
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: collapsed ? '72px' : '260px',
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '1px 0 4px rgba(0, 0, 0, 0.02)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s ease',
          overflow: 'hidden',
        }}
        className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Top Section: Logo & Search & Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
          
          {/* Logo / Header */}
          <div
            style={{
              padding: collapsed ? '1.25rem 0.75rem' : '1.25rem 1.25rem 1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <Link
              href="/dashboard"
              onClick={onCloseMobile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                  flexShrink: 0,
                }}
              >
                <Bot size={20} color="white" />
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
                    FinPilot <span style={{ color: '#4f46e5' }}>AI</span>
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.06em' }}>
                    FINANCIAL INTELLIGENCE
                  </div>
                </div>
              )}
            </Link>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="mobile-close-btn"
              style={{
                display: 'none',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Search Bar */}
          <div
            style={{
              padding: collapsed ? '0.85rem 0.5rem' : '1rem 1.1rem 0.6rem 1.1rem',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {collapsed ? (
              <button
                onClick={onToggleCollapse}
                title="Search stocks"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Search size={16} />
              </button>
            ) : (
              <div style={{ width: '100%' }}>
                <StockSearchBar />
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              padding: collapsed ? '0.5rem 0.5rem' : '0.5rem 0.85rem',
            }}
          >
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = item.isActive ? item.isActive(pathname) : pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onCloseMobile}
                  title={collapsed ? item.name : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: collapsed ? 0 : '0.75rem',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '0.7rem 0' : '0.65rem 0.85rem',
                    borderRadius: '9px',
                    textDecoration: 'none',
                    fontSize: '0.88rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#4338ca' : '#475569',
                    background: active ? '#eef2ff' : 'transparent',
                    border: active ? '1px solid rgba(79, 70, 229, 0.25)' : '1px solid transparent',
                    boxShadow: active ? '0 1px 3px rgba(79, 70, 229, 0.1)' : 'none',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                  className="sidebar-nav-item"
                >
                  <Icon
                    size={18}
                    color={active ? '#4f46e5' : '#64748b'}
                    style={{ flexShrink: 0 }}
                  />
                  {!collapsed && (
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Prominent "Ask FinPilot AI" Button */}
          <div
            style={{
              padding: collapsed ? '0.6rem 0.5rem' : '0.75rem 0.85rem',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Link
              href="/assistant"
              onClick={onCloseMobile}
              title={collapsed ? 'Ask FinPilot AI' : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: collapsed ? '0.65rem 0' : '0.65rem 1rem',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                boxShadow: '0 3px 12px rgba(79, 70, 229, 0.28)',
                transition: 'all 0.18s ease',
              }}
            >
              <Sparkles size={16} />
              {!collapsed && <span>Ask FinPilot AI</span>}
            </Link>
          </div>

        </div>

        {/* Bottom Section: User Info & Collapse Toggle */}
        <div
          style={{
            borderTop: '1px solid #f1f5f9',
            padding: collapsed ? '0.75rem 0.5rem' : '0.85rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            background: '#fafaf9',
          }}
        >
          {/* User Account / Auth Actions */}
          {user ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                padding: collapsed ? '0.35rem 0' : '0.45rem 0.6rem',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              {!collapsed ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#eef2ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4f46e5',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        flexShrink: 0,
                      }}
                    >
                      <UserIcon size={14} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.fullName || 'Investor'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {user.email || 'Active Account'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => logout()}
                    title="Sign Out"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '0.35rem',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                  >
                    <LogOut size={15} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => logout()}
                  title={`Signed in as ${user.fullName || 'User'} - Click to Sign Out`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '0.4rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              onClick={onCloseMobile}
              title={collapsed ? 'Sign In' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '0.5rem',
                padding: collapsed ? '0.6rem 0' : '0.5rem 0.75rem',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <LogIn size={15} color="#4f46e5" />
              {!collapsed && <span>Sign In</span>}
            </Link>
          )}

          {/* Collapse Sidebar Toggle */}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.5rem',
              padding: collapsed ? '0.55rem 0' : '0.55rem 0.65rem',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
            className="collapse-toggle-btn"
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span>Collapse sidebar</span>
              </>
            )}
          </button>
        </div>

      </aside>
    </>
  );
}
