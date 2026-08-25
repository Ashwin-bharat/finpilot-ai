import { Injectable, Logger } from '@nestjs/common';
import { StructuredAiRecommendation } from '@finpilot/shared-types';

export const CERTAINTY_PHRASES = [
  'guaranteed',
  'will definitely',
  'certain to rise',
  'certain to fall',
  'risk-free',
  "can't lose",
  'cannot lose',
  '100% sure',
  '100% safe',
  'surefire',
  'guarantee',
  'definitely buy',
  'definitely sell',
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  violations: string[];
}

@Injectable()
export class AiResponseValidator {
  private readonly logger = new Logger(AiResponseValidator.name);

  validate(response: any): ValidationResult {
    const violations: string[] = [];

    if (!response || typeof response !== 'object') {
      return { valid: false, error: 'Response is not a valid object', violations: ['Missing root object'] };
    }

    // 1. Schema Completeness Checks
    if (!response.summary || typeof response.summary !== 'string' || response.summary.trim() === '') {
      violations.push('Missing or empty summary field');
    }
    if (!response.technicalAnalysis || typeof response.technicalAnalysis !== 'string') {
      violations.push('Missing technicalAnalysis field');
    }
    if (!response.fundamentalAnalysis || typeof response.fundamentalAnalysis !== 'string') {
      violations.push('Missing fundamentalAnalysis field');
    }
    if (!Array.isArray(response.positives) || response.positives.length === 0) {
      violations.push('Missing or empty positives list');
    }
    if (!Array.isArray(response.negatives) || response.negatives.length === 0) {
      violations.push('Missing or empty negatives list');
    }
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(response.riskLevel)) {
      violations.push(`Invalid riskLevel: "${response.riskLevel}". Must be LOW, MEDIUM, or HIGH`);
    }
    if (
      typeof response.confidenceScore !== 'number' ||
      isNaN(response.confidenceScore) ||
      response.confidenceScore < 0 ||
      response.confidenceScore > 100
    ) {
      violations.push('confidenceScore must be a number between 0 and 100');
    }
    if (!Array.isArray(response.sources) || response.sources.length === 0) {
      violations.push('Missing or empty sources array');
    }

    // 2. Certainty / Deterministic Phrasing Scan
    const fullText = [
      response.summary,
      response.technicalAnalysis,
      response.fundamentalAnalysis,
      ...(Array.isArray(response.positives) ? response.positives : []),
      ...(Array.isArray(response.negatives) ? response.negatives : []),
    ]
      .filter((s) => typeof s === 'string')
      .join(' ')
      .toLowerCase();

    for (const phrase of CERTAINTY_PHRASES) {
      if (fullText.includes(phrase)) {
        violations.push(`Forbidden certainty phrase detected: "${phrase}". Analysis must remain probabilistic and explainable.`);
      }
    }

    if (violations.length > 0) {
      return {
        valid: false,
        error: violations.join('; '),
        violations,
      };
    }

    return { valid: true, violations: [] };
  }

  createSafeFallback(query: string, symbolContext?: string): StructuredAiRecommendation {
    const sym = symbolContext ? symbolContext.toUpperCase() : 'selected equities';
    return {
      summary: `Current market data indicators suggest observing ${sym} with balanced risk management. Financial asset prices remain subject to broader macroeconomic variability, interest rate environments, and industry headwinds.`,
      technicalAnalysis: `Mathematical indicators for ${sym} indicate price action is fluctuating within established trading channels. Momentum metrics should be evaluated alongside moving average convergence rather than taken as directional certainties.`,
      fundamentalAnalysis: `Fundamental valuation ratios and balance sheet leverage for ${sym} reflect current operating margins. Investors should examine quarterly revenue consistency and sector valuation benchmarks.`,
      positives: [
        `Market presence and brand recognition in core business segment.`,
        `Established operating history with audited public filings.`,
      ],
      negatives: [
        `Market fluctuations and competitive margin pressures.`,
        `Macroeconomic and sector-specific cyclical headwinds.`,
      ],
      riskLevel: 'MEDIUM',
      confidenceScore: 65,
      sources: [
        { type: 'Market Data Service', description: 'Live quote and historical price bands' },
        { type: 'Technical Engine', description: 'RSI, SMA, and MACD momentum indicators' },
        { type: 'Corporate Filings', description: 'Audited fundamental valuation ratios' },
      ],
    };
  }
}
