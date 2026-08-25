import { AiResponseValidator, CERTAINTY_PHRASES } from './ai-response-validator';

describe('AiResponseValidator - Safety & Certainty Logic Unit Tests', () => {
  let validator: AiResponseValidator;

  beforeEach(() => {
    validator = new AiResponseValidator();
  });

  const getValidResponse = () => ({
    summary: 'TCS demonstrates consistent revenue performance with standard market exposure.',
    technicalAnalysis: 'RSI at 52 indicates balanced buying and selling momentum.',
    fundamentalAnalysis: 'P/E ratio of 30.2 aligns with historical IT sector ranges.',
    positives: ['Strong enterprise contract renewals', 'Consistent dividend distribution'],
    negatives: ['Global tech spending volatility', 'Currency exchange fluctuations'],
    riskLevel: 'MEDIUM' as const,
    confidenceScore: 78,
    sources: [
      { type: 'Market Data Service', description: 'Live stock ticker data' },
      { type: 'Technical Engine', description: 'RSI and SMA metrics' },
    ],
  });

  describe('1. Schema Completeness & Validation Rules', () => {
    it('should PASS validation for a fully compliant, hedged response', () => {
      const valid = getValidResponse();
      const result = validator.validate(valid);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.error).toBeUndefined();
    });

    it('should REJECT a response missing confidenceScore', () => {
      const invalid = getValidResponse();
      delete (invalid as any).confidenceScore;

      const result = validator.validate(invalid);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('confidenceScore must be a number between 0 and 100');
    });

    it('should REJECT a response with out-of-bounds confidenceScore (< 0 or > 100)', () => {
      const invalidLow = { ...getValidResponse(), confidenceScore: -10 };
      const invalidHigh = { ...getValidResponse(), confidenceScore: 105 };

      expect(validator.validate(invalidLow).valid).toBe(false);
      expect(validator.validate(invalidHigh).valid).toBe(false);
    });

    it('should REJECT a response missing sources array or containing empty sources array', () => {
      const missingSources = getValidResponse();
      delete (missingSources as any).sources;

      const emptySources = { ...getValidResponse(), sources: [] };

      expect(validator.validate(missingSources).valid).toBe(false);
      expect(validator.validate(missingSources).violations).toContain('Missing or empty sources array');

      expect(validator.validate(emptySources).valid).toBe(false);
      expect(validator.validate(emptySources).violations).toContain('Missing or empty sources array');
    });

    it('should REJECT responses with missing or invalid fields (summary, riskLevel, etc.)', () => {
      const missingSummary = { ...getValidResponse(), summary: '' };
      const invalidRisk = { ...getValidResponse(), riskLevel: 'ZERO_RISK' };

      const resSummary = validator.validate(missingSummary);
      expect(resSummary.valid).toBe(false);
      expect(resSummary.violations).toContain('Missing or empty summary field');

      const resRisk = validator.validate(invalidRisk);
      expect(resRisk.valid).toBe(false);
      expect(resRisk.violations).toContain('Invalid riskLevel: "ZERO_RISK". Must be LOW, MEDIUM, or HIGH');
    });
  });

  describe('2. Certainty / Deterministic Phrasing Scan', () => {
    CERTAINTY_PHRASES.forEach((phrase) => {
      it(`should REJECT response containing forbidden certainty phrase "${phrase}"`, () => {
        const responseWithCertainty = getValidResponse();
        responseWithCertainty.summary = `This investment is ${phrase} according to our model.`;

        const result = validator.validate(responseWithCertainty);

        expect(result.valid).toBe(false);
        expect(result.violations.some((v) => v.includes(phrase))).toBe(true);
      });
    });

    it('should detect forbidden certainty phrasing inside nested arrays like positives or negatives', () => {
      const responseWithCertaintyInPositives = getValidResponse();
      responseWithCertaintyInPositives.positives = ['100% sure profit returns over 12 months'];

      const result = validator.validate(responseWithCertaintyInPositives);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('100% sure'))).toBe(true);
    });
  });

  describe('3. Fallback Recommendation Generation', () => {
    it('should generate a safe, compliant fallback recommendation object when LLM output fails', () => {
      const fallback = validator.createSafeFallback('Analyze TCS stock', 'TCS.NS');

      expect(fallback.riskLevel).toBe('MEDIUM');
      expect(fallback.confidenceScore).toBe(65);
      expect(fallback.sources.length).toBeGreaterThan(0);

      // Verify the generated fallback itself passes validator check
      const validationOfFallback = validator.validate(fallback);
      expect(validationOfFallback.valid).toBe(true);
    });
  });
});
