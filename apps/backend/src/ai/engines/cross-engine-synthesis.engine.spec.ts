import { Test, TestingModule } from '@nestjs/testing';
import { CrossEngineSynthesisEngine } from './cross-engine-synthesis.engine';
import {
  FundamentalAnalysisResult,
  MarketStructureResult,
  NewsIntelligenceResult,
  StockQuote,
  TechnicalEngineResult,
} from '@finpilot/shared-types';

describe('CrossEngineSynthesisEngine', () => {
  let engine: CrossEngineSynthesisEngine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CrossEngineSynthesisEngine],
    }).compile();

    engine = module.get<CrossEngineSynthesisEngine>(CrossEngineSynthesisEngine);
  });

  it('should be defined', () => {
    expect(engine).toBeDefined();
  });

  describe('Harmonic Bullish Confluence', () => {
    it('should identify FULL_BULLISH_CONFLUENCE with low conflict score when tech and fundamentals align', () => {
      const quote: StockQuote = {
        symbol: 'TCS.NS',
        companyName: 'Tata Consultancy Services',
        currentPrice: 2300,
        change: 25,
        changePercent: 1.1,
        high: 2320,
        low: 2280,
        open: 2285,
        previousClose: 2275,
        volume: 1500000,
        updatedAt: new Date().toISOString(),
      };

      const advancedTechnical: Partial<TechnicalEngineResult> = {
        confluenceScore: 75,
        rating: 'BULLISH',
        vwap: {
          vwap: 2270,
          bias: 'BUYER_CONTROL',
          upperBand1: 2320,
          lowerBand1: 2220,
          upperBand2: 2370,
          lowerBand2: 2170,
          distancePercent: 1.3,
        },
        supportResistance: {
          floorPivots: {
            pivotPoint: 2260,
            r1: 2350,
            s1: 2210,
            r2: 2400,
            s2: 2160,
          },
          fibonacciLevels: [] as any,
          volumeProfile: { valueAreaHigh: 2320, valueAreaLow: 2240, pointOfControl: 2280 },
          nearestSupport: 2210,
          nearestResistance: 2350,
        },
      } as any;

      const marketStructure: Partial<MarketStructureResult> = {
        trend: 'BULLISH_CONTINUATION',
        dealingRange: {
          rangeHigh: 2500,
          rangeLow: 2100,
          equilibrium: 2300,
          currentZone: 'DISCOUNT',
          relativePositionPercent: 45,
        },
      } as any;

      const advancedFundamentals: Partial<FundamentalAnalysisResult> = {
        overallRating: 'STRONG_BUY_QUALITY',
        dcf: {
          intrinsicValue: 3100,
          marginOfSafetyPercent: 34.78,
          valuationStatus: 'UNDERVALUED',
          discountRatePercent: 11.0,
          terminalGrowthRatePercent: 5.0,
          projectedCashFlows: [],
          terminalValue: 0,
          pvOfCashFlows: 0,
          pvOfTerminalValue: 0,
          sharesOutstanding: 0,
        },
        piotroski: {
          score: 8,
          rating: 'STRONG',
          breakdown: [] as any,
          profitabilityScore: 4,
          leverageScore: 2,
          operatingEfficiencyScore: 2,
        },
        sectorBenchmark: {
          sector: 'Information Technology',
          medianPe: 28.5,
          medianPb: 6.2,
          stockPe: 22.0,
          stockPb: 5.1,
          peVariancePercent: -22.8,
          peComparison: 'DISCOUNT',
        },
      } as any;

      const riskAnalysis = {
        compositeRiskScore: { score: 30, riskLevel: 'LOW' },
        volatility: { annualizedVolatilityPercent: 18.5, interpretation: 'LOW' },
        beta: { value: 0.85, status: 'AVAILABLE', interpretation: 'DEFENSIVE' },
        maxDrawdown: { drawdownPercent: -6.5, recoveryStatus: 'RECOVERED' },
        var95: { varPercent: 2.1, varRupees: 48.3 },
      };

      const newsIntelligence: Partial<NewsIntelligenceResult> = {
        status: 'RELIABLE',
        articles: [{ title: 'TCS signs mega cloud contract', source: 'LiveMint', sentiment: 'POSITIVE', relevanceTier: 'DIRECT' }] as any,
        uniqueArticlesCount: 5,
        temporalWeighting: {
          weightedScore: 0.65,
          weightedSentiment: 'BULLISH',
          recencySummary: 'Recent positive newsflow',
        },
      } as any;

      const result = engine.synthesize({
        symbol: 'TCS.NS',
        quote,
        advancedTechnical: advancedTechnical as TechnicalEngineResult,
        marketStructure: marketStructure as MarketStructureResult,
        advancedFundamentals: advancedFundamentals as FundamentalAnalysisResult,
        riskAnalysis,
        newsIntelligence: newsIntelligence as NewsIntelligenceResult,
      });

      expect(result.signalAlignment).toBe('FULL_BULLISH_CONFLUENCE');
      expect(result.conflictScore).toBeLessThanOrEqual(25);
      expect(result.confluenceScore).toBeGreaterThanOrEqual(70);
      expect(result.convictionLevel).toBe('HIGH');
      expect(result.tacticalPlaybook.bias).toBe('ACCUMULATE');
      expect(result.signals.technical.score).toBeGreaterThan(0.25);
      expect(result.signals.fundamental.score).toBeGreaterThan(0.20);
      expect(result.signals.risk.score).toBeGreaterThan(0);
      expect(result.newsSynthesis.catalystAlignment).toBe('AMPLIFYING');
    });
  });

  describe('Value-Momentum Divergence (Value Trap)', () => {
    it('should detect VALUE_MOMENTUM_DIVERGENCE and flag value trap risk when fundamentals are cheap but structure is bearish', () => {
      const advancedTechnical: Partial<TechnicalEngineResult> = {
        confluenceScore: 25,
        rating: 'BEARISH',
        vwap: { vwap: 2450, bias: 'SELLER_CONTROL' } as any,
      } as any;

      const marketStructure: Partial<MarketStructureResult> = {
        trend: 'BEARISH_CONTINUATION',
        dealingRange: { currentZone: 'PREMIUM', relativePositionPercent: 80 } as any,
      } as any;

      const advancedFundamentals: Partial<FundamentalAnalysisResult> = {
        overallRating: 'VALUE_OPPORTUNITY',
        dcf: {
          intrinsicValue: 3000,
          marginOfSafetyPercent: 30.0,
          valuationStatus: 'UNDERVALUED',
        } as any,
        piotroski: { score: 8, rating: 'STRONG' } as any,
      } as any;

      const riskAnalysis = {
        compositeRiskScore: { score: 45, riskLevel: 'MEDIUM' },
        volatility: { annualizedVolatilityPercent: 25.0, interpretation: 'MODERATE' },
        beta: { value: 1.1, status: 'AVAILABLE', interpretation: 'MARKET' },
      };

      const result = engine.synthesize({
        symbol: 'TCS.NS',
        advancedTechnical: advancedTechnical as TechnicalEngineResult,
        marketStructure: marketStructure as MarketStructureResult,
        advancedFundamentals: advancedFundamentals as FundamentalAnalysisResult,
        riskAnalysis,
      });

      expect(result.signalAlignment).toBe('VALUE_MOMENTUM_DIVERGENCE');
      expect(result.conflictScore).toBeGreaterThanOrEqual(50);
      expect(result.technicalFundamentalAlignment.divergenceType).toBe('VALUE_TRAP_RISK');
      expect(result.tacticalPlaybook.bias).toBe('WAIT_FOR_STRUCTURE');
      expect(result.tacticalPlaybook.suggestedCondition).toContain('Market Structure Shift');
    });
  });

  describe('Speculative Momentum', () => {
    it('should detect SPECULATIVE_MOMENTUM when price momentum is strong but valuation is overextended', () => {
      const advancedTechnical: Partial<TechnicalEngineResult> = {
        confluenceScore: 85,
        rating: 'BULLISH',
        vwap: { vwap: 2200, bias: 'BUYER_CONTROL' } as any,
      } as any;

      const marketStructure: Partial<MarketStructureResult> = {
        trend: 'BULLISH_CONTINUATION',
        dealingRange: { currentZone: 'DISCOUNT', relativePositionPercent: 30 } as any,
      } as any;

      const advancedFundamentals: Partial<FundamentalAnalysisResult> = {
        overallRating: 'SPECULATIVE_OVERPRICED',
        dcf: {
          intrinsicValue: 1500,
          marginOfSafetyPercent: -35.0,
          valuationStatus: 'OVERVALUED',
        } as any,
        piotroski: { score: 3, rating: 'WEAK' } as any,
        sectorBenchmark: { peVariancePercent: 40 } as any,
      } as any;

      const result = engine.synthesize({
        symbol: 'SPEC.NS',
        advancedTechnical: advancedTechnical as TechnicalEngineResult,
        marketStructure: marketStructure as MarketStructureResult,
        advancedFundamentals: advancedFundamentals as FundamentalAnalysisResult,
      });

      expect(result.signalAlignment).toBe('SPECULATIVE_MOMENTUM');
      expect(result.conflictScore).toBeGreaterThanOrEqual(50);
      expect(result.technicalFundamentalAlignment.divergenceType).toBe('VALUATION_COMPRESSION_RISK');
      expect(result.tacticalPlaybook.bias).toBe('TAKE_PROFIT');
    });
  });

  describe('Full Bearish Confluence', () => {
    it('should identify FULL_BEARISH_CONFLUENCE when both technicals and fundamentals signal risk', () => {
      const advancedTechnical: Partial<TechnicalEngineResult> = {
        confluenceScore: 20,
        rating: 'BEARISH',
        vwap: { vwap: 2500, bias: 'SELLER_CONTROL' } as any,
      } as any;

      const marketStructure: Partial<MarketStructureResult> = {
        trend: 'BEARISH_CONTINUATION',
        dealingRange: { currentZone: 'PREMIUM', relativePositionPercent: 85 } as any,
      } as any;

      const advancedFundamentals: Partial<FundamentalAnalysisResult> = {
        overallRating: 'WEAK_AVOID',
        dcf: {
          intrinsicValue: 1400,
          marginOfSafetyPercent: -40.0,
          valuationStatus: 'OVERVALUED',
        } as any,
        piotroski: { score: 2, rating: 'WEAK' } as any,
        sectorBenchmark: { peVariancePercent: 35 } as any,
      } as any;

      const result = engine.synthesize({
        symbol: 'WEAK.NS',
        advancedTechnical: advancedTechnical as TechnicalEngineResult,
        marketStructure: marketStructure as MarketStructureResult,
        advancedFundamentals: advancedFundamentals as FundamentalAnalysisResult,
      });

      expect(result.signalAlignment).toBe('FULL_BEARISH_CONFLUENCE');
      expect(result.conflictScore).toBeLessThanOrEqual(25);
      expect(result.confluenceScore).toBeLessThan(35);
      expect(result.tacticalPlaybook.bias).toBe('AVOID');
    });
  });

  describe('Dynamic Weight Redistribution & Honest Fallbacks', () => {
    it('should redistribute weights from unverified mock news to technical, fundamental, and risk engines', () => {
      const newsIntelligence: Partial<NewsIntelligenceResult> = {
        status: 'MOCK_DATA',
        isMock: true,
        articles: [],
      } as any;

      const result = engine.synthesize({
        symbol: 'TCS.NS',
        newsIntelligence: newsIntelligence as NewsIntelligenceResult,
      });

      expect(result.signals.news.weight).toBe(0.0);
      expect(result.signals.technical.weight).toBe(0.40);
      expect(result.signals.fundamental.weight).toBe(0.40);
      expect(result.signals.risk.weight).toBe(0.20);
      const totalWeight =
        result.signals.news.weight +
        result.signals.technical.weight +
        result.signals.fundamental.weight +
        result.signals.risk.weight;
      expect(Number(totalWeight.toFixed(2))).toBe(1.0);
    });

    it('should handle completely missing indicators or filings gracefully without throwing', () => {
      const result = engine.synthesize({
        symbol: 'EMPTY.NS',
      });

      expect(result.symbol).toBe('EMPTY.NS');
      expect(result.signals.technical.confidence).toBe('UNAVAILABLE');
      expect(result.signals.fundamental.confidence).toBe('UNAVAILABLE');
      expect(result.signals.risk.confidence).toBe('UNAVAILABLE');
      expect(result.signals.news.confidence).toBe('UNAVAILABLE');
      expect(result.signalAlignment).toBe('NEUTRAL_CONSOLIDATION');
      expect(result.confluenceScore).toBe(50);
    });
  });

  describe('Portfolio Context Scoping', () => {
    it('should flag concentration warning when user holding exceeds 25% of portfolio', () => {
      const result = engine.synthesize({
        symbol: 'TCS.NS',
        userHolding: {
          shares: 50,
          avgPrice: 2100,
          currentValue: 115000,
          allocationPercent: 32.5,
          unrealizedPnl: 10000,
          unrealizedPnlPercent: 9.52,
        },
      });

      expect(result.portfolioContext.isHeld).toBe(true);
      expect(result.portfolioContext.allocationPercent).toBe(32.5);
      expect(result.portfolioContext.actionImpact).toBe('INCREASES_CONCENTRATION');
      expect(result.portfolioContext.concentrationWarning).toContain('exceeds 25%');
      expect(result.strategicHeadwinds.some((h) => h.includes('Portfolio concentration'))).toBe(true);
    });

    it('should report clean new position status when stock is not held', () => {
      const result = engine.synthesize({
        symbol: 'INFY.NS',
      });

      expect(result.portfolioContext.isHeld).toBe(false);
      expect(result.portfolioContext.actionImpact).toBe('NEW_POSITION');
      expect(result.portfolioContext.concentrationWarning).toBeUndefined();
    });
  });
});
