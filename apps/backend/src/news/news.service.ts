import { Inject, Injectable } from '@nestjs/common';
import { NEWS_PROVIDER, NewsProvider } from './providers/news-provider.interface';
import { NewsResponse } from '@finpilot/shared-types';

@Injectable()
export class NewsService {
  constructor(
    @Inject(NEWS_PROVIDER) private readonly newsProvider: NewsProvider,
  ) {}

  async getNews(symbol?: string, limit?: number): Promise<NewsResponse> {
    return this.newsProvider.getNews(symbol, limit || 5);
  }
}
