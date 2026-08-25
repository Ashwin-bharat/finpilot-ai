// User & Auth Types
export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

export interface SignupInput {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// Stock & Market Types
export interface Stock {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  currency: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

export type StockHistoryRange = '1D' | '1W' | '1M' | '1Y' | '5Y' | '1d' | '1w' | '1m' | '1y' | '5y';

export interface StockPricePoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockFundamentals {
  peRatio?: number;
  pbRatio?: number;
  roe?: number;
  roce?: number;
  eps?: number;
  debtToEquity?: number;
  marketCap?: number;
  fiscalPeriod?: string;
}

export interface TechnicalIndicators {
  symbol: string;
  rsi: {
    value: number;
    period: number;
    interpretation: string;
  };
  sma50: {
    value: number;
    differencePercent: number;
  };
  sma200: {
    value: number;
    differencePercent: number;
  };
  maCrossover: {
    status: 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'BULLISH_ALIGNMENT' | 'BEARISH_ALIGNMENT' | 'NEUTRAL';
    interpretation: string;
  };
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    interpretation: string;
  };
  computedAt: string;
}

export interface StockDetail extends Stock {
  priceHistory: StockPricePoint[];
  fundamentals?: StockFundamentals | null;
}

// Portfolio & Transaction Types
export interface PortfolioHolding {
  id: string;
  portfolioId: string;
  stock: Stock;
  quantity: number;
  avgBuyPrice: number;
  currentValue: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  holdings: PortfolioHolding[];
}

export interface Transaction {
  id: string;
  portfolioId: string;
  stock: Stock;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executedAt: string;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
}

export interface PortfolioAnalysis {
  totalInvestment: number;
  currentValue: number;
  totalProfit: number;
  totalProfitPercent: number;
  diversificationScore: number;
  sectorAllocation: SectorAllocation[];
  holdingsCount: number;
}

export interface CreateTransactionInput {
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  portfolioId?: string;
}

// Watchlist Types
export interface WatchlistItem {
  id: string;
  stock: Stock;
  addedAt: string;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  type: 'CUSTOM' | 'AI_GENERATED';
  items: WatchlistItem[];
}

export interface CreateWatchlistInput {
  name: string;
  type?: 'CUSTOM' | 'AI_GENERATED';
}

export interface AddWatchlistItemInput {
  symbol: string;
}

// News Article Types
export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  sentimentConfidence: number;
  summary: string;
  relatedStocks?: string[];
}

export interface NewsResponse {
  articles: NewsArticle[];
  isMock: boolean;
  source: 'marketaux' | 'mock';
}

// AI Assistant & Recommendation Types
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiAnalysisSource {
  type: string;
  description: string;
}

export interface StructuredAiRecommendation {
  summary: string;
  technicalAnalysis: string;
  fundamentalAnalysis: string;
  positives: string[];
  negatives: string[];
  riskLevel: RiskLevel;
  confidenceScore: number; // 0 to 100
  sources: (AiAnalysisSource | string)[];
}

export interface AiChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  structuredAnalysis?: StructuredAiRecommendation;
  createdAt: string;
}

export interface AiChatSession {
  id: string;
  userId?: string;
  title: string;
  createdAt: string;
  messages: AiChatMessage[];
}

export interface SendChatMessageInput {
  sessionId?: string;
  message: string;
  symbolContext?: string;
}

// Market & Top Movers Types
export interface MarketIndex {
  name: string;
  value: string;
  change: string;
  percent: string;
  isPositive: boolean;
}

export interface GainerLoserItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

export interface TopMoversResponse {
  indices: MarketIndex[];
  gainers: GainerLoserItem[];
  losers: GainerLoserItem[];
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  summary: string;
}

export interface DashboardPortfolioSummary {
  totalInvestment: number;
  currentValue: number;
  totalProfit: number;
  totalProfitPercent: number;
}


