import { Injectable, Logger } from '@nestjs/common';
import { NewsArticle, NewsResponse } from '@finpilot/shared-types';
import { NewsProvider } from './news-provider.interface';
import { MockNewsProvider } from './mock-news.provider';

interface CacheEntry {
  data: NewsResponse;
  expiresAt: number;
}

@Injectable()
export class MarketauxNewsProvider implements NewsProvider {
  private readonly logger = new Logger(MarketauxNewsProvider.name);
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL to conserve 100 req/day budget
  private readonly REQUEST_TIMEOUT_MS = 4000; // 4 seconds timeout

  constructor(private readonly fallbackProvider: MockNewsProvider) {}

  private getCached(key: string): NewsResponse | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCached(key: string, data: NewsResponse): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  async getNews(symbol?: string, limit: number = 5): Promise<NewsResponse> {
    const apiKey = process.env.MARKETAUX_API_KEY;
    const cacheKey = `news:${symbol ? symbol.toUpperCase() : 'general'}:${limit}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    if (!apiKey) {
      this.logger.warn('MARKETAUX_API_KEY not configured. Falling back to MockNewsProvider.');
      return this.fallbackProvider.getNews(symbol, limit);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      let url: string;
      if (symbol) {
        // Strip .NS / .BO for ticker search if appropriate or pass symbol directly
        const cleanSymbol = symbol.toUpperCase().replace('.NS', '');
        url = `https://api.marketaux.com/v1/news/all?symbols=${encodeURIComponent(cleanSymbol)}&filter_entities=true&limit=${limit}&api_token=${apiKey}`;
      } else {
        url = `https://api.marketaux.com/v1/news/all?countries=in&filter_entities=true&limit=${limit}&api_token=${apiKey}`;
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Marketaux API returned HTTP status ${response.status}`);
      }

      const data = await response.json();
      const rawArticles = data?.data;

      if (!rawArticles || !Array.isArray(rawArticles) || rawArticles.length === 0) {
        this.logger.warn(`No articles returned from Marketaux for query (${symbol || 'general'}). Using mock fallback.`);
        return this.fallbackProvider.getNews(symbol, limit);
      }

      /**
       * Sentiment Mapping Thresholds:
       * - sentiment_score > 0.15  => POSITIVE (Clearly constructive / bullish news tone)
       * - sentiment_score < -0.15 => NEGATIVE (Clearly adverse / bearish news tone)
       * - Otherwise               => NEUTRAL  (Balanced / factual / ambiguous tone)
       */
      const articles: NewsArticle[] = rawArticles.slice(0, limit).map((a: any, idx: number) => {
        let score = 0;
        if (a.entities && a.entities.length > 0 && typeof a.entities[0].sentiment_score === 'number') {
          score = a.entities[0].sentiment_score;
        } else if (typeof a.sentiment_score === 'number') {
          score = a.sentiment_score;
        }

        let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
        if (score > 0.15) {
          sentiment = 'POSITIVE';
        } else if (score < -0.15) {
          sentiment = 'NEGATIVE';
        }

        const relatedStocks = a.entities?.map((e: any) => e.symbol).filter(Boolean) || (symbol ? [symbol.toUpperCase()] : []);

        return {
          id: a.uuid || `marketaux-${idx}`,
          title: a.title || 'Market Update',
          source: a.source || 'Financial News',
          url: a.url || '#',
          publishedAt: a.published_at || new Date().toISOString(),
          sentiment,
          sentimentConfidence: Number((Math.min(1, Math.max(0.6, Math.abs(score)))).toFixed(2)),
          summary: a.description || a.snippet || a.title,
          relatedStocks,
        };
      });

      const result: NewsResponse = {
        articles,
        isMock: false,
        source: 'marketaux',
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (err: any) {
      clearTimeout(timeoutId);
      this.logger.warn(`MarketauxNewsProvider failed: ${err.message}. Falling back to MockNewsProvider.`);
      return this.fallbackProvider.getNews(symbol, limit);
    }
  }
}
