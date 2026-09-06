import { Injectable, Logger } from '@nestjs/common';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { MarketService } from '../../market/market.service';
import {
  PortfolioIntelligenceResult,
  HoldingPnlContribution,
  ConcentrationAlert,
  HoldingCorrelationPair,
  StockPricePoint,
} from '@finpilot/shared-types';

@Injectable()
export class PortfolioIntelligenceEngine {
  private readonly logger = new Logger(PortfolioIntelligenceEngine.name);

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly marketService: MarketService,
  ) {}

  /**
   * Main Portfolio Intelligence Entrypoint
   * Extends existing PortfolioService analysis with:
   *  1. Top and worst P&L contributors
   *  2. Concentration analysis (configurable holding & sector threshold)
   *  3. Pairwise daily return correlations (with honest INSUFFICIENT_DATA for short histories)
   *
   * STRICT TENANT ISOLATION: Scoped strictly to authenticated userId.
   */
  async analyze(
    userId: string,
    holdingThresholdPercent: number = 25,
    sectorThresholdPercent: number = 25,
  ): Promise<PortfolioIntelligenceResult> {
    this.logger.log(`Executing Portfolio Intelligence analysis for user: ${userId}`);

    // Strictly scope all database reads to authenticated userId
    const [portfolio, analysis] = await Promise.all([
      this.portfolioService.getPortfolio(userId),
      this.portfolioService.getAnalysis(userId),
    ]);

    const holdings = portfolio.holdings || [];
    const totalValue = portfolio.totalValue || 0;
    const totalCost = analysis.totalInvestment || 0;
    const totalProfit = analysis.totalProfit || 0;
    const totalProfitPercent = analysis.totalProfitPercent || 0;

    // Handle Empty Portfolio
    if (holdings.length === 0) {
      return {
        userId,
        portfolioId: portfolio.id,
        totalValue: 0,
        totalCost: 0,
        totalProfit: 0,
        totalProfitPercent: 0,
        holdingsCount: 0,
        diversificationScore: 0,
        topContributors: [],
        worstContributors: [],
        concentrationAnalysis: {
          holdingThresholdPercent,
          sectorThresholdPercent,
          holdingAlerts: [],
          sectorAlerts: [],
          hasConcentrationRisk: false,
        },
        correlationMatrix: {
          pairs: [],
          averageCorrelation: null,
          status: 'EMPTY_PORTFOLIO',
          statusMessage: 'Portfolio has no active holdings registered.',
        },
        computedAt: new Date().toISOString(),
      };
    }

    // 1. Top and Worst P&L Contributors
    const pnlContributions: HoldingPnlContribution[] = holdings.map((h) => {
      const hCost = Number((h.quantity * h.avgBuyPrice).toFixed(2));
      const hVal = h.currentValue;
      const hReturn = Number((hVal - hCost).toFixed(2));
      const hReturnPct = hCost > 0 ? Number(((hReturn / hCost) * 100).toFixed(2)) : 0;
      const shareOfProfit =
        Math.abs(totalProfit) > 0
          ? Number(((hReturn / Math.abs(totalProfit)) * 100).toFixed(2))
          : 0;

      return {
        symbol: h.stock.symbol,
        holdingId: h.id,
        quantity: h.quantity,
        avgBuyPrice: h.avgBuyPrice,
        currentPrice: h.stock.currentPrice || h.avgBuyPrice,
        currentValue: hVal,
        totalCost: hCost,
        totalReturn: hReturn,
        totalReturnPercent: hReturnPct,
        contributionToPortfolioPnlPercent: shareOfProfit,
      };
    });

    const sortedByProfitDesc = [...pnlContributions].sort((a, b) => b.totalReturn - a.totalReturn);
    const topContributors = sortedByProfitDesc.slice(0, 3);
    const worstContributors = [...sortedByProfitDesc].reverse().slice(0, 3);

    // 2. Concentration Analysis (Holding and Sector)
    const holdingAlerts: ConcentrationAlert[] = [];
    for (const h of holdings) {
      const pct = totalValue > 0 ? Number(((h.currentValue / totalValue) * 100).toFixed(2)) : 0;
      if (pct > holdingThresholdPercent) {
        holdingAlerts.push({
          entityType: 'HOLDING',
          identifier: h.stock.symbol,
          currentPercentage: pct,
          thresholdPercentage: holdingThresholdPercent,
          isConcentrated: true,
          message: `Holding ${h.stock.symbol} represents ${pct}% of portfolio value, exceeding the ${holdingThresholdPercent}% threshold.`,
        });
      }
    }

    const sectorAlerts: ConcentrationAlert[] = [];
    for (const s of analysis.sectorAllocation || []) {
      if (s.percentage > sectorThresholdPercent) {
        sectorAlerts.push({
          entityType: 'SECTOR',
          identifier: s.sector,
          currentPercentage: s.percentage,
          thresholdPercentage: sectorThresholdPercent,
          isConcentrated: true,
          message: `Sector ${s.sector} represents ${s.percentage}% of portfolio allocation, exceeding the ${sectorThresholdPercent}% diversification ceiling.`,
        });
      }
    }

    const hasConcentrationRisk = holdingAlerts.length > 0 || sectorAlerts.length > 0;

    // 3. Pairwise Daily Return Correlations
    let correlationStatus: 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'SINGLE_HOLDING' | 'EMPTY_PORTFOLIO' =
      'AVAILABLE';
    let correlationMessage = 'Pairwise correlation calculated across active holdings.';
    const correlationPairs: HoldingCorrelationPair[] = [];

    if (holdings.length === 1) {
      correlationStatus = 'SINGLE_HOLDING';
      correlationMessage = 'Single holding portfolio; pairwise correlation cannot be computed.';
    } else {
      // Fetch histories for all distinct holding symbols
      const uniqueSymbols = Array.from(new Set(holdings.map((h) => h.stock.symbol)));
      const historyMap = new Map<string, StockPricePoint[]>();

      await Promise.all(
        uniqueSymbols.map(async (sym) => {
          try {
            const hist = await this.marketService.getHistory(sym, '1y');
            historyMap.set(sym, hist || []);
          } catch {
            historyMap.set(sym, []);
          }
        }),
      );

      // Compute pairwise correlations for all distinct pairs (i < j)
      for (let i = 0; i < uniqueSymbols.length; i++) {
        for (let j = i + 1; j < uniqueSymbols.length; j++) {
          const symA = uniqueSymbols[i];
          const symB = uniqueSymbols[j];
          const histA = historyMap.get(symA) || [];
          const histB = historyMap.get(symB) || [];

          const pairCorrelation = this.calculatePairwiseCorrelation(symA, symB, histA, histB);
          correlationPairs.push(pairCorrelation);
        }
      }

      if (correlationPairs.some((p) => p.status === 'INSUFFICIENT_DATA')) {
        correlationMessage =
          'Some holding pairs have insufficient price history (<30 overlapping trading days) for correlation.';
      }
    }

    const availableCorrelations = correlationPairs
      .filter((p) => p.status === 'AVAILABLE' && p.correlation !== null)
      .map((p) => p.correlation!);

    const averageCorrelation =
      availableCorrelations.length > 0
        ? Number(
            (
              availableCorrelations.reduce((acc, v) => acc + v, 0) / availableCorrelations.length
            ).toFixed(2),
          )
        : null;

    return {
      userId,
      portfolioId: portfolio.id,
      totalValue,
      totalCost,
      totalProfit,
      totalProfitPercent,
      holdingsCount: holdings.length,
      diversificationScore: analysis.diversificationScore,
      topContributors,
      worstContributors,
      concentrationAnalysis: {
        holdingThresholdPercent,
        sectorThresholdPercent,
        holdingAlerts,
        sectorAlerts,
        hasConcentrationRisk,
      },
      correlationMatrix: {
        pairs: correlationPairs,
        averageCorrelation,
        status: correlationStatus,
        statusMessage: correlationMessage,
      },
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Pearson correlation between daily returns of two stocks over overlapping trading days
   */
  calculatePairwiseCorrelation(
    symbolA: string,
    symbolB: string,
    historyA: StockPricePoint[],
    historyB: StockPricePoint[],
  ): HoldingCorrelationPair {
    if (!historyA || historyA.length < 30 || !historyB || historyB.length < 30) {
      return {
        symbolA,
        symbolB,
        correlation: null,
        overlapDays: Math.min(historyA?.length || 0, historyB?.length || 0),
        status: 'INSUFFICIENT_DATA',
        reason: 'History too short (<30 trading days) for reliable correlation.',
      };
    }

    // Map timestamps to closes
    const mapA = new Map<string, number>();
    for (const pt of historyA) {
      const d = pt.timestamp.split('T')[0];
      if (pt.close > 0) mapA.set(d, pt.close);
    }

    const mapB = new Map<string, number>();
    for (const pt of historyB) {
      const d = pt.timestamp.split('T')[0];
      if (pt.close > 0) mapB.set(d, pt.close);
    }

    const commonDates = Array.from(mapA.keys())
      .filter((d) => mapB.has(d))
      .sort();

    if (commonDates.length < 31) {
      return {
        symbolA,
        symbolB,
        correlation: null,
        overlapDays: Math.max(0, commonDates.length - 1),
        status: 'INSUFFICIENT_DATA',
        reason: `Fewer than 30 overlapping trading days (found ${Math.max(0, commonDates.length - 1)} days).`,
      };
    }

    const returnsA: number[] = [];
    const returnsB: number[] = [];

    for (let i = 1; i < commonDates.length; i++) {
      const prevDate = commonDates[i - 1];
      const currDate = commonDates[i];

      const aPrev = mapA.get(prevDate)!;
      const aCurr = mapA.get(currDate)!;
      const bPrev = mapB.get(prevDate)!;
      const bCurr = mapB.get(currDate)!;

      returnsA.push((aCurr - aPrev) / aPrev);
      returnsB.push((bCurr - bPrev) / bPrev);
    }

    const n = returnsA.length;
    const meanA = returnsA.reduce((sum, r) => sum + r, 0) / n;
    const meanB = returnsB.reduce((sum, r) => sum + r, 0) / n;

    let numerator = 0;
    let sumSqA = 0;
    let sumSqB = 0;

    for (let i = 0; i < n; i++) {
      const diffA = returnsA[i] - meanA;
      const diffB = returnsB[i] - meanB;
      numerator += diffA * diffB;
      sumSqA += diffA * diffA;
      sumSqB += diffB * diffB;
    }

    const denominator = Math.sqrt(sumSqA * sumSqB);
    if (denominator <= 0) {
      return {
        symbolA,
        symbolB,
        correlation: 0,
        overlapDays: n,
        status: 'AVAILABLE',
      };
    }

    const correlation = Number((numerator / denominator).toFixed(2));

    return {
      symbolA,
      symbolB,
      correlation,
      overlapDays: n,
      status: 'AVAILABLE',
    };
  }
}
