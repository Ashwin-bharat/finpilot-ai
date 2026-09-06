import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from './page';
import { AssetClassProvider } from '../../context/asset-class-context';

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

vi.mock('../../lib/crypto', () => ({
  getCryptoTopMoversApi: vi.fn().mockResolvedValue({
    indices: [
      { name: 'BITCOIN (BTC)', value: '₹58,45,200', change: '+₹1,24,500', percent: '+2.18%', isPositive: true },
    ],
    gainers: [
      { symbol: 'BTC', name: 'Bitcoin', price: 5845200, changePercent: 2.18 },
    ],
    losers: [],
    topCoins: [],
  }),
  getCryptoPortfolioApi: vi.fn().mockResolvedValue({
    id: 'cport-1',
    userId: 'user-1',
    name: 'Crypto Portfolio',
    totalValue: 50000,
    dayChange: 1200,
    dayChangePercent: 2.4,
    holdings: [],
  }),
}));

vi.mock('../../lib/portfolio', () => ({
  getPortfolioApi: vi.fn().mockResolvedValue({
    id: 'port-1',
    userId: 'user-1',
    name: 'Default Portfolio',
    totalValue: 120000,
    dayChange: 1500,
    dayChangePercent: 1.25,
    holdings: [
      {
        id: 'h-1',
        portfolioId: 'port-1',
        stock: { id: 's-1', symbol: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'IT Services', exchange: 'NSE', currency: 'INR', currentPrice: 4000 },
        quantity: 30,
        avgBuyPrice: 3333.33,
        currentValue: 120000,
        totalReturn: 20000,
        totalReturnPercent: 20,
      },
    ],
  }),
  getPortfolioAnalysisApi: vi.fn().mockResolvedValue({
    totalInvestment: 100000,
    currentValue: 120000,
    totalProfit: 20000,
    totalProfitPercent: 20,
    diversificationScore: 85,
    sectorAllocation: [{ sector: 'IT Services', value: 120000, percentage: 100 }],
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
    render(
      <AssetClassProvider>
        <DashboardPage />
      </AssetClassProvider>,
    );

    expect(await screen.findByText(/Welcome back, Tester/i)).toBeInTheDocument();
    expect(screen.getByText(/LIVE FINANCIAL DASHBOARD/i)).toBeInTheDocument();
  });
});
