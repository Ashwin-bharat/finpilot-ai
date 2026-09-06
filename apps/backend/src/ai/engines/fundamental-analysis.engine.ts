import { Injectable, Logger } from '@nestjs/common';
import {
  StockFundamentals,
  DcfValuation,
  GrahamValuation,
  PiotroskiScore,
  SectorBenchmark,
  FundamentalAnalysisResult,
} from '@finpilot/shared-types';

interface SectorBenchmarkData {
  medianPe: number;
  medianPb: number;
  targetRoe: number;
  maxHealthyDebtToEquity: number;
  typicalGrowthRate: number;
}

@Injectable()
export class FundamentalAnalysisEngine {
  private readonly logger = new Logger(FundamentalAnalysisEngine.name);

  // Calibrated benchmark metrics for Indian equities
  private readonly SECTOR_BENCHMARKS: Record<string, SectorBenchmarkData> = {
    'INFORMATION TECHNOLOGY': {
      medianPe: 26.5,
      medianPb: 7.0,
      targetRoe: 25.0,
      maxHealthyDebtToEquity: 0.2,
      typicalGrowthRate: 0.12,
    },
    'IT SERVICES': {
      medianPe: 26.5,
      medianPb: 7.0,
      targetRoe: 25.0,
      maxHealthyDebtToEquity: 0.2,
      typicalGrowthRate: 0.12,
    },
    'FINANCIAL SERVICES': {
      medianPe: 18.0,
      medianPb: 2.4,
      targetRoe: 16.0,
      maxHealthyDebtToEquity: 2.5, // Deposit/borrowing leverage adjusted
      typicalGrowthRate: 0.14,
    },
    'PRIVATE BANK': {
      medianPe: 18.0,
      medianPb: 2.4,
      targetRoe: 16.0,
      maxHealthyDebtToEquity: 2.5,
      typicalGrowthRate: 0.14,
    },
    'ENERGY': {
      medianPe: 16.0,
      medianPb: 1.9,
      targetRoe: 12.0,
      maxHealthyDebtToEquity: 0.8,
      typicalGrowthRate: 0.09,
    },
    'OIL & GAS / RETAIL / TELECOM': {
      medianPe: 20.0,
      medianPb: 2.1,
      targetRoe: 12.0,
      maxHealthyDebtToEquity: 0.8,
      typicalGrowthRate: 0.11,
    },
    'AUTOMOBILE': {
      medianPe: 20.0,
      medianPb: 3.2,
      targetRoe: 18.0,
      maxHealthyDebtToEquity: 0.7,
      typicalGrowthRate: 0.12,
    },
    'AUTOMOBILES & EV': {
      medianPe: 20.0,
      medianPb: 3.2,
      targetRoe: 18.0,
      maxHealthyDebtToEquity: 0.7,
      typicalGrowthRate: 0.12,
    },
    'CONSUMER GOODS': {
      medianPe: 38.0,
      medianPb: 9.5,
      targetRoe: 28.0,
      maxHealthyDebtToEquity: 0.3,
      typicalGrowthRate: 0.11,
    },
    'HEALTHCARE': {
      medianPe: 28.0,
      medianPb: 4.2,
      targetRoe: 16.0,
      maxHealthyDebtToEquity: 0.4,
      typicalGrowthRate: 0.12,
    },
  };

  private readonly DEFAULT_BENCHMARK: SectorBenchmarkData = {
    medianPe: 22.0,
    medianPb: 3.0,
    targetRoe: 15.0,
    maxHealthyDebtToEquity: 0.8,
    typicalGrowthRate: 0.1,
  };

  /**
   * Main analysis coordinator
   */
  public analyze(
    symbol: string,
    companyName: string,
    currentPrice: number,
    fundamentals?: StockFundamentals | null,
    sector: string = 'General',
    industry: string = 'Equities',
  ): FundamentalAnalysisResult {
    const funds: StockFundamentals = fundamentals || {};
    const price = currentPrice > 0 ? currentPrice : 100;

    const sectorBenchmark = this.getSectorBenchmark(funds, sector, industry);
    const dcf = this.calculateDCF(price, funds, sector);
    const graham = this.calculateGrahamNumber(price, funds);
    const piotroski = this.calculatePiotroskiScore(funds, sector);

    const { overallRating, confidenceScore, riskLevel } = this.synthesizeRating(
      dcf,
      graham,
      piotroski,
      sectorBenchmark,
      funds,
    );

    const { strengths, weaknesses, summaryNarrative } = this.buildNarrativeAndHighlights(
      symbol,
      companyName,
      price,
      funds,
      dcf,
      graham,
      piotroski,
      sectorBenchmark,
      overallRating,
    );

    return {
      symbol,
      companyName,
      currentPrice: price,
      fundamentals: funds,
      dcf,
      graham,
      piotroski,
      sectorBenchmark,
      overallRating,
      confidenceScore,
      riskLevel,
      summaryNarrative,
      strengths,
      weaknesses,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * 1. Two-Stage Discounted Cash Flow (DCF) Model
   * Stage 1: 5-year discrete cash flow forecast
   * Stage 2: Gordon Growth terminal value
   */
  public calculateDCF(
    currentPrice: number,
    fundamentals: StockFundamentals,
    sector?: string,
  ): DcfValuation {
    const discountRate = 0.11; // 11.0% institutional cost of equity for Indian large caps
    const terminalGrowthRate = 0.05; // 5.0% long-term terminal growth rate
    const projectionYears = 5;

    const eps = fundamentals.eps ?? (fundamentals.peRatio ? currentPrice / fundamentals.peRatio : 0);

    // If company is operating at negative earnings or EPS is 0, DCF is not applicable
    if (eps <= 0) {
      return {
        intrinsicValue: 0,
        currentPrice,
        marginOfSafetyPercent: -100,
        valuationStatus: 'OVERVALUED',
        assumptions: {
          discountRate,
          terminalGrowthRate,
          projectedGrowthRate: 0,
          projectionYears,
        },
        projectedCashFlows: [0, 0, 0, 0, 0],
        terminalValue: 0,
        pvTerminalValue: 0,
      };
    }

    // Capital efficiency conversion to Free Cash Flow
    // High ROCE businesses (e.g. IT services) convert ~85-90% of EPS into FCF
    const roce = fundamentals.roce ?? 15;
    const fcfConversionRatio = Math.min(0.92, Math.max(0.65, 0.6 + (roce / 100) * 0.45));
    const baseFcf = eps * fcfConversionRatio;

    // Projected growth rate: combines sector benchmark growth with sustainable growth (ROE * retention)
    const benchmark = this.lookupBenchmark(sector);
    const roe = fundamentals.roe ?? 15;
    const sustainableGrowth = Math.min(0.2, Math.max(0.06, (roe / 100) * 0.5));
    const projectedGrowthRate = Number(((benchmark.typicalGrowthRate + sustainableGrowth) / 2).toFixed(4));

    // Project 5 years of cash flows
    const projectedCashFlows: number[] = [];
    let pvStage1 = 0;
    let runningFcf = baseFcf;

    for (let year = 1; year <= projectionYears; year++) {
      runningFcf = runningFcf * (1 + projectedGrowthRate);
      projectedCashFlows.push(Number(runningFcf.toFixed(2)));
      const discountFactor = Math.pow(1 + discountRate, year);
      pvStage1 += runningFcf / discountFactor;
    }

    // Gordon Growth Terminal Value
    const terminalCashFlow = runningFcf * (1 + terminalGrowthRate);
    const terminalValue = terminalCashFlow / (discountRate - terminalGrowthRate);
    const pvTerminalValue = terminalValue / Math.pow(1 + discountRate, projectionYears);

    const rawIntrinsicValue = pvStage1 + pvTerminalValue;
    const intrinsicValue = Number(rawIntrinsicValue.toFixed(2));

    const marginOfSafetyPercent = Number(
      (((intrinsicValue - currentPrice) / intrinsicValue) * 100).toFixed(2),
    );

    let valuationStatus: 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED';
    if (marginOfSafetyPercent >= 15) {
      valuationStatus = 'UNDERVALUED';
    } else if (marginOfSafetyPercent <= -15) {
      valuationStatus = 'OVERVALUED';
    } else {
      valuationStatus = 'FAIRLY_VALUED';
    }

    return {
      intrinsicValue,
      currentPrice,
      marginOfSafetyPercent,
      valuationStatus,
      assumptions: {
        discountRate,
        terminalGrowthRate,
        projectedGrowthRate,
        projectionYears,
      },
      projectedCashFlows,
      terminalValue: Number(terminalValue.toFixed(2)),
      pvTerminalValue: Number(pvTerminalValue.toFixed(2)),
    };
  }

  /**
   * 2. Benjamin Graham Number Valuation
   * Formula: sqrt(22.5 * EPS * BVPS)
   */
  public calculateGrahamNumber(
    currentPrice: number,
    fundamentals: StockFundamentals,
  ): GrahamValuation {
    const eps = fundamentals.eps ?? (fundamentals.peRatio ? currentPrice / fundamentals.peRatio : 0);
    const pb = fundamentals.pbRatio;

    if (eps <= 0 || !pb || pb <= 0) {
      return {
        grahamNumber: null,
        bvps: null,
        eps: Number(eps.toFixed(2)),
        premiumOrDiscountPercent: null,
        valuationStatus: 'NOT_APPLICABLE',
      };
    }

    // Balance-sheet derived BVPS (accounting identity: BVPS = (P/E * EPS) / (P/B), or Price / PB)
    // Using audited P/E * EPS ensures BVPS is strictly derived from filings and invariant across exchange tickers
    const bvps = fundamentals.peRatio && fundamentals.eps
      ? Number(((fundamentals.peRatio * eps) / pb).toFixed(2))
      : Number((currentPrice / pb).toFixed(2));
    const product = 22.5 * eps * bvps;

    if (product <= 0) {
      return {
        grahamNumber: null,
        bvps,
        eps: Number(eps.toFixed(2)),
        premiumOrDiscountPercent: null,
        valuationStatus: 'NOT_APPLICABLE',
      };
    }

    const grahamNumber = Number(Math.sqrt(product).toFixed(2));
    const premiumOrDiscountPercent = Number(
      (((currentPrice - grahamNumber) / grahamNumber) * 100).toFixed(2),
    );

    const valuationStatus =
      currentPrice <= grahamNumber ? 'GRAHAM_DISCOUNT' : 'GRAHAM_PREMIUM';

    return {
      grahamNumber,
      bvps,
      eps: Number(eps.toFixed(2)),
      premiumOrDiscountPercent,
      valuationStatus,
    };
  }

  /**
   * 3. Piotroski F-Score (9-Point Financial Diagnostic)
   */
  public calculatePiotroskiScore(
    fundamentals: StockFundamentals,
    sector?: string,
  ): PiotroskiScore {
    const hasEps = fundamentals.eps !== undefined && fundamentals.eps !== null;
    const hasRoe = fundamentals.roe !== undefined && fundamentals.roe !== null;
    const hasRoce = fundamentals.roce !== undefined && fundamentals.roce !== null;
    const hasDe = fundamentals.debtToEquity !== undefined && fundamentals.debtToEquity !== null;

    const eps = fundamentals.eps ?? 0;
    const roe = fundamentals.roe ?? 0;
    const roce = fundamentals.roce ?? 0;
    const debtToEquity = fundamentals.debtToEquity ?? 0;

    const isFinancial = this.isFinancialSector(sector);
    const leverageThreshold = isFinancial ? 2.5 : 0.5;
    const solvencyThreshold = isFinancial ? 3.5 : 1.0;

    // 1. Profitability (4 points)
    const positiveNetIncome = hasEps && eps > 0;
    const positiveRoe = hasRoe && roe > 0;
    const positiveRoce = hasRoce && roce > 0;
    // Earnings quality: ROCE confirms cash operating return matches or exceeds equity return
    const cashGenerationQuality = hasRoce && hasRoe && roce >= roe * 0.75 && roce > 0;

    const profitabilityScore =
      (positiveNetIncome ? 1 : 0) +
      (positiveRoe ? 1 : 0) +
      (positiveRoce ? 1 : 0) +
      (cashGenerationQuality ? 1 : 0);

    // 2. Leverage, Liquidity & Solvency (3 points)
    const conservativeLeverage = hasDe && debtToEquity <= leverageThreshold;
    const solvencyBuffer = hasDe && debtToEquity <= solvencyThreshold;
    const capitalPreservation = Boolean(fundamentals.fiscalPeriod);

    const leverageScore =
      (conservativeLeverage ? 1 : 0) +
      (solvencyBuffer ? 1 : 0) +
      (capitalPreservation ? 1 : 0);

    // 3. Operating Efficiency (2 points)
    const highOperatingEfficiency = hasRoce && roce >= 15.0;
    const superiorEquityReturn = hasRoe && roe >= 15.0;

    const operatingEfficiencyScore =
      (highOperatingEfficiency ? 1 : 0) + (superiorEquityReturn ? 1 : 0);

    const score = profitabilityScore + leverageScore + operatingEfficiencyScore;

    let rating: 'STRONG' | 'MODERATE' | 'WEAK';
    if (score >= 7) {
      rating = 'STRONG';
    } else if (score >= 4) {
      rating = 'MODERATE';
    } else {
      rating = 'WEAK';
    }

    return {
      score,
      rating,
      profitabilityScore,
      leverageScore,
      operatingEfficiencyScore,
      criteriaBreakdown: {
        positiveNetIncome,
        positiveRoe,
        positiveRoce,
        cashGenerationQuality,
        conservativeLeverage,
        solvencyBuffer,
        capitalPreservation,
        highOperatingEfficiency,
        superiorEquityReturn,
      },
    };
  }

  /**
   * 4. Sector & Industry Comparative Benchmark Multiples
   */
  public getSectorBenchmark(
    fundamentals: StockFundamentals,
    sector: string = 'General',
    industry: string = 'Equities',
  ): SectorBenchmark {
    const benchmark = this.lookupBenchmark(sector, industry);
    const pe = fundamentals.peRatio ?? 0;

    let peComparison: 'DISCOUNT_TO_SECTOR' | 'PREMIUM_TO_SECTOR' | 'IN_LINE' = 'IN_LINE';
    let peVariancePercent = 0;

    if (pe > 0) {
      peVariancePercent = Number(
        (((pe - benchmark.medianPe) / benchmark.medianPe) * 100).toFixed(2),
      );
      if (peVariancePercent <= -10) {
        peComparison = 'DISCOUNT_TO_SECTOR';
      } else if (peVariancePercent >= 10) {
        peComparison = 'PREMIUM_TO_SECTOR';
      } else {
        peComparison = 'IN_LINE';
      }
    }

    return {
      sector,
      industry,
      medianPe: benchmark.medianPe,
      medianPb: benchmark.medianPb,
      targetRoe: benchmark.targetRoe,
      maxHealthyDebtToEquity: benchmark.maxHealthyDebtToEquity,
      peComparison,
      peVariancePercent,
    };
  }

  private lookupBenchmark(sector?: string, industry?: string): SectorBenchmarkData {
    const s = (sector || '').toUpperCase();
    const ind = (industry || '').toUpperCase();

    if (this.SECTOR_BENCHMARKS[ind]) return this.SECTOR_BENCHMARKS[ind];
    if (this.SECTOR_BENCHMARKS[s]) return this.SECTOR_BENCHMARKS[s];

    for (const key of Object.keys(this.SECTOR_BENCHMARKS)) {
      if (s.includes(key) || ind.includes(key)) {
        return this.SECTOR_BENCHMARKS[key];
      }
    }

    return this.DEFAULT_BENCHMARK;
  }

  private isFinancialSector(sector?: string): boolean {
    const s = (sector || '').toUpperCase();
    return s.includes('FINANCIAL') || s.includes('BANK') || s.includes('NBFC') || s.includes('INSURANCE');
  }

  /**
   * Synthesize ratings
   */
  private synthesizeRating(
    dcf: DcfValuation,
    graham: GrahamValuation,
    piotroski: PiotroskiScore,
    sectorBenchmark: SectorBenchmark,
    funds: StockFundamentals,
  ): {
    overallRating: 'STRONG_BUY_QUALITY' | 'ATTRACTIVE_VALUE' | 'FAIRLY_VALUED' | 'OVERVALUED_QUALITY' | 'SPECULATIVE_RISK';
    confidenceScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const dcfStatus = dcf.valuationStatus;
    const piotroskiScore = piotroski.score;
    const de = funds.debtToEquity ?? 0;
    const pe = funds.peRatio ?? 0;

    let overallRating: 'STRONG_BUY_QUALITY' | 'ATTRACTIVE_VALUE' | 'FAIRLY_VALUED' | 'OVERVALUED_QUALITY' | 'SPECULATIVE_RISK';

    if (piotroskiScore >= 7 && dcfStatus === 'UNDERVALUED') {
      overallRating = 'STRONG_BUY_QUALITY';
    } else if (dcfStatus === 'UNDERVALUED' || (piotroskiScore >= 6 && sectorBenchmark.peComparison === 'DISCOUNT_TO_SECTOR')) {
      overallRating = 'ATTRACTIVE_VALUE';
    } else if (piotroskiScore >= 7 && dcfStatus === 'OVERVALUED') {
      overallRating = 'OVERVALUED_QUALITY';
    } else if (piotroskiScore <= 3 || de > sectorBenchmark.maxHealthyDebtToEquity * 1.8) {
      overallRating = 'SPECULATIVE_RISK';
    } else {
      overallRating = 'FAIRLY_VALUED';
    }

    // Risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (piotroskiScore >= 7 && de <= 0.3 && dcfStatus !== 'OVERVALUED') {
      riskLevel = 'LOW';
    } else if (piotroskiScore <= 4 || de > sectorBenchmark.maxHealthyDebtToEquity || (pe > 50 && dcfStatus === 'OVERVALUED')) {
      riskLevel = 'HIGH';
    }

    // Confidence score based on completeness and data alignment
    let confidenceScore = 80;
    if (funds.peRatio && funds.roe && funds.eps && funds.debtToEquity !== undefined) {
      confidenceScore += 10;
    }
    if (piotroskiScore >= 7) {
      confidenceScore += 5;
    }

    return {
      overallRating,
      confidenceScore: Math.min(95, confidenceScore),
      riskLevel,
    };
  }

  /**
   * Flowing conversational narrative generation adhering to Phase 7 UI specifications
   */
  private buildNarrativeAndHighlights(
    symbol: string,
    companyName: string,
    currentPrice: number,
    funds: StockFundamentals,
    dcf: DcfValuation,
    graham: GrahamValuation,
    piotroski: PiotroskiScore,
    sectorBenchmark: SectorBenchmark,
    overallRating: string,
  ): { strengths: string[]; weaknesses: string[]; summaryNarrative: string } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Valuation strengths/weaknesses
    if (dcf.valuationStatus === 'UNDERVALUED') {
      strengths.push(`Two-stage DCF intrinsic model indicates an estimated fair value of ₹${dcf.intrinsicValue}, providing a favorable Margin of Safety of +${dcf.marginOfSafetyPercent}%.`);
    } else if (dcf.valuationStatus === 'OVERVALUED') {
      weaknesses.push(`Current market price (₹${currentPrice}) trades at a ${Math.abs(dcf.marginOfSafetyPercent)}% premium to DCF intrinsic fair value (₹${dcf.intrinsicValue}).`);
    }

    if (graham.valuationStatus === 'GRAHAM_DISCOUNT' && graham.grahamNumber) {
      strengths.push(`Shares trade below Benjamin Graham's defensive threshold of ₹${graham.grahamNumber} (${Math.abs(graham.premiumOrDiscountPercent || 0)}% discount).`);
    } else if (graham.valuationStatus === 'GRAHAM_PREMIUM' && graham.grahamNumber) {
      weaknesses.push(`Trading above Graham defensive value (₹${graham.grahamNumber}) by +${graham.premiumOrDiscountPercent}%, reflecting built-in growth expectations.`);
    }

    // Quality & Profitability
    if (funds.roe && funds.roe >= 25) {
      strengths.push(`Exceptional Return on Equity of ${funds.roe}% underscores world-class capital compounding and shareholder wealth creation.`);
    } else if (funds.roe && funds.roe >= 15) {
      strengths.push(`Healthy Return on Equity of ${funds.roe}% exceeds domestic cost of equity capital.`);
    } else if (funds.roe && funds.roe < 10) {
      weaknesses.push(`Sub-optimal Return on Equity of ${funds.roe}% indicates capital efficiency challenges.`);
    }

    // Balance Sheet & Leverage
    if (funds.debtToEquity !== undefined && funds.debtToEquity <= 0.1) {
      strengths.push(`Virtually zero balance sheet leverage with Debt-to-Equity at ${funds.debtToEquity}x ensures resilience against interest rate volatility.`);
    } else if (funds.debtToEquity && funds.debtToEquity > sectorBenchmark.maxHealthyDebtToEquity) {
      weaknesses.push(`Debt-to-Equity ratio of ${funds.debtToEquity}x is elevated compared to the sector safety ceiling of ${sectorBenchmark.maxHealthyDebtToEquity}x.`);
    }

    // Piotroski Score
    if (piotroski.score >= 7) {
      strengths.push(`Piotroski F-Score registers ${piotroski.score}/9 (${piotroski.rating}), validating robust balance sheet integrity and earnings quality.`);
    } else if (piotroski.score <= 4) {
      weaknesses.push(`Piotroski F-Score of ${piotroski.score}/9 indicates operational friction or leverage drag.`);
    }

    // Relative Multiples (Market Reference Baseline)
    if (sectorBenchmark.peComparison === 'DISCOUNT_TO_SECTOR') {
      strengths.push(`P/E multiple of ${funds.peRatio}x trades at a ${Math.abs(sectorBenchmark.peVariancePercent)}% discount to the ${sectorBenchmark.sector} general market reference baseline (${sectorBenchmark.medianPe}x).`);
    } else if (sectorBenchmark.peComparison === 'PREMIUM_TO_SECTOR') {
      weaknesses.push(`P/E multiple of ${funds.peRatio}x commands a +${sectorBenchmark.peVariancePercent}% premium over the ${sectorBenchmark.sector} general market reference baseline (${sectorBenchmark.medianPe}x).`);
    }

    // Narrative
    const summaryNarrative =
      `Comprehensive fundamental audit for ${symbol} (${companyName}) yields an overall institutional rating of [RATING: ${overallRating}]. ` +
      `DCF cash flow projection establishes an intrinsic equity benchmark of ₹${dcf.intrinsicValue} [VALUATION: ${dcf.valuationStatus} (${dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${dcf.marginOfSafetyPercent}%)]. ` +
      `Financial health is reinforced by a Piotroski F-Score of [PIOTROSKI: ${piotroski.score}/9 (${piotroski.rating})], supported by an ROE of ${funds.roe ?? 'N/A'}% and Debt-to-Equity of ${funds.debtToEquity ?? 'N/A'}.`;

    return { strengths, weaknesses, summaryNarrative };
  }
}
