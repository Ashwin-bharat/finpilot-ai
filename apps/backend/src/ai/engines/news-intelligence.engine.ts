import { Injectable, Logger } from '@nestjs/common';
import {
  NewsArticle,
  DeduplicatedNewsArticle,
  NewsSentimentDistribution,
  NewsTemporalWeighting,
  NewsIntelligenceResult,
} from '@finpilot/shared-types';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
  'it', 'its', 'that', 'this', 'these', 'those', 'market', 'markets', 'news', 'today',
  'shares', 'stock', 'stocks', 'price', 'target',
]);

@Injectable()
export class NewsIntelligenceEngine {
  private readonly logger = new Logger(NewsIntelligenceEngine.name);

  /**
   * Main News Intelligence Entrypoint
   * Ingests existing NewsService articles, dedupes headlines, evaluates relevance,
   * aggregates sentiment distribution, and computes temporal recency weighting.
   */
  analyze(
    articles: NewsArticle[],
    sourceProvider: 'marketaux' | 'mock' | 'none' = 'marketaux',
    isMock: boolean = false,
    symbol?: string,
    companyName?: string,
  ): NewsIntelligenceResult {
    const totalRawArticles = articles ? articles.length : 0;

    // 1. Check for empty or mock data (Honest Fallback)
    if (!articles || articles.length === 0) {
      return {
        symbol: symbol?.toUpperCase(),
        sourceProvider,
        isMock,
        articles: [],
        totalRawArticles: 0,
        uniqueArticlesCount: 0,
        duplicatesRemovedCount: 0,
        sentimentDistribution: {
          positiveCount: 0,
          neutralCount: 0,
          negativeCount: 0,
          totalArticles: 0,
          positivePercentage: 0,
          neutralPercentage: 0,
          negativePercentage: 0,
        },
        temporalWeighting: {
          halfLifeDays: 3,
          weightedScore: 0,
          weightedSentiment: 'NEUTRAL',
          recencySummary: 'No articles available for temporal sentiment modeling.',
        },
        status: 'UNAVAILABLE_DATA',
        statusMessage: 'No reliable news available for this ticker.',
        computedAt: new Date().toISOString(),
      };
    }

    // 2. Deduplicate near-duplicate headlines
    const deduplicated = this.deduplicateArticles(articles);
    const duplicatesRemovedCount = totalRawArticles - deduplicated.length;

    // 3. Relevance scoring (Direct vs Tangential)
    const scoredArticles = this.scoreRelevance(deduplicated, symbol, companyName);

    // 4. Sentiment distribution (reusing existing Marketaux tags)
    const sentimentDistribution = this.computeSentimentDistribution(scoredArticles);

    // 5. Temporal exponential decay weighting
    const temporalWeighting = this.computeTemporalWeighting(scoredArticles);

    // 6. Determine final status
    let status: 'RELIABLE' | 'UNAVAILABLE_DATA' | 'MOCK_DATA' = 'RELIABLE';
    let statusMessage = 'Verified live financial media coverage analyzed.';

    if (isMock || sourceProvider === 'mock') {
      status = 'MOCK_DATA';
      statusMessage =
        'Provider: mock (synthetic demo data). No verified live market news available.';
    }

    return {
      symbol: symbol?.toUpperCase(),
      sourceProvider,
      isMock,
      articles: scoredArticles,
      totalRawArticles,
      uniqueArticlesCount: scoredArticles.length,
      duplicatesRemovedCount,
      sentimentDistribution,
      temporalWeighting,
      status,
      statusMessage,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Deduplicate headlines using token-set Jaccard similarity and common keyword overlap
   */
  private deduplicateArticles(articles: NewsArticle[]): DeduplicatedNewsArticle[] {
    const clusters: {
      representative: NewsArticle;
      tokens: Set<string>;
      duplicates: NewsArticle[];
    }[] = [];

    for (const article of articles) {
      const tokens = this.tokenize(article.title);
      let matchedCluster = false;

      for (const cluster of clusters) {
        const similarity = this.calculateJaccard(tokens, cluster.tokens);
        const overlap = this.calculateOverlap(tokens, cluster.tokens);
        const commonCount = this.calculateCommonCount(tokens, cluster.tokens);

        // Near-duplicate if Jaccard >= 0.30 or overlap >= 0.40 or at least 3 identical key terms
        if (similarity >= 0.30 || overlap >= 0.40 || commonCount >= 3) {
          cluster.duplicates.push(article);
          // Upgrade representative if incoming has higher sentiment confidence or longer summary
          if (
            (article.summary?.length || 0) > (cluster.representative.summary?.length || 0) ||
            article.sentimentConfidence > cluster.representative.sentimentConfidence
          ) {
            cluster.representative = article;
            cluster.tokens = tokens;
          }
          matchedCluster = true;
          break;
        }
      }

      if (!matchedCluster) {
        clusters.push({
          representative: article,
          tokens,
          duplicates: [],
        });
      }
    }

    return clusters.map((cluster) => {
      const allSources = [
        cluster.representative.source,
        ...cluster.duplicates.map((d) => d.source),
      ].filter(Boolean);

      const uniqueSources = Array.from(new Set(allSources));

      return {
        id: cluster.representative.id,
        title: cluster.representative.title,
        source: cluster.representative.source,
        url: cluster.representative.url,
        publishedAt: cluster.representative.publishedAt,
        sentiment: cluster.representative.sentiment || 'NEUTRAL',
        sentimentConfidence: cluster.representative.sentimentConfidence || 0.7,
        summary: cluster.representative.summary || '',
        relatedStocks: cluster.representative.relatedStocks || [],
        relevanceScore: 1.0,
        relevanceTier: 'DIRECT' as const,
        duplicateCount: cluster.duplicates.length,
        mergedSources: uniqueSources,
      };
    });
  }

  /**
   * Score articles based on direct mention of ticker/company in title vs summary/relatedStocks
   */
  private scoreRelevance(
    articles: DeduplicatedNewsArticle[],
    symbol?: string,
    companyName?: string,
  ): DeduplicatedNewsArticle[] {
    const cleanTicker = symbol ? symbol.replace(/\.(NS|BO)$/i, '').toUpperCase() : '';
    const nameWords = companyName
      ? companyName
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
      : [];

    const scored = articles.map((article) => {
      const titleLower = article.title.toLowerCase();
      const summaryLower = article.summary.toLowerCase();

      let isDirect = false;
      let isModerate = false;

      // Check title for direct ticker symbol or company name
      if (cleanTicker) {
        const tickerRegex = new RegExp(`\\b${cleanTicker}\\b`, 'i');
        if (tickerRegex.test(article.title)) {
          isDirect = true;
        } else if (
          tickerRegex.test(article.summary) ||
          article.relatedStocks?.some((s) => s.toUpperCase().includes(cleanTicker))
        ) {
          isModerate = true;
        }
      }

      if (!isDirect && nameWords.length > 0) {
        // Match multi-word company name
        const matchCount = nameWords.filter((w) => titleLower.includes(w)).length;
        if (matchCount >= Math.min(2, nameWords.length)) {
          isDirect = true;
        } else if (nameWords.some((w) => summaryLower.includes(w))) {
          isModerate = true;
        }
      }

      let relevanceScore = 0.3;
      let relevanceTier: 'DIRECT' | 'MODERATE' | 'SECTOR_WIDE' = 'SECTOR_WIDE';

      if (isDirect) {
        relevanceScore = 1.0;
        relevanceTier = 'DIRECT';
      } else if (isModerate) {
        relevanceScore = 0.6;
        relevanceTier = 'MODERATE';
      }

      return {
        ...article,
        relevanceScore,
        relevanceTier,
      };
    });

    // Rank: DIRECT first, then by publishedAt descending
    return scored.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }

  /**
   * Aggregate sentiment counts across retrieved articles
   */
  private computeSentimentDistribution(
    articles: DeduplicatedNewsArticle[],
  ): NewsSentimentDistribution {
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;

    for (const a of articles) {
      if (a.sentiment === 'POSITIVE') positiveCount++;
      else if (a.sentiment === 'NEGATIVE') negativeCount++;
      else neutralCount++;
    }

    const totalArticles = articles.length;
    const positivePercentage =
      totalArticles > 0 ? Number(((positiveCount / totalArticles) * 100).toFixed(1)) : 0;
    const neutralPercentage =
      totalArticles > 0 ? Number(((neutralCount / totalArticles) * 100).toFixed(1)) : 0;
    const negativePercentage =
      totalArticles > 0 ? Number(((negativeCount / totalArticles) * 100).toFixed(1)) : 0;

    return {
      positiveCount,
      neutralCount,
      negativeCount,
      totalArticles,
      positivePercentage,
      neutralPercentage,
      negativePercentage,
    };
  }

  /**
   * Temporal recency weighting using exponential decay (half-life = 3 days)
   */
  private computeTemporalWeighting(articles: DeduplicatedNewsArticle[]): NewsTemporalWeighting {
    if (articles.length === 0) {
      return {
        halfLifeDays: 3,
        weightedScore: 0,
        weightedSentiment: 'NEUTRAL',
        recencySummary: 'No articles to weight.',
      };
    }

    const now = Date.now();
    const halfLifeDays = 3;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const article of articles) {
      const pubTime = new Date(article.publishedAt).getTime();
      const ageDays = isNaN(pubTime) ? 3 : Math.max(0, (now - pubTime) / (1000 * 60 * 60 * 24));

      // Weight = 2^(-ageDays / halfLifeDays)
      const weight = Math.pow(2, -ageDays / halfLifeDays);

      let val = 0;
      if (article.sentiment === 'POSITIVE') val = 1;
      else if (article.sentiment === 'NEGATIVE') val = -1;

      // Factor in relevance score
      const combinedWeight = weight * article.relevanceScore;

      weightedSum += val * combinedWeight;
      totalWeight += combinedWeight;
    }

    const weightedScore =
      totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 0;

    let weightedSentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH' = 'NEUTRAL';
    if (weightedScore > 0.15) weightedSentiment = 'BULLISH';
    else if (weightedScore < -0.15) weightedSentiment = 'BEARISH';

    const recencySummary = `Exponential recency decay (half-life ${halfLifeDays}d) reflects ${weightedSentiment} posture (score: ${weightedScore > 0 ? '+' : ''}${weightedScore}).`;

    return {
      halfLifeDays,
      weightedScore,
      weightedSentiment,
      recencySummary,
    };
  }

  private tokenize(text: string): Set<string> {
    if (!text) return new Set();
    const cleaned = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    return new Set(cleaned);
  }

  private calculateJaccard(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private calculateOverlap(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    return intersection / Math.min(setA.size, setB.size);
  }

  private calculateCommonCount(setA: Set<string>, setB: Set<string>): number {
    let count = 0;
    for (const item of setA) {
      if (setB.has(item)) count++;
    }
    return count;
  }
}
