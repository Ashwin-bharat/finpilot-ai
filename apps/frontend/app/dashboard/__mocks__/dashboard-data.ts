import { MarketIndex, GainerLoserItem, NewsItem, DashboardPortfolioSummary } from '@finpilot/shared-types';

export const MOCK_MARKET_INDICES: MarketIndex[] = [
  { name: 'NIFTY 50', value: '24,835.40', change: '+142.30', percent: '+0.58%', isPositive: true },
  { name: 'SENSEX', value: '81,332.15', change: '+418.90', percent: '+0.52%', isPositive: true },
  { name: 'BANK NIFTY', value: '52,240.80', change: '-85.40', percent: '-0.16%', isPositive: false },
  { name: 'NIFTY IT', value: '41,120.60', change: '+512.10', percent: '+1.26%', isPositive: true },
];

export const MOCK_TOP_GAINERS: GainerLoserItem[] = [
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Ltd.', price: 998.75, changePercent: 3.54 },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd.', price: 1450.30, changePercent: 1.55 },
  { symbol: 'INFY.NS', name: 'Infosys Limited', price: 1542.80, changePercent: 1.22 },
];

export const MOCK_TOP_LOSERS: GainerLoserItem[] = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd.', price: 2980.10, changePercent: -0.42 },
];

export const MOCK_NEWS_FEED: NewsItem[] = [
  {
    id: 'n1',
    title: 'TCS Signs Multi-Year Digital Transformation Deal with Top European Bank',
    source: 'Financial Express',
    time: '2h ago',
    sentiment: 'POSITIVE',
    summary: 'Tata Consultancy Services secured a landmark 5-year cloud contract worth over $450M.',
  },
  {
    id: 'n2',
    title: 'Tata Motors Reports 18% YoY SUV Sales Surge in Q3',
    source: 'Economic Times',
    time: '5h ago',
    sentiment: 'POSITIVE',
    summary: 'Driven by robust EV and Nexon SUV demand, Tata Motors recorded strong volume gains.',
  },
];

export const MOCK_PORTFOLIO_SUMMARY: DashboardPortfolioSummary = {
  totalInvestment: 172500,
  currentValue: 197186,
  totalProfit: 24686,
  totalProfitPercent: 14.3,
};
