import { NewsIntelligenceEngine } from './news-intelligence.engine';
import { NewsArticle } from '@finpilot/shared-types';

describe('NewsIntelligenceEngine', () => {
  let engine: NewsIntelligenceEngine;

  beforeEach(() => {
    engine = new NewsIntelligenceEngine();
  });

  const baseArticles: NewsArticle[] = [
    {
      id: 'art-1',
      title: 'TCS reports solid Q3 profit growth led by BFSI deal wins',
      source: 'Economic Times',
      url: 'https://example.com/1',
      publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      sentiment: 'POSITIVE',
      sentimentConfidence: 0.9,
      summary: 'Tata Consultancy Services announced strong revenue performance in third quarter.',
      relatedStocks: ['TCS.NS'],
    },
    {
      id: 'art-2',
      title: 'TCS Q3 profit rises on strong BFSI mega deal bookings', // Near duplicate of art-1
      source: 'Moneycontrol',
      url: 'https://example.com/2',
      publishedAt: new Date(Date.now() - 1.2 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment: 'POSITIVE',
      sentimentConfidence: 0.85,
      summary: 'Tata Consultancy Services reports quarterly earnings expansion.',
      relatedStocks: ['TCS.NS'],
    },
    {
      id: 'art-3',
      title: 'Indian IT sector faces margin headwinds from delayed US client decisions',
      source: 'Livemint',
      url: 'https://example.com/3',
      publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (older)
      sentiment: 'NEGATIVE',
      sentimentConfidence: 0.75,
      summary: 'Tech stocks across Nifty IT index see softer discretionary tech budgets.',
      relatedStocks: ['INFY.NS', 'TCS.NS', 'WIPRO.NS'],
    },
  ];

  describe('Deduplication', () => {
    it('should identify and merge near-duplicate headlines into a single representative with multiple merged sources', () => {
      const result = engine.analyze(baseArticles, 'marketaux', false, 'TCS.NS', 'Tata Consultancy Services');

      expect(result.totalRawArticles).toBe(3);
      // art-1 and art-2 merged
      expect(result.uniqueArticlesCount).toBe(2);
      expect(result.duplicatesRemovedCount).toBe(1);

      const mergedArticle = result.articles.find((a) => a.title.includes('BFSI'));
      expect(mergedArticle).toBeDefined();
      expect(mergedArticle?.duplicateCount).toBe(1);
      expect(mergedArticle?.mergedSources).toContain('Economic Times');
      expect(mergedArticle?.mergedSources).toContain('Moneycontrol');
    });
  });

  describe('Relevance Scoring', () => {
    it('should assign DIRECT relevance (1.0) to articles directly naming the ticker or company in the title', () => {
      const result = engine.analyze(baseArticles, 'marketaux', false, 'TCS.NS', 'Tata Consultancy Services');

      const direct = result.articles.find((a) => a.title.includes('TCS'));
      expect(direct?.relevanceTier).toBe('DIRECT');
      expect(direct?.relevanceScore).toBe(1.0);
    });

    it('should assign MODERATE (0.6) or SECTOR_WIDE (0.3) to tangential industry-wide articles', () => {
      const result = engine.analyze(baseArticles, 'marketaux', false, 'TCS.NS', 'Tata Consultancy Services');

      const sectorArticle = result.articles.find((a) => a.title.includes('Indian IT sector'));
      expect(sectorArticle?.relevanceTier).toBe('MODERATE'); // Mentioned in relatedStocks / summary
      expect(sectorArticle?.relevanceScore).toBe(0.6);
    });

    it('should sort articles with DIRECT relevance before tangential ones', () => {
      const result = engine.analyze(baseArticles, 'marketaux', false, 'TCS.NS', 'Tata Consultancy Services');
      expect(result.articles[0].relevanceTier).toBe('DIRECT');
    });
  });

  describe('Sentiment Distribution', () => {
    it('should accurately aggregate positive, neutral, and negative counts across deduplicated articles', () => {
      const result = engine.analyze(baseArticles, 'marketaux', false, 'TCS.NS', 'Tata Consultancy Services');

      expect(result.sentimentDistribution.totalArticles).toBe(2);
      expect(result.sentimentDistribution.positiveCount).toBe(1);
      expect(result.sentimentDistribution.negativeCount).toBe(1);
      expect(result.sentimentDistribution.positivePercentage).toBe(50);
      expect(result.sentimentDistribution.negativePercentage).toBe(50);
    });
  });

  describe('Temporal Recency Weighting', () => {
    it('should weight recent news more heavily than older news', () => {
      // art-1 is 1 day old (POSITIVE), art-3 is 10 days old (NEGATIVE)
      // Even though raw distribution is 1 positive and 1 negative, recent positive dominates
      const result = engine.analyze(baseArticles, 'marketaux', false, 'TCS.NS', 'Tata Consultancy Services');

      expect(result.temporalWeighting.weightedScore).toBeGreaterThan(0);
      expect(result.temporalWeighting.weightedSentiment).toBe('BULLISH');
      expect(result.temporalWeighting.recencySummary).toContain('BULLISH');
    });
  });

  describe('Honest Fallback (Mock and Empty feeds)', () => {
    it('should return UNAVAILABLE_DATA when articles array is empty', () => {
      const result = engine.analyze([], 'marketaux', false, 'TCS.NS');

      expect(result.status).toBe('UNAVAILABLE_DATA');
      expect(result.statusMessage).toContain('No reliable news available');
      expect(result.articles.length).toBe(0);
    });

    it('should flag MOCK_DATA when provider is mock, preventing presentation of mock news as genuine', () => {
      const result = engine.analyze(baseArticles, 'mock', true, 'TCS.NS');

      expect(result.status).toBe('MOCK_DATA');
      expect(result.statusMessage).toContain('Provider: mock');
      expect(result.isMock).toBe(true);
    });
  });
});
