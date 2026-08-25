import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NEWS_PROVIDER } from './providers/news-provider.interface';
import { MockNewsProvider } from './providers/mock-news.provider';
import { MarketauxNewsProvider } from './providers/marketaux-news.provider';

@Module({
  controllers: [NewsController],
  providers: [
    NewsService,
    MockNewsProvider,
    MarketauxNewsProvider,
    {
      provide: NEWS_PROVIDER,
      useFactory: (mockProvider: MockNewsProvider, marketauxProvider: MarketauxNewsProvider) => {
        const provider = process.env.NEWS_PROVIDER || 'marketaux';
        if (provider.toLowerCase() === 'marketaux') {
          return marketauxProvider;
        }
        return mockProvider;
      },
      inject: [MockNewsProvider, MarketauxNewsProvider],
    },
  ],
  exports: [NewsService, NEWS_PROVIDER],
})
export class NewsModule {}
