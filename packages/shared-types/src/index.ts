// User & Auth Types
export type ExplanationStyle = 'BEGINNER' | 'ADVANCED';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  explanationStyle?: ExplanationStyle;
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

export type StockQuote = Partial<Stock> & {
  symbol: string;
  currentPrice?: number;
  changePercent?: number;
  [key: string]: any;
};

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
  exchanges?: string[];
  exchangeSymbols?: Record<string, string>;
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

// Phase 3: Advanced Technical Analysis Types
export type VolatilityRegime = 'LOW_VOLATILITY' | 'MODERATE_VOLATILITY' | 'HIGH_VOLATILITY';

export interface AtrResult {
  value: number;
  period: number;
  relativeAtrPercent: number;
  volatilityRegime: VolatilityRegime;
  stopLossBuffer: {
    multiplier1_5: number;
    multiplier2_0: number;
    recommendedStopDistance: number;
    recommendedStopPrice: number;
  };
  interpretation: string;
}

export type BollingerBandSqueezeStatus = 'SQUEEZE_EXPANSION' | 'SQUEEZE_CONTRACTION' | 'NORMAL';

export interface BollingerBandsResult {
  middleBand: number; // 20 SMA
  upperBand: number;  // +2 std dev
  lowerBand: number;  // -2 std dev
  percentB: number;   // (Price - Lower) / (Upper - Lower)
  bandwidthPercent: number; // (Upper - Lower) / Middle * 100
  squeezeStatus: BollingerBandSqueezeStatus;
  interpretation: string;
}

export type StochasticMomentumStatus =
  | 'OVERBOUGHT'
  | 'OVERSOLD'
  | 'BULLISH_MOMENTUM'
  | 'BEARISH_MOMENTUM'
  | 'NEUTRAL';

export interface StochasticResult {
  kValue: number; // %K (14-period)
  dValue: number; // %D (3-period SMA of %K)
  status: StochasticMomentumStatus;
  crossoverSignal: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NONE';
  interpretation: string;
}

export type InstitutionalBias = 'BUYER_CONTROL' | 'SELLER_CONTROL' | 'NEUTRAL_EQUILIBRIUM';

export interface VwapResult {
  vwap: number;
  differencePercent: number;
  bias: InstitutionalBias;
  interpretation: string;
}

export interface PivotLevels {
  pivotPoint: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
}

export interface SupportResistanceResult {
  floorPivots: PivotLevels;
  swingHighResistance: number;
  swingLowSupport: number;
  nearestSupport: { level: number; distancePercent: number; label: string };
  nearestResistance: { level: number; distancePercent: number; label: string };
  interpretation: string;
}

export type TimeframeTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface MultiTimeframeSummary {
  dailyTrend: TimeframeTrend;
  weeklyTrend: TimeframeTrend;
  alignment: 'ALIGNED_BULLISH' | 'ALIGNED_BEARISH' | 'CONFLICTING_TIMEFRAMES';
  interpretation: string;
}

export type TechnicalRating = 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';

export interface TechnicalEngineResult {
  symbol: string;
  currentPrice: number;
  atr: AtrResult;
  bollingerBands: BollingerBandsResult;
  stochastic: StochasticResult;
  vwap: VwapResult;
  supportResistance: SupportResistanceResult;
  multiTimeframe: MultiTimeframeSummary;
  confluenceScore: number; // 0 to 100
  rating: TechnicalRating;
  keyTakeaways: string[];
  computedAt: string;
}

// Phase 4: Market Structure Engine Types
export type StructuralTrend =
  | 'BULLISH_EXPANSION'
  | 'BEARISH_EXPANSION'
  | 'RANGE_ACCUMULATION'
  | 'STRUCTURE_SHIFT_BULLISH'
  | 'STRUCTURE_SHIFT_BEARISH';

export interface SwingPoint {
  index: number;
  timestamp: string;
  type: 'SWING_HIGH' | 'SWING_LOW';
  price: number;
  label: 'HH' | 'LH' | 'HL' | 'LL';
}

export type OrderBlockType = 'BULLISH_DEMAND' | 'BEARISH_SUPPLY';

export interface OrderBlock {
  type: OrderBlockType;
  candleIndex: number;
  timestamp: string;
  high: number;
  low: number;
  mitigated: boolean;
  mitigatedAt?: string;
  significance: 'HIGH' | 'MEDIUM';
}

export type FvgType = 'BULLISH_IMBALANCE' | 'BEARISH_IMBALANCE';

export interface FairValueGap {
  type: FvgType;
  startIndex: number;
  timestamp: string;
  top: number;
  bottom: number;
  size: number;
  sizePercent: number;
  filled: boolean;
  currentProximityPercent: number;
}

export interface LiquiditySweep {
  type: 'BUYSIDE_LIQUIDITY_SWEEP' | 'SELLSIDE_LIQUIDITY_SWEEP';
  sweepPrice: number;
  swingPrice: number;
  timestamp: string;
  reversalConfirmed: boolean;
  interpretation: string;
}

export interface DealingRange {
  rangeHigh: number;
  rangeLow: number;
  equilibrium: number; // 50% midpoint
  currentZone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';
  relativePositionPercent: number; // 0% at range low, 100% at range high
  optimalTradeEntry: {
    fib618: number;
    fib786: number;
  };
}

export interface MarketStructureResult {
  symbol: string;
  currentPrice: number;
  trend: StructuralTrend;
  lastStructureShift?: string;
  swingPoints: SwingPoint[];
  orderBlocks: OrderBlock[];
  activeOrderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  unfilledFvgs: FairValueGap[];
  liquiditySweeps: LiquiditySweep[];
  dealingRange: DealingRange;
  structureRating: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  institutionalNarrative: string;
  keyStructureTakeaways: string[];
  computedAt: string;
}

// Phase 5: Fundamental Analysis Engine Types
export interface DcfValuation {
  intrinsicValue: number;
  currentPrice: number;
  marginOfSafetyPercent: number;
  valuationStatus: 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED';
  assumptions: {
    discountRate: number; // e.g. 0.11 (11%)
    terminalGrowthRate: number; // e.g. 0.05 (5%)
    projectedGrowthRate: number; // e.g. 0.12 (12%)
    projectionYears: number; // 5
  };
  projectedCashFlows: number[];
  terminalValue: number;
  pvTerminalValue: number;
}

export interface GrahamValuation {
  grahamNumber: number | null;
  bvps: number | null; // Book Value Per Share
  eps: number;
  premiumOrDiscountPercent: number | null;
  valuationStatus: 'GRAHAM_DISCOUNT' | 'GRAHAM_PREMIUM' | 'NOT_APPLICABLE';
}

export interface PiotroskiScore {
  score: number; // 0 - 9
  rating: 'STRONG' | 'MODERATE' | 'WEAK';
  profitabilityScore: number; // 0 - 4
  leverageScore: number; // 0 - 3
  operatingEfficiencyScore: number; // 0 - 2
  criteriaBreakdown: {
    positiveNetIncome: boolean;
    positiveRoe: boolean;
    positiveRoce: boolean;
    cashGenerationQuality: boolean;
    conservativeLeverage: boolean;
    solvencyBuffer: boolean;
    capitalPreservation: boolean;
    highOperatingEfficiency: boolean;
    superiorEquityReturn: boolean;
  };
}

export interface SectorBenchmark {
  sector: string;
  industry: string;
  medianPe: number;
  medianPb: number;
  targetRoe: number;
  maxHealthyDebtToEquity: number;
  peComparison: 'DISCOUNT_TO_SECTOR' | 'PREMIUM_TO_SECTOR' | 'IN_LINE';
  peVariancePercent: number;
}

export interface FundamentalAnalysisResult {
  symbol: string;
  companyName: string;
  currentPrice: number;
  fundamentals: StockFundamentals;
  dcf: DcfValuation;
  graham: GrahamValuation;
  piotroski: PiotroskiScore;
  sectorBenchmark: SectorBenchmark;
  overallRating: 'STRONG_BUY_QUALITY' | 'ATTRACTIVE_VALUE' | 'FAIRLY_VALUED' | 'OVERVALUED_QUALITY' | 'SPECULATIVE_RISK';
  confidenceScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  summaryNarrative: string;
  strengths: string[];
  weaknesses: string[];
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
  /**
   * Evaluated risk level. Meaning is scoped by query intent:
   * - STOCK_ANALYSIS / TECHNICAL_ANALYSIS / FUNDAMENTAL_ANALYSIS: Asset/equity investment risk (composite volatility, drawdown, valuation).
   * - PORTFOLIO_ANALYSIS: Portfolio-level concentration & diversification risk.
   * - NEWS_ANALYSIS: Media/headline sentiment risk (e.g. BEARISH news flow -> HIGH risk, BULLISH -> LOW risk).
   */
  riskLevel: RiskLevel;
  confidenceScore: number; // 0 to 100
  dataConfidence?: 'VERIFIED_LIVE' | 'FALLBACK_MOCK' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE';
  sources: (AiAnalysisSource | string)[];
  intent?: QueryIntent;
  toolsFired?: string[];
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
  explanationStyle?: ExplanationStyle;
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

// Wallet & Payment Types (Razorpay Top-Up for Paper Trading)
export type WalletTransactionType = 'TOPUP' | 'PAPER_TRADE_DEBIT' | 'PAPER_TRADE_CREDIT';
export type WalletTransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: number;
  status: WalletTransactionStatus;
  description?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  referenceTradeId?: string | null;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  recentTransactions?: WalletTransaction[];
}

export interface CreateTopupOrderResponse {
  orderId: string;
  amount: number;
  amountInRupees: number;
  currency: string;
  keyId: string;
}

export interface VerifyTopupRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  amount: number;
}

export interface VerifyTopupResponse {
  success: boolean;
  message: string;
  wallet: Wallet;
  transaction: WalletTransaction;
}

export interface WalletTransactionsResponse {
  transactions: WalletTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Query Intent & Orchestration Types
export type QueryIntent =
  | 'STOCK_ANALYSIS'
  | 'TECHNICAL_ANALYSIS'
  | 'FUNDAMENTAL_ANALYSIS'
  | 'STOCK_COMPARISON'
  | 'PORTFOLIO_ANALYSIS'
  | 'MARKET_ANALYSIS'
  | 'NEWS_ANALYSIS'
  | 'GENERAL_FINANCIAL_QUESTION';

export type AssetType = 'EQUITY' | 'CRYPTO';

export interface MatchedEntity {
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
  assetType?: AssetType;
  assetClass?: AssetClass;
}

export interface EntityResolutionResult {
  status: 'RESOLVED' | 'AMBIGUOUS' | 'NOT_FOUND' | 'NONE';
  primarySymbol?: string;
  primaryAssetType?: AssetType;
  assetType?: AssetType;
  assetClass?: AssetClass;
  matchedEntities?: MatchedEntity[];
  symbols: string[];
  disambiguationPrompt?: string;
}

// Risk Analysis Engine Types
export interface HistoricalVolatility {
  windowDays: number;
  dailyVolatilityPercent: number;
  annualizedVolatilityPercent: number;
  interpretation: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
}

export interface StockBeta {
  benchmarkSymbol: string;
  windowDays: number;
  value: number | null;
  status: 'AVAILABLE' | 'INSUFFICIENT_DATA';
  reason?: string;
  interpretation?: 'DEFENSIVE' | 'MARKET_TRACKING' | 'AGGRESSIVE' | 'HIGH_VOLATILITY';
}

export interface MaximumDrawdown {
  drawdownPercent: number;
  peakPrice: number;
  peakDate: string;
  troughPrice: number;
  troughDate: string;
  recoveryStatus: 'RECOVERED' | 'IN_DRAWDOWN';
  status: 'AVAILABLE' | 'INSUFFICIENT_DATA';
}

export interface ValueAtRisk {
  confidenceLevelPercent: number;
  horizonDays: number;
  method: 'HISTORICAL_SIMULATION';
  methodDescription: string;
  varPercent: number;
  varRupees?: number;
  sampleDays: number;
  status: 'AVAILABLE' | 'INSUFFICIENT_DATA';
}

export interface CompositeRiskScore {
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  components: {
    volatilityScore: number;
    drawdownScore: number;
    valuationScore: number;
  };
  weightingFormula: string;
  disclaimer: string;
}

export interface RiskAnalysisResult {
  symbol: string;
  currentPrice: number;
  windowDays: number;
  volatility: HistoricalVolatility;
  beta: StockBeta;
  maxDrawdown: MaximumDrawdown;
  var95: ValueAtRisk;
  compositeRiskScore: CompositeRiskScore;
  computedAt: string;
}

// News Intelligence Engine Types
export interface DeduplicatedNewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  sentimentConfidence: number;
  summary: string;
  relatedStocks?: string[];
  relevanceScore: number;
  relevanceTier: 'DIRECT' | 'MODERATE' | 'SECTOR_WIDE';
  duplicateCount: number;
  mergedSources: string[];
}

export interface NewsSentimentDistribution {
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalArticles: number;
  positivePercentage: number;
  neutralPercentage: number;
  negativePercentage: number;
}

export interface NewsTemporalWeighting {
  halfLifeDays: number;
  weightedScore: number;
  weightedSentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  recencySummary: string;
}

export interface NewsIntelligenceResult {
  symbol?: string;
  sourceProvider: 'marketaux' | 'mock' | 'none';
  isMock: boolean;
  articles: DeduplicatedNewsArticle[];
  totalRawArticles: number;
  uniqueArticlesCount: number;
  duplicatesRemovedCount: number;
  sentimentDistribution: NewsSentimentDistribution;
  temporalWeighting: NewsTemporalWeighting;
  status: 'RELIABLE' | 'UNAVAILABLE_DATA' | 'MOCK_DATA';
  statusMessage: string;
  computedAt: string;
}

// Portfolio Intelligence Engine Types
export interface HoldingPnlContribution {
  symbol: string;
  holdingId: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercent: number;
  contributionToPortfolioPnlPercent: number;
}

export interface ConcentrationAlert {
  entityType: 'HOLDING' | 'SECTOR';
  identifier: string;
  currentPercentage: number;
  thresholdPercentage: number;
  isConcentrated: boolean;
  message: string;
}

export interface HoldingCorrelationPair {
  symbolA: string;
  symbolB: string;
  correlation: number | null;
  overlapDays: number;
  status: 'AVAILABLE' | 'INSUFFICIENT_DATA';
  reason?: string;
}

export interface PortfolioIntelligenceResult {
  userId: string;
  portfolioId: string;
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  totalProfitPercent: number;
  holdingsCount: number;
  diversificationScore: number;
  topContributors: HoldingPnlContribution[];
  worstContributors: HoldingPnlContribution[];
  concentrationAnalysis: {
    holdingThresholdPercent: number;
    sectorThresholdPercent: number;
    holdingAlerts: ConcentrationAlert[];
    sectorAlerts: ConcentrationAlert[];
    hasConcentrationRisk: boolean;
  };
  correlationMatrix: {
    pairs: HoldingCorrelationPair[];
    averageCorrelation: number | null;
    status: 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'SINGLE_HOLDING' | 'EMPTY_PORTFOLIO';
    statusMessage: string;
  };
  computedAt: string;
}

// Phase 6: Cross-Engine Synthesis & Autonomous Research Pipeline Types
export type SignalAlignmentStatus =
  | 'FULL_BULLISH_CONFLUENCE'
  | 'FULL_BEARISH_CONFLUENCE'
  | 'VALUE_MOMENTUM_DIVERGENCE'
  | 'SPECULATIVE_MOMENTUM'
  | 'NEUTRAL_CONSOLIDATION';

export interface EngineSignalVector {
  score: number; // Normalized to [-1.0, +1.0]
  label: string; // e.g. 'BULLISH', 'BEARISH', 'DEFENSIVE', 'MODERATE', etc.
  weight: number; // Active weight in composite score (e.g. 0.35, 0.40)
  contribution: number; // weight * score
  confidence: 'HIGH' | 'MODERATE' | 'LOW' | 'UNAVAILABLE';
  keyMetricSummary: string;
}

export interface TechnicalFundamentalAlignment {
  alignmentScore: number; // S_tech * S_fund in [-1.0, +1.0]
  conflictScore: number; // |S_tech - S_fund| / 2 * 100 in [0, 100]
  status: SignalAlignmentStatus;
  narrative: string;
  divergenceType?: 'VALUE_TRAP_RISK' | 'VALUATION_COMPRESSION_RISK' | 'NONE';
}

export interface CrossEngineRiskSynthesis {
  riskAdjustedConviction: number; // Confluence penalized/boosted by risk profile
  riskPenaltyScore: number; // 0 to 100
  riskSummary: string;
}

export interface CrossEngineNewsSynthesis {
  catalystAlignment: 'AMPLIFYING' | 'CONTRADICTING' | 'NEUTRAL';
  narrative: string;
}

export interface CrossEnginePortfolioContext {
  isHeld: boolean;
  allocationPercent: number;
  unrealizedReturnPercent?: number;
  concentrationWarning?: string;
  actionImpact: 'REDUCES_RISK' | 'INCREASES_CONCENTRATION' | 'NEW_POSITION' | 'NO_PORTFOLIO_CONTEXT';
  narrative: string;
}

export interface CrossEngineSynthesisResult {
  symbol: string;
  currentPrice: number;
  signalAlignment: SignalAlignmentStatus;
  conflictScore: number; // 0 (complete harmony) to 100 (maximum conflict)
  confluenceScore: number; // 0 to 100 unified directional score
  convictionLevel: 'HIGH' | 'MODERATE' | 'LOW' | 'SPECULATIVE';
  signals: {
    technical: EngineSignalVector;
    fundamental: EngineSignalVector;
    risk: EngineSignalVector;
    news: EngineSignalVector;
  };
  technicalFundamentalAlignment: TechnicalFundamentalAlignment;
  riskSynthesis: CrossEngineRiskSynthesis;
  newsSynthesis: CrossEngineNewsSynthesis;
  portfolioContext: CrossEnginePortfolioContext;
  executiveVerdict: string;
  strategicCatalysts: string[];
  strategicHeadwinds: string[];
  tacticalPlaybook: {
    bias: 'ACCUMULATE' | 'DEFENSIVE_HOLD' | 'WAIT_FOR_STRUCTURE' | 'TAKE_PROFIT' | 'AVOID';
    keySupportToDefend: number;
    keyResistanceToBreak: number;
    trailingStopLoss: number;
    suggestedCondition: string;
  };
  computedAt: string;
}

// ==========================================
// Cryptocurrency & Multi-Asset Types
// ==========================================

export type AssetClass = 'stocks' | 'crypto';

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  category?: string | null;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  addedAt?: string;
}

export type CryptoPricePoint = StockPricePoint;

export interface CryptoAssetQuote extends CryptoAsset {
  bid?: number;
  ask?: number;
  timestamp?: number;
}

export interface CryptoTopMoversResponse {
  indices: MarketIndex[];
  gainers: GainerLoserItem[];
  losers: GainerLoserItem[];
  topCoins: CryptoAsset[];
}

export interface CryptoHolding {
  id: string;
  cryptoPortfolioId: string;
  cryptoAssetId: string;
  cryptoAsset: CryptoAsset;
  quantity: number;
  avgBuyPrice: number;
  currentValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CryptoTransaction {
  id: string;
  cryptoPortfolioId: string;
  cryptoAssetId: string;
  cryptoAsset: CryptoAsset;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executedAt: string;
}

export interface CryptoPortfolio {
  id: string;
  userId: string;
  name: string;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  holdings: CryptoHolding[];
}

export interface CryptoWatchlistItem {
  id: string;
  cryptoWatchlistId: string;
  cryptoAssetId: string;
  cryptoAsset: CryptoAsset;
  addedAt: string;
}

export interface CryptoWatchlist {
  id: string;
  userId: string;
  name: string;
  type: string;
  createdAt: string;
  items: CryptoWatchlistItem[];
}

export interface CryptoBrokerStatus {
  tradingMode: 'PAPER' | 'LIVE';
  liveTradingEnabled: boolean;
  brokerConnected: boolean;
  brokerName: string;
  sessionExpiresAt?: string | null;
}

export interface PlaceCryptoOrderDto {
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  orderType?: 'MARKET' | 'LIMIT' | 'market_order' | 'limit_order';
  confirmLiveTrading?: boolean;
}

export interface CryptoBrokerOrderResult {
  success: boolean;
  orderId: string;
  brokerOrderId?: string | null;
  status: string;
  tradingMode: 'PAPER' | 'LIVE';
  symbol: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  executedPrice: number;
  totalCost: number;
  message: string;
}
