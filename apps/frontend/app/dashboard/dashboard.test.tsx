import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from './page';

// Mock dependencies
vi.mock('../../hooks/use-require-auth', () => ({
  useRequireAuth: () => ({
    user: { id: 'user-1', fullName: 'Tester Person', email: 'test@example.com' },
    accessToken: 'mock_token',
    loading: false,
    isReady: true,
  }),
}));

vi.mock('../../lib/market', () => ({
  getTopMoversApi: vi.fn().mockResolvedValue({
    indices: [
      { name: 'NIFTY 50', value: '24,835.40', change: '+142.30', percent: '+0.58%', isPositive: true },
    ],
    gainers: [
      { symbol: 'TCS.NS', name: 'Tata Consultancy Services', price: 4000, changePercent: 1.5 },
    ],
    losers: [],
  }),
}));

vi.mock('../../lib/portfolio', () => ({
  getPortfolioAnalysisApi: vi.fn().mockResolvedValue({
    totalInvestment: 100000,
    currentValue: 120000,
    totalProfit: 20000,
    totalProfitPercent: 20,
    diversificationScore: 85,
    sectorAllocation: [],
    holdingsCount: 1,
  }),
}));

vi.mock('../../lib/news', () => ({
  getNewsApi: vi.fn().mockResolvedValue({
    articles: [],
    isMock: true,
  }),
}));

describe('DashboardPage - Smoke Test', () => {
  it('renders dashboard page heading and user welcome banner without crashing', async () => {
    render(<DashboardPage />);

    expect(await screen.findByText(/Welcome back, Tester/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-POWERED PORTFOLIO CO-PILOT/i)).toBeInTheDocument();
  });
});
