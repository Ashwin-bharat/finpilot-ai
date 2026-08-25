import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { IndicatorsService } from './indicators.service';
import { PrismaService } from '../prisma/prisma.service';
import { MARKET_DATA_PROVIDER } from './providers/market-data-provider.interface';
import { MockMarketDataProvider } from './providers/mock-market-data.provider';
import { YahooMarketDataProvider } from './providers/yahoo-market-data.provider';

@Module({
  controllers: [MarketController],
  providers: [
    MarketService,
    IndicatorsService,
    PrismaService,
    MockMarketDataProvider,
    YahooMarketDataProvider,
    {
      provide: MARKET_DATA_PROVIDER,
      useFactory: (mockProvider: MockMarketDataProvider, yahooProvider: YahooMarketDataProvider) => {
        const provider = process.env.MARKET_DATA_PROVIDER || 'yahoo';
        if (provider.toLowerCase() === 'yahoo') {
          return yahooProvider;
        }
        return mockProvider;
      },
      inject: [MockMarketDataProvider, YahooMarketDataProvider],
    },
  ],
  exports: [MarketService, IndicatorsService, MARKET_DATA_PROVIDER],
})
export class MarketModule {}
