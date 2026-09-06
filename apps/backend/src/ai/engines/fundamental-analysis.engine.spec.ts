import { FundamentalAnalysisEngine } from './fundamental-analysis.engine';
import { StockFundamentals } from '@finpilot/shared-types';

describe('FundamentalAnalysisEngine', () => {
  let engine: FundamentalAnalysisEngine;

  beforeEach(() => {
    engine = new FundamentalAnalysisEngine();
  });

  describe('calculateDCF', () => {
    it('should calculate 2-stage DCF intrinsic value and Margin of Safety for a profitable stock', () => {
      const funds: StockFundamentals = {
        eps: 128.4,
        roce: 61.2,
        roe: 49.5,
        peRatio: 30.2,
        debtToEquity: 0.04,
      };

      const result = engine.calculateDCF(2300, funds, 'Information Technology');

      expect(result.intrinsicValue).toBeGreaterThan(0);
      expect(result.projectedCashFlows.length).toBe(5);
      expect(result.terminalValue).toBeGreaterThan(0);
      expect(result.pvTerminalValue).toBeGreaterThan(0);
      expect(result.assumptions.discountRate).toBe(0.11);
      expect(result.assumptions.terminalGrowthRate).toBe(0.05);
      expect(result.marginOfSafetyPercent).toBeDefined();
      expect(['UNDERVALUED', 'FAIRLY_VALUED', 'OVERVALUED']).toContain(result.valuationStatus);
    });

    it('should handle zero or negative EPS gracefully by returning 0 intrinsic value', () => {
      const funds: StockFundamentals = {
        eps: -10,
        peRatio: -15,
        roe: -5,
      };

      const result = engine.calculateDCF(500, funds);

      expect(result.intrinsicValue).toBe(0);
      expect(result.valuationStatus).toBe('OVERVALUED');
      expect(result.marginOfSafetyPercent).toBe(-100);
      expect(result.projectedCashFlows).toEqual([0, 0, 0, 0, 0]);
    });

    it('should classify as UNDERVALUED when margin of safety is >= 15%', () => {
      // High EPS relative to low price gives large Margin of Safety
      const funds: StockFundamentals = {
        eps: 200,
        roce: 30,
        roe: 25,
      };

      const result = engine.calculateDCF(500, funds); // Cheap price ₹500 for ₹200 EPS
      expect(result.marginOfSafetyPercent).toBeGreaterThanOrEqual(15);
      expect(result.valuationStatus).toBe('UNDERVALUED');
    });

    it('should classify as OVERVALUED when margin of safety is <= -15%', () => {
      // Low EPS relative to high price gives negative Margin of Safety
      const funds: StockFundamentals = {
        eps: 10,
        roce: 12,
        roe: 10,
      };

      const result = engine.calculateDCF(3000, funds); // Expensive price ₹3000 for ₹10 EPS
      expect(result.marginOfSafetyPercent).toBeLessThanOrEqual(-15);
      expect(result.valuationStatus).toBe('OVERVALUED');
    });
  });

  describe('calculateGrahamNumber', () => {
    it('should calculate Graham number for stock with positive EPS and PB ratio', () => {
      const funds: StockFundamentals = {
        eps: 100,
        pbRatio: 2.5,
      };
      const price = 1000; // BVPS = 1000 / 2.5 = 400. Product = 22.5 * 100 * 400 = 900,000. Sqrt = 948.68

      const result = engine.calculateGrahamNumber(price, funds);

      expect(result.grahamNumber).toBeCloseTo(948.68, 1);
      expect(result.bvps).toBe(400);
      expect(result.eps).toBe(100);
      expect(result.valuationStatus).toBe('GRAHAM_PREMIUM'); // 1000 > 948.68
    });

    it('should return GRAHAM_DISCOUNT when price is below Graham number', () => {
      const funds: StockFundamentals = {
        eps: 100,
        pbRatio: 2.0, // BVPS = 400 / 2 = 200. Product = 22.5 * 100 * 200 = 450,000. Sqrt = 670.82
      };
      const price = 400; // 400 < 670.82

      const result = engine.calculateGrahamNumber(price, funds);

      expect(result.grahamNumber).toBeCloseTo(670.82, 1);
      expect(result.valuationStatus).toBe('GRAHAM_DISCOUNT');
      expect(result.premiumOrDiscountPercent).toBeLessThan(0);
    });

    it('should return NOT_APPLICABLE when EPS is negative or zero', () => {
      const funds: StockFundamentals = {
        eps: -5,
        pbRatio: 1.5,
      };

      const result = engine.calculateGrahamNumber(100, funds);

      expect(result.grahamNumber).toBeNull();
      expect(result.valuationStatus).toBe('NOT_APPLICABLE');
    });

    it('should return NOT_APPLICABLE when pbRatio is missing or zero', () => {
      const funds: StockFundamentals = {
        eps: 50,
      };

      const result = engine.calculateGrahamNumber(500, funds);

      expect(result.grahamNumber).toBeNull();
      expect(result.valuationStatus).toBe('NOT_APPLICABLE');
    });
  });

  describe('calculatePiotroskiScore', () => {
    it('should return high score (8 or 9) and STRONG rating for high quality profile', () => {
      const funds: StockFundamentals = {
        eps: 128.4,
        roe: 49.5,
        roce: 61.2,
        debtToEquity: 0.04,
        fiscalPeriod: 'FY2024-25 Q3',
      };

      const result = engine.calculatePiotroskiScore(funds, 'Information Technology');

      expect(result.score).toBe(9);
      expect(result.rating).toBe('STRONG');
      expect(result.profitabilityScore).toBe(4);
      expect(result.leverageScore).toBe(3);
      expect(result.operatingEfficiencyScore).toBe(2);
      expect(result.criteriaBreakdown.positiveNetIncome).toBe(true);
      expect(result.criteriaBreakdown.conservativeLeverage).toBe(true);
    });

    it('should return WEAK rating for distressed profile with high leverage and negative return', () => {
      const funds: StockFundamentals = {
        eps: -12.5,
        roe: -8.0,
        roce: -3.0,
        debtToEquity: 3.5,
      };

      const result = engine.calculatePiotroskiScore(funds, 'Capital Goods');

      expect(result.score).toBeLessThanOrEqual(3);
      expect(result.rating).toBe('WEAK');
      expect(result.profitabilityScore).toBe(0);
      expect(result.criteriaBreakdown.positiveNetIncome).toBe(false);
      expect(result.criteriaBreakdown.conservativeLeverage).toBe(false);
    });

    it('should adjust leverage thresholds appropriately for Banking / Financial Services', () => {
      const funds: StockFundamentals = {
        eps: 88.5,
        roe: 16.4,
        roce: 17.2,
        debtToEquity: 1.15, // High for a normal firm, but normal for a bank
        fiscalPeriod: 'FY2024-25 Q3',
      };

      const bankResult = engine.calculatePiotroskiScore(funds, 'Financial Services');
      expect(bankResult.criteriaBreakdown.conservativeLeverage).toBe(true); // Banking threshold is 2.5

      const industrialResult = engine.calculatePiotroskiScore(funds, 'Energy');
      expect(industrialResult.criteriaBreakdown.conservativeLeverage).toBe(false); // Non-bank threshold is 0.5
    });
  });

  describe('getSectorBenchmark', () => {
    it('should benchmark IT Services against 26.5 median PE', () => {
      const funds: StockFundamentals = { peRatio: 30.2 };
      const benchmark = engine.getSectorBenchmark(funds, 'Information Technology', 'IT Services');

      expect(benchmark.medianPe).toBe(26.5);
      expect(benchmark.peComparison).toBe('PREMIUM_TO_SECTOR');
      expect(benchmark.peVariancePercent).toBeCloseTo(13.96, 1);
    });

    it('should benchmark Financial Services / Banking against 18.0 median PE', () => {
      const funds: StockFundamentals = { peRatio: 14.5 };
      const benchmark = engine.getSectorBenchmark(funds, 'Financial Services', 'Private Bank');

      expect(benchmark.medianPe).toBe(18.0);
      expect(benchmark.peComparison).toBe('DISCOUNT_TO_SECTOR');
      expect(benchmark.peVariancePercent).toBeLessThan(0);
    });

    it('should fallback to default benchmark for unknown sectors', () => {
      const funds: StockFundamentals = { peRatio: 22.0 };
      const benchmark = engine.getSectorBenchmark(funds, 'Space Exploration', 'Cosmic Mining');

      expect(benchmark.medianPe).toBe(22.0);
      expect(benchmark.peComparison).toBe('IN_LINE');
    });
  });

  describe('analyze (Full Master Synthesis)', () => {
    it('should generate complete fundamental profile with strengths, weaknesses, and narrative for TCS.NS', () => {
      const funds: StockFundamentals = {
        peRatio: 30.2,
        pbRatio: 12.8,
        roe: 49.5,
        roce: 61.2,
        eps: 128.4,
        debtToEquity: 0.04,
        marketCap: 14120000000000,
        fiscalPeriod: 'FY2024-25 Q3',
      };

      const result = engine.analyze(
        'TCS.NS',
        'Tata Consultancy Services Ltd.',
        2304,
        funds,
        'Information Technology',
        'IT Services',
      );

      expect(result.symbol).toBe('TCS.NS');
      expect(result.companyName).toBe('Tata Consultancy Services Ltd.');
      expect(result.currentPrice).toBe(2304);
      expect(result.dcf).toBeDefined();
      expect(result.graham).toBeDefined();
      expect(result.piotroski.score).toBe(9);
      expect(result.sectorBenchmark.medianPe).toBe(26.5);
      expect(result.overallRating).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.riskLevel);
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.summaryNarrative).toContain('TCS.NS');
      expect(result.summaryNarrative).toContain('[PIOTROSKI: 9/9 (STRONG)]');
    });

    it('should handle completely missing fundamentals gracefully without crashing', () => {
      const result = engine.analyze(
        'UNKNOWN.NS',
        'Unknown Corporation',
        150,
        null,
      );

      expect(result.symbol).toBe('UNKNOWN.NS');
      expect(result.dcf.intrinsicValue).toBe(0);
      expect(result.graham.grahamNumber).toBeNull();
      expect(result.piotroski.score).toBe(0);
      expect(result.overallRating).toBe('SPECULATIVE_RISK');
    });
  });
});
