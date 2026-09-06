import { Injectable, Logger } from '@nestjs/common';
import {
  StockPricePoint,
  StockFundamentals,
  HistoricalVolatility,
  StockBeta,
  MaximumDrawdown,
  ValueAtRisk,
  CompositeRiskScore,
  RiskAnalysisResult,
} from '@finpilot/shared-types';

export interface RiskAnalysisOptions {
  assetClass?: 'EQUITY' | 'CRYPTO';
  benchmarkSymbol?: string;
}

@Injectable()
export class RiskAnalysisEngine {
  private readonly logger = new Logger(RiskAnalysisEngine.name);

  /**
   * Main Risk Analysis Entrypoint
   * Deterministic math, zero LLM tokens.
   */
  analyze(
    symbol: string,
    currentPrice: number,
    stockHistory: StockPricePoint[],
    benchmarkHistory?: StockPricePoint[] | null,
    fundamentals?: StockFundamentals | null,
    windowDays: number = 60,
    options?: RiskAnalysisOptions,
  ): RiskAnalysisResult {
    const isCrypto = options?.assetClass === 'CRYPTO';

    // 1. Calculate Historical Volatility (Crypto calibrated)
    const volatility = this.calculateVolatility(stockHistory, windowDays, isCrypto);

    // 2. Calculate Beta vs Benchmark (NIFTY 50 for equities, BTC for crypto)
    const beta = this.calculateBeta(
      stockHistory,
      benchmarkHistory,
      windowDays,
      isCrypto ? options?.benchmarkSymbol || 'BTC' : '^NSEI',
      isCrypto,
    );

    // 3. Calculate Maximum Drawdown
    const maxDrawdown = this.calculateMaxDrawdown(stockHistory, windowDays);

    // 4. Calculate Value at Risk (VaR 95% Historical Simulation)
    const var95 = this.calculateVaR(stockHistory, currentPrice, windowDays);

    // 5. Calculate Composite Risk Score (0-100)
    const compositeRiskScore = this.calculateCompositeRiskScore(
      volatility,
      maxDrawdown,
      fundamentals,
      isCrypto,
    );

    return {
      symbol: symbol.toUpperCase(),
      currentPrice,
      windowDays,
      volatility,
      beta,
      maxDrawdown,
      var95,
      compositeRiskScore,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * 1. Annualized Historical Volatility
   * Window: default 60 trading days.
   * Requires at least 30 trading days for statistical validity; otherwise INSUFFICIENT_DATA interpretation.
   */
  calculateVolatility(
    history: StockPricePoint[],
    windowDays: number = 60,
    isCrypto: boolean = false,
  ): HistoricalVolatility {
    if (!history || history.length < 2) {
      return {
        windowDays,
        dailyVolatilityPercent: 0,
        annualizedVolatilityPercent: 0,
        interpretation: 'LOW',
      };
    }

    const windowPoints = history.slice(-Math.max(windowDays, 2));
    const returns: number[] = [];

    for (let i = 1; i < windowPoints.length; i++) {
      const prev = windowPoints[i - 1].close;
      const curr = windowPoints[i].close;
      if (prev > 0) {
        returns.push((curr - prev) / prev);
      }
    }

    if (returns.length < 2) {
      return {
        windowDays,
        dailyVolatilityPercent: 0,
        annualizedVolatilityPercent: 0,
        interpretation: 'LOW',
      };
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const dailyStdDev = Math.sqrt(variance);

    // Crypto trades 365 days/year; Equities trade ~252 days/year
    const annualizationFactor = isCrypto ? Math.sqrt(365) : Math.sqrt(252);
    const annualizedStdDev = dailyStdDev * annualizationFactor;

    const dailyVolPercent = Number((dailyStdDev * 100).toFixed(2));
    const annVolPercent = Number((annualizedStdDev * 100).toFixed(2));

    let interpretation: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME' = 'MODERATE';
    if (isCrypto) {
      // Recalibrated thresholds for Crypto (Crypto baseline volatility is 3-4x higher than equities)
      if (annVolPercent < 40) interpretation = 'LOW';
      else if (annVolPercent < 75) interpretation = 'MODERATE';
      else if (annVolPercent < 110) interpretation = 'HIGH';
      else interpretation = 'EXTREME';
    } else {
      // Standard Equity thresholds
      if (annVolPercent < 15) interpretation = 'LOW';
      else if (annVolPercent < 30) interpretation = 'MODERATE';
      else if (annVolPercent < 45) interpretation = 'HIGH';
      else interpretation = 'EXTREME';
    }

    return {
      windowDays: windowPoints.length,
      dailyVolatilityPercent: dailyVolPercent,
      annualizedVolatilityPercent: annVolPercent,
      interpretation,
    };
  }

  /**
   * 2. Beta vs Benchmark (NIFTY 50: ^NSEI for equities, BTC for crypto)
   * Beta = Cov(R_stock, R_benchmark) / Var(R_benchmark)
   * Strict honest INSUFFICIENT_DATA fallback if benchmark is unavailable or overlapping days < 30.
   */
  calculateBeta(
    stockHistory: StockPricePoint[],
    benchmarkHistory?: StockPricePoint[] | null,
    windowDays: number = 60,
    benchmarkSymbol: string = '^NSEI',
    isCrypto: boolean = false,
  ): StockBeta {
    const defaultBenchmark = isCrypto ? 'BTC' : '^NSEI';
    const effectiveBenchmark = benchmarkSymbol || defaultBenchmark;

    if (!benchmarkHistory || benchmarkHistory.length < 30 || !stockHistory || stockHistory.length < 30) {
      return {
        benchmarkSymbol: effectiveBenchmark,
        windowDays,
        value: null,
        status: 'INSUFFICIENT_DATA',
        reason: isCrypto
          ? 'Bitcoin (BTC) benchmark data unavailable or insufficient history (<30 trading days)'
          : 'NIFTY 50 benchmark data unavailable or insufficient history (<30 trading days)',
      };
    }

    // Build timestamp-indexed close maps (normalized to YYYY-MM-DD)
    const stockMap = new Map<string, number>();
    for (const pt of stockHistory) {
      const dateKey = this.normalizeDate(pt.timestamp);
      if (pt.close > 0) stockMap.set(dateKey, pt.close);
    }

    const benchMap = new Map<string, number>();
    for (const pt of benchmarkHistory) {
      const dateKey = this.normalizeDate(pt.timestamp);
      if (pt.close > 0) benchMap.set(dateKey, pt.close);
    }

    // Find sorted overlapping dates
    const commonDates = Array.from(stockMap.keys())
      .filter((date) => benchMap.has(date))
      .sort();

    const windowDates = commonDates.slice(-Math.max(windowDays + 1, 31));

    if (windowDates.length < 31) {
      return {
        benchmarkSymbol,
        windowDays,
        value: null,
        status: 'INSUFFICIENT_DATA',
        reason: `Insufficient overlapping trading days (${windowDates.length - 1} found, minimum 30 required)`,
      };
    }

    const stockReturns: number[] = [];
    const benchReturns: number[] = [];

    for (let i = 1; i < windowDates.length; i++) {
      const prevDate = windowDates[i - 1];
      const currDate = windowDates[i];

      const sPrev = stockMap.get(prevDate)!;
      const sCurr = stockMap.get(currDate)!;
      const bPrev = benchMap.get(prevDate)!;
      const bCurr = benchMap.get(currDate)!;

      stockReturns.push((sCurr - sPrev) / sPrev);
      benchReturns.push((bCurr - bPrev) / bPrev);
    }

    const n = stockReturns.length;
    const meanStock = stockReturns.reduce((sum, r) => sum + r, 0) / n;
    const meanBench = benchReturns.reduce((sum, r) => sum + r, 0) / n;

    let covariance = 0;
    let benchVariance = 0;

    for (let i = 0; i < n; i++) {
      const diffStock = stockReturns[i] - meanStock;
      const diffBench = benchReturns[i] - meanBench;
      covariance += diffStock * diffBench;
      benchVariance += diffBench * diffBench;
    }

    covariance = covariance / (n - 1);
    benchVariance = benchVariance / (n - 1);

    if (benchVariance <= 0) {
      return {
        benchmarkSymbol,
        windowDays: n,
        value: null,
        status: 'INSUFFICIENT_DATA',
        reason: 'Benchmark variance is zero or invalid',
      };
    }

    const betaValue = Number((covariance / benchVariance).toFixed(2));

    let interpretation: 'DEFENSIVE' | 'MARKET_TRACKING' | 'AGGRESSIVE' | 'HIGH_VOLATILITY' = 'MARKET_TRACKING';
    if (betaValue < 0.8) interpretation = 'DEFENSIVE';
    else if (betaValue <= 1.2) interpretation = 'MARKET_TRACKING';
    else if (betaValue <= 1.6) interpretation = 'AGGRESSIVE';
    else interpretation = 'HIGH_VOLATILITY';

    return {
      benchmarkSymbol,
      windowDays: n,
      value: betaValue,
      status: 'AVAILABLE',
      interpretation,
    };
  }

  /**
   * 3. Maximum Drawdown (Peak to Trough)
   * Tracks largest percentage decline from a historical peak within the window.
   */
  calculateMaxDrawdown(history: StockPricePoint[], windowDays: number = 60): MaximumDrawdown {
    if (!history || history.length < 2) {
      return {
        drawdownPercent: 0,
        peakPrice: 0,
        peakDate: 'N/A',
        troughPrice: 0,
        troughDate: 'N/A',
        recoveryStatus: 'RECOVERED',
        status: 'INSUFFICIENT_DATA',
      };
    }

    const points = history.slice(-Math.max(windowDays, 2));

    let runningPeak = points[0].close;
    let runningPeakDate = points[0].timestamp;

    let maxDd = 0; // 0 or negative
    let bestPeakPrice = runningPeak;
    let bestPeakDate = runningPeakDate;
    let bestTroughPrice = runningPeak;
    let bestTroughDate = runningPeakDate;

    for (let i = 0; i < points.length; i++) {
      const price = points[i].close;
      const date = points[i].timestamp;

      if (price > runningPeak) {
        runningPeak = price;
        runningPeakDate = date;
      } else if (runningPeak > 0) {
        const dd = (price - runningPeak) / runningPeak;
        if (dd < maxDd) {
          maxDd = dd;
          bestPeakPrice = runningPeak;
          bestPeakDate = runningPeakDate;
          bestTroughPrice = price;
          bestTroughDate = date;
        }
      }
    }

    const latestPrice = points[points.length - 1].close;
    const isRecovered = latestPrice >= bestPeakPrice;

    return {
      drawdownPercent: Number((maxDd * 100).toFixed(2)),
      peakPrice: Number(bestPeakPrice.toFixed(2)),
      peakDate: this.normalizeDate(bestPeakDate),
      troughPrice: Number(bestTroughPrice.toFixed(2)),
      troughDate: this.normalizeDate(bestTroughDate),
      recoveryStatus: isRecovered ? 'RECOVERED' : 'IN_DRAWDOWN',
      status: 'AVAILABLE',
    };
  }

  /**
   * 4. Value at Risk (VaR 95% Historical Simulation Method)
   * Uses empirical 5th percentile of actual daily returns over the window.
   * State the method explicitly in output metadata.
   */
  calculateVaR(
    history: StockPricePoint[],
    currentPrice: number,
    windowDays: number = 60,
  ): ValueAtRisk {
    const method = 'HISTORICAL_SIMULATION' as const;
    const methodDescription =
      'Historical simulation (empirical return distribution, 95% confidence, 1-day horizon)';

    if (!history || history.length < 15) {
      return {
        confidenceLevelPercent: 95,
        horizonDays: 1,
        method,
        methodDescription,
        varPercent: 0,
        varRupees: 0,
        sampleDays: history?.length || 0,
        status: 'INSUFFICIENT_DATA',
      };
    }

    const points = history.slice(-Math.max(windowDays, 15));
    const returns: number[] = [];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1].close;
      const curr = points[i].close;
      if (prev > 0) {
        returns.push((curr - prev) / prev);
      }
    }

    if (returns.length < 10) {
      return {
        confidenceLevelPercent: 95,
        horizonDays: 1,
        method,
        methodDescription,
        varPercent: 0,
        varRupees: 0,
        sampleDays: returns.length,
        status: 'INSUFFICIENT_DATA',
      };
    }

    // Sort returns ascending (from most negative loss to most positive gain)
    returns.sort((a, b) => a - b);

    // 5th percentile cutoff
    const p5Index = Math.max(0, Math.floor(0.05 * returns.length));
    const varReturn = returns[p5Index];

    // VaR is reported as positive percentage loss magnitude
    const varPercent = Number((Math.abs(Math.min(0, varReturn)) * 100).toFixed(2));
    const varRupees = Number(((varPercent / 100) * currentPrice).toFixed(2));

    return {
      confidenceLevelPercent: 95,
      horizonDays: 1,
      method,
      methodDescription,
      varPercent,
      varRupees,
      sampleDays: returns.length,
      status: 'AVAILABLE',
    };
  }

  /**
   * 5. Composite Risk Score (0-100)
   * Weighting formula:
   *  - Volatility component: max 35 points (annualized volatility normalized against 50% threshold)
   *  - Drawdown component: max 35 points (max drawdown normalized against 40% threshold)
   *  - Valuation extremes component: max 30 points (P/E extremities and balance sheet leverage)
   * If fundamentals are unavailable, volatility and drawdown are reweighted to 50 points each.
   */
  calculateCompositeRiskScore(
    volatility: HistoricalVolatility,
    maxDrawdown: MaximumDrawdown,
    fundamentals?: StockFundamentals | null,
    isCrypto: boolean = false,
  ): CompositeRiskScore {
    const hasFundamentals = !isCrypto && fundamentals && typeof fundamentals.peRatio === 'number';

    let volScore = 0;
    let ddScore = 0;
    let valScore = 0;
    let formulaDescription = '';

    const absDd = Math.abs(maxDrawdown.drawdownPercent);
    const annVol = volatility.annualizedVolatilityPercent;

    if (isCrypto) {
      // Crypto: Calibrated volatility cap (100%) and drawdown cap (50%). Fundamentals excluded.
      volScore = Math.min(50, Math.round((annVol / 100) * 50));
      ddScore = Math.min(50, Math.round((absDd / 50) * 50));
      valScore = 0;
      formulaDescription =
        'Cryptocurrency Composite Risk Score = Crypto Volatility (50% weight, 100% cap) + Max Drawdown (50% weight, 50% cap). Corporate financial ratios excluded.';
    } else if (hasFundamentals) {
      // 35% Volatility, 35% Drawdown, 30% Valuation
      volScore = Math.min(35, Math.round((annVol / 50) * 35));
      ddScore = Math.min(35, Math.round((absDd / 40) * 35));

      const pe = fundamentals.peRatio!;
      if (pe <= 0) {
        valScore = 30; // Unprofitable / high fundamental uncertainty
      } else if (pe > 50) {
        valScore = Math.min(30, 15 + Math.round(((pe - 50) / 50) * 15));
      } else if (pe >= 20) {
        valScore = 10 + Math.round(((pe - 20) / 30) * 5);
      } else {
        valScore = Math.max(5, Math.round((pe / 20) * 10));
      }

      // Add debt modifier if excessive
      if (typeof fundamentals.debtToEquity === 'number' && fundamentals.debtToEquity > 1.5) {
        valScore = Math.min(30, valScore + 5);
      }

      formulaDescription =
        'Composite Risk Score = Volatility (35% weight, 50% cap) + Max Drawdown (35% weight, 40% cap) + Valuation Multiples (30% weight based on P/E extremity and debt leverage).';
    } else {
      // Re-weighted across Volatility (50%) and Max Drawdown (50%)
      volScore = Math.min(50, Math.round((annVol / 50) * 50));
      ddScore = Math.min(50, Math.round((absDd / 40) * 50));
      valScore = 0;

      formulaDescription =
        'Valuation multiples unavailable; Composite Risk Score = Volatility (50% weight, 50% cap) + Max Drawdown (50% weight, 40% cap).';
    }

    const totalScore = Math.min(100, Math.max(0, volScore + ddScore + valScore));

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (totalScore <= 35) riskLevel = 'LOW';
    else if (totalScore <= 65) riskLevel = 'MEDIUM';
    else riskLevel = 'HIGH';

    const disclaimer =
      'Risk scores are derived strictly from historical price behavior and fundamental valuation ratios. They do not represent a guarantee, prediction, or warranty of future asset performance.';

    return {
      score: totalScore,
      riskLevel,
      components: {
        volatilityScore: volScore,
        drawdownScore: ddScore,
        valuationScore: valScore,
      },
      weightingFormula: formulaDescription,
      disclaimer,
    };
  }

  private normalizeDate(timestamp: string): string {
    try {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
      return timestamp;
    } catch {
      return timestamp;
    }
  }
}
