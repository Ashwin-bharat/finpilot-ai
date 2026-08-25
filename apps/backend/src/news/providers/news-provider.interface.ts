import { NewsResponse, NewsArticle } from '@finpilot/shared-types';

export const NEWS_PROVIDER = 'NEWS_PROVIDER';

export interface NewsProvider {
  getNews(symbol?: string, limit?: number): Promise<NewsResponse>;
}
