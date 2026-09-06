import { Injectable, Logger } from '@nestjs/common';
import {
  CrossEngineNewsSynthesis,
  CrossEnginePortfolioContext,
  CrossEngineRiskSynthesis,
  CrossEngineSynthesisResult,
  EngineSignalVector,
  FundamentalAnalysisResult,
  MarketStructureResult,
  NewsIntelligenceResult,
  PortfolioIntelligenceResult,
  SignalAlignmentStatus,
  StockFundamentals,
  StockQuote,
  TechnicalEngineResult,
  TechnicalFundamentalAlignment,
  TechnicalIndicators,
} from '@finpilot/shared-types';

export interface UserHoldingContext {
  shares: number;
  avgPrice: number;
  currentValue: number;
  allocationPercent: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface CrossEngineSynthesisInput {
  symbol: string;
  quote?: StockQuote;
  indicators?: TechnicalIndicators;
  advancedTechnical?: TechnicalEngineResult;
  marketStructure?: MarketStructureResult;
  fundamentals?: StockFundamentals;
  advancedFundamentals?: FundamentalAnalysisResult;
  riskAnalysis?: any;
  newsIntelligence?: NewsIntelligenceResult;
  portfolioIntelligence?: PortfolioIntelligenceResult;
  userHolding?: UserHoldingContext;
}

@Injectable()
export class CrossEngineSynthesisEngine {
  private readonly logger = new Logger(CrossEngineSynthesisEngine.name);

  /**
   * Synthesize a unified, cross-engine evaluation for an equity.
   * Uses 100% deterministic mathematical vectors (zero LLM token consumption).
   */
  public synthesize(input: CrossEngineSynthesisInput): CrossEngineSynthesisResult {
    const {
      symbol,
      quote,
      indicators,
      advancedTechnical,
      marketStructure,
      fundamentals,
      advancedFundamentals,
      riskAnalysis,
      newsIntelligence,
      userHolding,
    } = input;

    const currentPrice = quote?.currentPrice ?? 0;

    // 1. Technical Directional Vector (S_tech in [-1.0, +1.0])
    const techVector = this.computeTechnicalVector(indicators, advancedTechnical, marketStructure);

    // 2. Fundamental Directional Vector (S_fund in [-1.0, +1.0])
    const fundVector = this.computeFundamentalVector(fundamentals, advancedFundamentals);

    // 3. Risk Favorability Vector (S_risk in [-1.0, +1.0])
    const riskVector = this.computeRiskVector(riskAnalysis);

    // 4. News Sentiment Vector (S_news in [-1.0, +1.0])
    const newsVector = this.computeNewsVector(newsIntelligence);

    // 5. Dynamic Weight Redistribution
    // If news is mock, empty, or unavailable, redistribute its 15% weight
    let wTech = 0.35;
    let wFund = 0.35;
    let wRisk = 0.15;
    let wNews = 0.15;

    if (newsVector.confidence === 'UNAVAILABLE' || newsVector.label === 'UNVERIFIED_OR_EMPTY') {
      wNews = 0.0;
      wTech = 0.40;
      wFund = 0.40;
      wRisk = 0.20;
    }

    techVector.weight = wTech;
    techVector.contribution = Number((wTech * techVector.score).toFixed(3));

    fundVector.weight = wFund;
    fundVector.contribution = Number((wFund * fundVector.score).toFixed(3));

    riskVector.weight = wRisk;
    riskVector.contribution = Number((wRisk * riskVector.score).toFixed(3));

    newsVector.weight = wNews;
    newsVector.contribution = Number((wNews * newsVector.score).toFixed(3));

    // 6. Cross-Engine Divergence & Alignment Evaluation
    const tfAlignment = this.evaluateTechnicalFundamentalAlignment(
      techVector.score,
      fundVector.score,
      advancedFundamentals?.dcf?.marginOfSafetyPercent,
      advancedTechnical?.vwap?.vwap,
      currentPrice,
    );

    // 7. Composite Confluence Score & Net Directional Drift
    const dNet = Number(
      (
        techVector.contribution +
        fundVector.contribution +
        riskVector.contribution +
        newsVector.contribution
      ).toFixed(2),
    );

    // Map net drift [-1.0, +1.0] onto standard [0, 100] index
    const confluenceScore = Math.min(100, Math.max(0, Math.round((dNet + 1) * 50)));

    // 8. Risk Profile Synthesis & Conviction Adjustment
    const riskSynthesis = this.synthesizeRisk(confluenceScore, riskAnalysis, riskVector.score);

    // 9. News Catalyst Synthesis
    const newsSynthesis = this.synthesizeNews(newsIntelligence, tfAlignment.status);

    // 10. Portfolio Context Integration
    const portfolioContext = this.synthesizePortfolioContext(symbol, currentPrice, userHolding);

    // 11. Conviction Level Classification
    let convictionLevel: 'HIGH' | 'MODERATE' | 'LOW' | 'SPECULATIVE' = 'MODERATE';
    if (tfAlignment.status === 'FULL_BULLISH_CONFLUENCE' && riskVector.score >= 0) {
      convictionLevel = 'HIGH';
    } else if (tfAlignment.status === 'SPECULATIVE_MOMENTUM') {
      convictionLevel = 'SPECULATIVE';
    } else if (tfAlignment.conflictScore >= 60) {
      convictionLevel = 'LOW';
    } else {
      convictionLevel = 'MODERATE';
    }

    // 12. Strategic Catalysts and Headwinds
    const { catalysts, headwinds } = this.generateStrategicFactors({
      symbol,
      currentPrice,
      techVector,
      fundVector,
      riskVector,
      newsVector,
      tfAlignment,
      advancedTechnical,
      marketStructure,
      advancedFundamentals,
      riskAnalysis,
      newsIntelligence,
      userHolding,
    });

    // 13. Tactical Execution Playbook
    const tacticalPlaybook = this.generateTacticalPlaybook({
      currentPrice,
      tfAlignment,
      advancedTechnical,
      marketStructure,
      riskAnalysis,
    });

    // 14. Holistic Executive Verdict
    const executiveVerdict = this.buildExecutiveVerdict({
      symbol,
      currentPrice,
      tfAlignment,
      confluenceScore,
      conflictScore: tfAlignment.conflictScore,
      convictionLevel,
      techVector,
      fundVector,
      riskVector,
      newsVector,
      portfolioContext,
    });

    return {
      symbol,
      currentPrice,
      signalAlignment: tfAlignment.status,
      conflictScore: tfAlignment.conflictScore,
      confluenceScore,
      convictionLevel,
      signals: {
        technical: techVector,
        fundamental: fundVector,
        risk: riskVector,
        news: newsVector,
      },
      technicalFundamentalAlignment: tfAlignment,
      riskSynthesis,
      newsSynthesis,
      portfolioContext,
      executiveVerdict,
      strategicCatalysts: catalysts,
      strategicHeadwinds: headwinds,
      tacticalPlaybook,
      computedAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // Vector Builders
  // --------------------------------------------------------------------------

  private computeTechnicalVector(
    ind?: TechnicalIndicators,
    adv?: TechnicalEngineResult,
    ms?: MarketStructureResult,
  ): EngineSignalVector {
    if (adv) {
      const base = (adv.confluenceScore - 50) / 50; // [-1.0, +1.0]

      let trendAdj = 0;
      if (ms?.trend?.includes('BULLISH')) trendAdj = 0.15;
      else if (ms?.trend?.includes('BEARISH')) trendAdj = -0.15;

      let zoneAdj = 0;
      if (ms?.dealingRange?.currentZone === 'DISCOUNT') zoneAdj = 0.10;
      else if (ms?.dealingRange?.currentZone === 'PREMIUM') zoneAdj = -0.10;

      let vwapAdj = 0;
      if (adv.vwap?.bias === 'BUYER_CONTROL') vwapAdj = 0.05;
      else if (adv.vwap?.bias === 'SELLER_CONTROL') vwapAdj = -0.05;

      const score = Number(Math.max(-1, Math.min(1, base + trendAdj + zoneAdj + vwapAdj)).toFixed(2));
      const label =
        score >= 0.4
          ? 'STRONG_BULLISH'
          : score >= 0.15
          ? 'BULLISH'
          : score <= -0.4
          ? 'STRONG_BEARISH'
          : score <= -0.15
          ? 'BEARISH'
          : 'NEUTRAL';

      return {
        score,
        label,
        weight: 0.35,
        contribution: 0,
        confidence: ms ? 'HIGH' : 'MODERATE',
        keyMetricSummary: `Confluence ${adv.confluenceScore}/100 (${adv.rating}), structure ${
          ms?.trend ? ms.trend.replace(/_/g, ' ') : 'STABLE'
        }, dealing zone ${ms?.dealingRange?.currentZone || 'EQUILIBRIUM'}`,
      };
    }

    if (ind) {
      const rsiScore = (ind.rsi.value - 50) / 50;
      const maScore =
        ind.maCrossover?.status === 'BULLISH_ALIGNMENT'
          ? 0.2
          : ind.maCrossover?.status === 'BEARISH_ALIGNMENT'
          ? -0.2
          : 0;
      const score = Number(Math.max(-1, Math.min(1, (rsiScore + maScore) / 2)).toFixed(2));
      return {
        score,
        label: score > 0 ? 'BULLISH' : score < 0 ? 'BEARISH' : 'NEUTRAL',
        weight: 0.35,
        contribution: 0,
        confidence: 'LOW',
        keyMetricSummary: `RSI ${ind.rsi.value}, MA crossover ${ind.maCrossover?.status || 'NEUTRAL'}`,
      };
    }

    return {
      score: 0.0,
      label: 'NEUTRAL',
      weight: 0.35,
      contribution: 0,
      confidence: 'UNAVAILABLE',
      keyMetricSummary: 'Technical indicators unavailable',
    };
  }

  private computeFundamentalVector(
    fund?: StockFundamentals,
    advFund?: FundamentalAnalysisResult,
  ): EngineSignalVector {
    if (advFund) {
      let dcfComp = 0;
      let hasDcf = false;

      if (advFund.dcf) {
        hasDcf = true;
        const mos = advFund.dcf.marginOfSafetyPercent;
        if (mos >= 30) dcfComp = 0.50;
        else if (mos >= 10) dcfComp = 0.30;
        else if (mos >= -10) dcfComp = 0.00;
        else if (mos >= -30) dcfComp = -0.30;
        else dcfComp = -0.50;
      }

      let piotComp = 0;
      if (advFund.piotroski) {
        const p = advFund.piotroski.score;
        if (p >= 7) piotComp = 0.30;
        else if (p >= 4) piotComp = 0.00;
        else piotComp = -0.30;
      }

      let sectorComp = 0;
      if (advFund.sectorBenchmark) {
        const v = advFund.sectorBenchmark.peVariancePercent;
        if (v <= -15) sectorComp = 0.20; // Discount to sector median
        else if (v >= 15) sectorComp = -0.20; // Premium to sector median
      }

      let score = 0;
      if (hasDcf) {
        score = Number(Math.max(-1, Math.min(1, dcfComp + piotComp + sectorComp)).toFixed(2));
      } else {
        score = Number(
          Math.max(-1, Math.min(1, (piotComp / 0.3) * 0.6 + (sectorComp / 0.2) * 0.4)).toFixed(2),
        );
      }

      const label =
        score >= 0.4
          ? 'HIGH_MARGIN_OF_SAFETY'
          : score >= 0.15
          ? 'UNDERVALUED'
          : score <= -0.4
          ? 'SIGNIFICANTLY_OVERVALUED'
          : score <= -0.15
          ? 'VALUATION_EXTENDED'
          : 'FAIRLY_VALUED';

      const dcfNote = advFund.dcf
        ? `DCF MOS ${advFund.dcf.marginOfSafetyPercent >= 0 ? '+' : ''}${advFund.dcf.marginOfSafetyPercent}%`
        : 'DCF N/A';

      return {
        score,
        label,
        weight: 0.35,
        contribution: 0,
        confidence: hasDcf && advFund.piotroski ? 'HIGH' : 'MODERATE',
        keyMetricSummary: `${dcfNote}, Piotroski ${advFund.piotroski?.score ?? 'N/A'}/9, Rating ${
          advFund.overallRating
        }`,
      };
    }

    if (fund) {
      const roeComp = fund.roe && fund.roe > 15 ? 0.2 : 0;
      const debtComp =
        fund.debtToEquity !== undefined && fund.debtToEquity <= 0.5
          ? 0.2
          : fund.debtToEquity && fund.debtToEquity > 1.5
          ? -0.2
          : 0;
      const score = Number((roeComp + debtComp).toFixed(2));
      return {
        score,
        label: score > 0 ? 'UNDERVALUED' : score < 0 ? 'VALUATION_EXTENDED' : 'FAIRLY_VALUED',
        weight: 0.35,
        contribution: 0,
        confidence: 'LOW',
        keyMetricSummary: `ROE ${fund.roe ?? 'N/A'}%, D/E ${fund.debtToEquity ?? 'N/A'}x`,
      };
    }

    return {
      score: 0.0,
      label: 'FAIRLY_VALUED',
      weight: 0.35,
      contribution: 0,
      confidence: 'UNAVAILABLE',
      keyMetricSummary: 'Fundamental balance sheet data unavailable',
    };
  }

  private computeRiskVector(risk?: any): EngineSignalVector {
    if (risk && risk.compositeRiskScore) {
      const compScore = risk.compositeRiskScore.score;
      // Lower risk score (e.g. 20) is favorable (+0.60); higher risk score (e.g. 80) is unfavorable (-0.60)
      const score = Number(Math.max(-1, Math.min(1, (50 - compScore) / 50)).toFixed(2));
      const label =
        score >= 0.3
          ? 'DEFENSIVE_FAVORABLE'
          : score >= -0.1
          ? 'MODERATE_BALANCED'
          : 'AGGRESSIVE_ELEVATED';

      const betaVal =
        risk.beta?.value !== null && risk.beta?.value !== undefined ? risk.beta.value : 'N/A';
      return {
        score,
        label,
        weight: 0.15,
        contribution: 0,
        confidence: risk.beta?.status === 'AVAILABLE' ? 'HIGH' : 'MODERATE',
        keyMetricSummary: `Composite risk ${compScore}/100 (${risk.compositeRiskScore.riskLevel}), Volatility ${risk.volatility?.annualizedVolatilityPercent}% (${risk.volatility?.interpretation}), Beta ${betaVal}`,
      };
    }

    return {
      score: 0.0,
      label: 'MODERATE_BALANCED',
      weight: 0.15,
      contribution: 0,
      confidence: 'UNAVAILABLE',
      keyMetricSummary: 'Historical risk profile unavailable',
    };
  }

  private computeNewsVector(news?: NewsIntelligenceResult): EngineSignalVector {
    if (news && news.status === 'RELIABLE' && news.articles.length > 0) {
      const score = Number(
        Math.max(-1, Math.min(1, news.temporalWeighting.weightedScore)).toFixed(2),
      );
      const label =
        score >= 0.2 ? 'BULLISH' : score <= -0.2 ? 'BEARISH' : 'NEUTRAL';
      return {
        score,
        label,
        weight: 0.15,
        contribution: 0,
        confidence: 'HIGH',
        keyMetricSummary: `Weighted score ${score > 0 ? '+' : ''}${score} (${label}), ${
          news.uniqueArticlesCount
        } unique verified articles`,
      };
    }

    if (news && news.status === 'MOCK_DATA') {
      return {
        score: 0.0,
        label: 'UNVERIFIED_OR_EMPTY',
        weight: 0.0,
        contribution: 0,
        confidence: 'UNAVAILABLE',
        keyMetricSummary: 'News feed using synthetic mock fallback (zero sentiment weight applied)',
      };
    }

    return {
      score: 0.0,
      label: 'UNVERIFIED_OR_EMPTY',
      weight: 0.0,
      contribution: 0,
      confidence: 'UNAVAILABLE',
      keyMetricSummary: 'No verified financial news coverage available',
    };
  }

  // --------------------------------------------------------------------------
  // Alignment & Cross-Engine Synthesis Logic
  // --------------------------------------------------------------------------

  private evaluateTechnicalFundamentalAlignment(
    techScore: number,
    fundScore: number,
    mosPercent?: number,
    vwapPrice?: number,
    currentPrice?: number,
  ): TechnicalFundamentalAlignment {
    const alignmentScore = Number((techScore * fundScore).toFixed(2));
    // Conflict Score: |S_tech - S_fund| / 2 * 100
    const conflictScore = Math.round((Math.abs(techScore - fundScore) / 2) * 100);

    let status: SignalAlignmentStatus = 'NEUTRAL_CONSOLIDATION';
    let divergenceType: 'VALUE_TRAP_RISK' | 'VALUATION_COMPRESSION_RISK' | 'NONE' = 'NONE';
    let narrative = '';

    if (techScore >= 0.25 && fundScore >= 0.20) {
      status = 'FULL_BULLISH_CONFLUENCE';
      divergenceType = 'NONE';
      narrative = `Harmonic Bullish Confluence: Technical momentum and fundamental valuation are in mutual agreement. Audited balance sheet valuation provides an intrinsic Margin of Safety, while institutional price structure confirms constructive accumulation with price supported above key demand levels.`;
    } else if (techScore <= -0.25 && fundScore <= -0.20) {
      status = 'FULL_BEARISH_CONFLUENCE';
      divergenceType = 'NONE';
      narrative = `Dual Bearish Headwinds: Both technical momentum and fundamental valuation signal elevated risk. The equity trades at an expensive valuation with negative margin of safety, while market structure reflects sustained selling pressure beneath overhead institutional supply.`;
    } else if (fundScore >= 0.20 && techScore <= -0.15) {
      status = 'VALUE_MOMENTUM_DIVERGENCE';
      divergenceType = 'VALUE_TRAP_RISK';
      const mosStr = mosPercent !== undefined ? `+${mosPercent}% MOS` : 'attractive intrinsic value';
      const vwapStr =
        vwapPrice && currentPrice && currentPrice < vwapPrice
          ? ` (trading below the ₹${vwapPrice} VWAP ceiling)`
          : '';
      narrative = `Value-Momentum Divergence (Value Trap Alert): Audited balance sheet valuation appears deeply discounted with ${mosStr}, but technical price action remains locked in a confirmed downtrend${vwapStr}. Institutional market structure indicates downward price discovery has not yet found a confirmed demand floor. A disciplined approach advises waiting for a confirmed Market Structure Shift (MSS) before deploying capital, avoiding the risk of catching a falling knife despite attractive valuation.`;
    } else if (techScore >= 0.25 && fundScore <= -0.20) {
      status = 'SPECULATIVE_MOMENTUM';
      divergenceType = 'VALUATION_COMPRESSION_RISK';
      narrative = `Speculative Momentum (Valuation Compression Alert): Strong price momentum and bullish market structure are driving near-term gains, but underlying business fundamentals reflect stretched multiples and a negative Margin of Safety. The rally is supported by market liquidity rather than cash-flow accretion, creating vulnerability to sharp multiple contraction upon any earnings disappointment. Strict trailing stop losses are critical.`;
    } else {
      status = 'NEUTRAL_CONSOLIDATION';
      divergenceType = 'NONE';
      narrative = `Consolidation & Balanced Signals: Price momentum and fundamental metrics are trading within standard equilibrium ranges without strong multi-engine divergence or directional conviction.`;
    }

    return {
      alignmentScore,
      conflictScore,
      status,
      narrative,
      divergenceType,
    };
  }

  private synthesizeRisk(
    confluenceScore: number,
    risk: any,
    riskScore: number,
  ): CrossEngineRiskSynthesis {
    const compScore = risk?.compositeRiskScore?.score ?? 50;
    const penalty = compScore > 50 ? Math.round((compScore - 50) * 0.5) : 0;
    const adjustedConviction = Math.max(0, Math.min(100, confluenceScore - penalty));

    let riskSummary = '';
    if (compScore >= 60) {
      riskSummary = `High asset volatility (Composite score: ${compScore}/100) penalizes net conviction. Downside protection requires wider ATR stop buffers and conservative sizing.`;
    } else if (compScore <= 35) {
      riskSummary = `Defensive risk profile (Composite score: ${compScore}/100) reinforces investment thesis with low historical drawdown severity and stable market co-movement.`;
    } else {
      riskSummary = `Balanced risk profile (Composite score: ${compScore}/100) reflects standard market correlation and manageable drawdown cycles.`;
    }

    return {
      riskAdjustedConviction: adjustedConviction,
      riskPenaltyScore: penalty,
      riskSummary,
    };
  }

  private synthesizeNews(
    news: NewsIntelligenceResult | undefined,
    alignmentStatus: SignalAlignmentStatus,
  ): CrossEngineNewsSynthesis {
    if (!news || news.status !== 'RELIABLE' || news.articles.length === 0) {
      return {
        catalystAlignment: 'NEUTRAL',
        narrative: news?.status === 'MOCK_DATA'
          ? 'News tracking is using fallback mock items. Sentiment catalysts are neutralized per zero-fabrication constraints.'
          : 'Zero live news headlines available. Catalysts remain unconfirmed by financial media.',
      };
    }

    const newsSentiment = news.temporalWeighting.weightedSentiment;
    let catalystAlignment: 'AMPLIFYING' | 'CONTRADICTING' | 'NEUTRAL' = 'NEUTRAL';
    let narrative = '';

    if (alignmentStatus === 'FULL_BULLISH_CONFLUENCE') {
      if (newsSentiment === 'BULLISH') {
        catalystAlignment = 'AMPLIFYING';
        narrative = 'Positive media newsflow aligns with bullish technical momentum and fundamental value, amplifying directional conviction.';
      } else if (newsSentiment === 'BEARISH') {
        catalystAlignment = 'CONTRADICTING';
        narrative = 'Bearish headline sentiment creates short-term friction against the underlying bullish technical and fundamental setup.';
      } else {
        catalystAlignment = 'NEUTRAL';
        narrative = 'Media newsflow is balanced, neither amplifying nor impeding institutional accumulation.';
      }
    } else if (alignmentStatus === 'VALUE_MOMENTUM_DIVERGENCE') {
      if (newsSentiment === 'BEARISH') {
        catalystAlignment = 'AMPLIFYING';
        narrative = 'Negative media sentiment explains prevailing technical selling pressure, reinforcing the value trap caution until headlines settle.';
      } else {
        catalystAlignment = 'NEUTRAL';
        narrative = 'Neutral to constructive media coverage has yet to trigger a bullish technical breakout from discounted valuation.';
      }
    } else if (alignmentStatus === 'SPECULATIVE_MOMENTUM') {
      if (newsSentiment === 'BULLISH') {
        catalystAlignment = 'AMPLIFYING';
        narrative = 'Euphoric media sentiment is fueling momentum expansion despite stretched fundamental multiples.';
      } else {
        catalystAlignment = 'NEUTRAL';
        narrative = 'Media sentiment is moderate despite rapid technical price expansion.';
      }
    } else {
      catalystAlignment = 'NEUTRAL';
      narrative = 'Media sentiment is balanced and consistent with sideways price consolidation.';
    }

    return {
      catalystAlignment,
      narrative,
    };
  }

  private synthesizePortfolioContext(
    symbol: string,
    currentPrice: number,
    holding?: UserHoldingContext,
  ): CrossEnginePortfolioContext {
    if (!holding || holding.shares <= 0) {
      return {
        isHeld: false,
        allocationPercent: 0,
        actionImpact: 'NEW_POSITION',
        narrative: `${symbol} is not currently held in your portfolio. This query is evaluated as a potential new position allocation.`,
      };
    }

    const isConcentrated = holding.allocationPercent >= 25;
    const actionImpact = isConcentrated ? 'INCREASES_CONCENTRATION' : 'REDUCES_RISK';
    const pnlSign = holding.unrealizedPnl >= 0 ? '+' : '';

    let narrative = `Currently held in your portfolio: ${holding.shares} shares (${holding.allocationPercent.toFixed(1)}% of total portfolio value), with an unrealized P&L of ${pnlSign}₹${holding.unrealizedPnl.toFixed(2)} (${pnlSign}${holding.unrealizedPnlPercent.toFixed(2)}%).`;

    if (isConcentrated) {
      narrative += ` WARNING: This position represents ${holding.allocationPercent.toFixed(1)}% of your equity capital, exceeding the 25% single-stock concentration safety threshold. Increasing allocation is discouraged on risk management principles.`;
    }

    return {
      isHeld: true,
      allocationPercent: holding.allocationPercent,
      unrealizedReturnPercent: holding.unrealizedPnlPercent,
      concentrationWarning: isConcentrated
        ? `Holding concentration (${holding.allocationPercent.toFixed(1)}%) exceeds 25% threshold.`
        : undefined,
      actionImpact,
      narrative,
    };
  }

  // --------------------------------------------------------------------------
  // Tactical Factors & Playbook
  // --------------------------------------------------------------------------

  private generateStrategicFactors(ctx: {
    symbol: string;
    currentPrice: number;
    techVector: EngineSignalVector;
    fundVector: EngineSignalVector;
    riskVector: EngineSignalVector;
    newsVector: EngineSignalVector;
    tfAlignment: TechnicalFundamentalAlignment;
    advancedTechnical?: TechnicalEngineResult;
    marketStructure?: MarketStructureResult;
    advancedFundamentals?: FundamentalAnalysisResult;
    riskAnalysis?: any;
    newsIntelligence?: NewsIntelligenceResult;
    userHolding?: UserHoldingContext;
  }): { catalysts: string[]; headwinds: string[] } {
    const catalysts: string[] = [];
    const headwinds: string[] = [];

    // Technical & Structure factors
    if (ctx.techVector.score >= 0.2) {
      catalysts.push(
        `Constructive technical momentum: Confluence score of ${
          ctx.advancedTechnical?.confluenceScore ?? 50
        }/100 (${ctx.techVector.label}) with ${
          ctx.marketStructure?.trend?.replace(/_/g, ' ') || 'stable structure'
        }.`,
      );
    } else if (ctx.techVector.score <= -0.2) {
      headwinds.push(
        `Bearish technical momentum: Confluence score suppressed at ${
          ctx.advancedTechnical?.confluenceScore ?? 50
        }/100 with ${
          ctx.marketStructure?.trend?.replace(/_/g, ' ') || 'bearish expansion'
        }.`,
      );
    }

    if (ctx.marketStructure?.dealingRange?.currentZone === 'DISCOUNT') {
      catalysts.push(
        `Institutional discount pricing: Current price trades in the lower ${ctx.marketStructure.dealingRange.relativePositionPercent}% of the dealing range, offering favorable asymmetric entry.`,
      );
    } else if (ctx.marketStructure?.dealingRange?.currentZone === 'PREMIUM') {
      headwinds.push(
        `Institutional premium pricing: Asset trades in the upper ${ctx.marketStructure.dealingRange.relativePositionPercent}% of the dealing range, where smart money typically trims exposure.`,
      );
    }

    // Fundamental factors
    if (ctx.advancedFundamentals?.dcf?.valuationStatus === 'UNDERVALUED') {
      catalysts.push(
        `Intrinsic valuation discount: Two-stage DCF model estimates fair value at ₹${ctx.advancedFundamentals.dcf.intrinsicValue}, providing a +${ctx.advancedFundamentals.dcf.marginOfSafetyPercent}% Margin of Safety.`,
      );
    } else if (ctx.advancedFundamentals?.dcf?.valuationStatus === 'OVERVALUED') {
      headwinds.push(
        `Valuation extension: Two-stage DCF model indicates equity trades at a ${ctx.advancedFundamentals.dcf.marginOfSafetyPercent}% negative Margin of Safety relative to ₹${ctx.advancedFundamentals.dcf.intrinsicValue} fair value.`,
      );
    }

    if (ctx.advancedFundamentals?.piotroski && ctx.advancedFundamentals.piotroski.score >= 7) {
      catalysts.push(
        `High balance sheet integrity: Piotroski F-Score of ${ctx.advancedFundamentals.piotroski.score}/9 (${ctx.advancedFundamentals.piotroski.rating}) confirms disciplined solvency and operating efficiency.`,
      );
    } else if (ctx.advancedFundamentals?.piotroski && ctx.advancedFundamentals.piotroski.score <= 3) {
      headwinds.push(
        `Weak balance sheet diagnostics: Piotroski F-Score of ${ctx.advancedFundamentals.piotroski.score}/9 flags deteriorating operating cash flows or rising leverage.`,
      );
    }

    // Risk factors
    if (ctx.riskAnalysis?.volatility?.interpretation === 'HIGH') {
      headwinds.push(
        `Elevated historical volatility: 60-day annualized volatility of ${ctx.riskAnalysis.volatility.annualizedVolatilityPercent}% introduces sharp swings and drawdown exposure.`,
      );
    } else if (ctx.riskAnalysis?.volatility?.interpretation === 'LOW') {
      catalysts.push(
        `Defensive volatility regime: 60-day annualized volatility of ${ctx.riskAnalysis.volatility.annualizedVolatilityPercent}% reflects stable price behavior.`,
      );
    }

    if (ctx.riskAnalysis?.beta?.value !== null && ctx.riskAnalysis?.beta?.value > 1.25) {
      headwinds.push(
        `Aggressive market sensitivity: Beta of ${ctx.riskAnalysis.beta.value} vs NIFTY 50 amplifies broader market corrections.`,
      );
    }

    // News factors
    if (ctx.newsVector.confidence === 'HIGH' && ctx.newsVector.score >= 0.25) {
      catalysts.push(
        `Positive media catalyst: Time-weighted sentiment of +${ctx.newsVector.score} indicates constructive business developments.`,
      );
    } else if (ctx.newsVector.confidence === 'HIGH' && ctx.newsVector.score <= -0.25) {
      headwinds.push(
        `Negative media catalyst: Time-weighted sentiment of ${ctx.newsVector.score} flags adverse press headlines.`,
      );
    }

    // Portfolio factors
    if (ctx.userHolding && ctx.userHolding.allocationPercent >= 25) {
      headwinds.push(
        `Portfolio concentration: Position currently represents ${ctx.userHolding.allocationPercent.toFixed(1)}% of your portfolio, exceeding safe diversification guidelines.`,
      );
    }

    // Cross-engine divergence factor
    if (ctx.tfAlignment.status === 'VALUE_MOMENTUM_DIVERGENCE') {
      headwinds.push(
        `Cross-Engine Conflict: Fundamental valuation is cheap but technical trend is downward (Conflict Score: ${ctx.tfAlignment.conflictScore}/100). Premature accumulation risks extended drawdown.`,
      );
    } else if (ctx.tfAlignment.status === 'SPECULATIVE_MOMENTUM') {
      headwinds.push(
        `Cross-Engine Conflict: Momentum is strong but intrinsic valuation is extended (Conflict Score: ${ctx.tfAlignment.conflictScore}/100). Multiple contraction risk is elevated.`,
      );
    }

    return {
      catalysts: catalysts.length > 0 ? catalysts : ['Stable corporate positioning across monitored institutional metrics.'],
      headwinds: headwinds.length > 0 ? headwinds : ['Broad market cyclicality remains a standard consideration.'],
    };
  }

  private generateTacticalPlaybook(ctx: {
    currentPrice: number;
    tfAlignment: TechnicalFundamentalAlignment;
    advancedTechnical?: TechnicalEngineResult;
    marketStructure?: MarketStructureResult;
    riskAnalysis?: any;
  }): {
    bias: 'ACCUMULATE' | 'DEFENSIVE_HOLD' | 'WAIT_FOR_STRUCTURE' | 'TAKE_PROFIT' | 'AVOID';
    keySupportToDefend: number;
    keyResistanceToBreak: number;
    trailingStopLoss: number;
    suggestedCondition: string;
  } {
    const p = ctx.currentPrice || 100;
    const s1 = ctx.advancedTechnical?.supportResistance?.floorPivots?.s1 ?? Number((p * 0.96).toFixed(2));
    const r1 = ctx.advancedTechnical?.supportResistance?.floorPivots?.r1 ?? Number((p * 1.04).toFixed(2));
    const stopPrice =
      ctx.advancedTechnical?.atr?.stopLossBuffer?.recommendedStopPrice ?? Number((p * 0.94).toFixed(2));

    let bias: 'ACCUMULATE' | 'DEFENSIVE_HOLD' | 'WAIT_FOR_STRUCTURE' | 'TAKE_PROFIT' | 'AVOID' =
      'DEFENSIVE_HOLD';
    let suggestedCondition = '';

    switch (ctx.tfAlignment.status) {
      case 'FULL_BULLISH_CONFLUENCE':
        bias = 'ACCUMULATE';
        suggestedCondition = `Accumulate on pullbacks toward S1 support (₹${s1}) while trailing stops remain defended at ₹${stopPrice}. Target breakout confirmation above R1 (₹${r1}).`;
        break;

      case 'VALUE_MOMENTUM_DIVERGENCE':
        bias = 'WAIT_FOR_STRUCTURE';
        suggestedCondition = `Maintain a disciplined watchlist stance. Refrain from immediate buying despite fundamental discount until price reclaims the institutional VWAP anchor (₹${
          ctx.advancedTechnical?.vwap?.vwap ?? r1
        }) and confirms a bullish Market Structure Shift.`;
        break;

      case 'SPECULATIVE_MOMENTUM':
        bias = 'TAKE_PROFIT';
        suggestedCondition = `Tighten dynamic stop-loss to ₹${stopPrice} (1.5x ATR). Consider booking partial profits into tests of R1 resistance (₹${r1}) to hedge against valuation multiple contraction.`;
        break;

      case 'FULL_BEARISH_CONFLUENCE':
        bias = 'AVOID';
        suggestedCondition = `Avoid long exposure. Both valuation multiples and order flow structure confirm downside drift beneath overhead institutional supply.`;
        break;

      case 'NEUTRAL_CONSOLIDATION':
      default:
        bias = 'DEFENSIVE_HOLD';
        suggestedCondition = `Range-bound consolidation dictates patient capital management. Observe reaction between key support floor (₹${s1}) and resistance ceiling (₹${r1}).`;
        break;
    }

    return {
      bias,
      keySupportToDefend: s1,
      keyResistanceToBreak: r1,
      trailingStopLoss: stopPrice,
      suggestedCondition,
    };
  }

  private buildExecutiveVerdict(ctx: {
    symbol: string;
    currentPrice: number;
    tfAlignment: TechnicalFundamentalAlignment;
    confluenceScore: number;
    conflictScore: number;
    convictionLevel: string;
    techVector: EngineSignalVector;
    fundVector: EngineSignalVector;
    riskVector: EngineSignalVector;
    newsVector: EngineSignalVector;
    portfolioContext: CrossEnginePortfolioContext;
  }): string {
    const alignmentLabel = ctx.tfAlignment.status.replace(/_/g, ' ');
    const p = ctx.currentPrice;

    return `Holistic cross-engine synthesis for ${ctx.symbol} (trading at ₹${p}) reveals [SIGNAL ALIGNMENT: ${alignmentLabel}] with [CONFLICT SCORE: ${ctx.conflictScore}/100] and [UNIFIED CONFLUENCE: ${ctx.confluenceScore}/100]. Directional vectors indicate Technical momentum at [TECH: ${ctx.techVector.label} (${ctx.techVector.score > 0 ? '+' : ''}${ctx.techVector.score})], Fundamental valuation at [FUND: ${ctx.fundVector.label} (${ctx.fundVector.score > 0 ? '+' : ''}${ctx.fundVector.score})], and Historical risk at [RISK: ${ctx.riskVector.label} (${ctx.riskVector.score > 0 ? '+' : ''}${ctx.riskVector.score})]. ${ctx.tfAlignment.narrative}`;
  }
}
