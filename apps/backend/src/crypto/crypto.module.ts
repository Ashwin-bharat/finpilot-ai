import { Module } from '@nestjs/common';
import { CryptoController } from './crypto.controller';
import { CryptoMarketService } from './crypto-market.service';
import { CoinDcxBrokerService } from './broker/coindcx-broker.service';
import { CryptoPortfolioService } from './crypto-portfolio.service';
import { CryptoWatchlistService } from './crypto-watchlist.service';
import { CoinDcxMarketDataProvider } from './providers/coindcx-market-data.provider';
import { MockCryptoDataProvider } from './providers/mock-crypto-data.provider';
import { CRYPTO_DATA_PROVIDER } from './providers/crypto-data-provider.interface';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CryptoController],
  providers: [
    PrismaService,
    CoinDcxMarketDataProvider,
    MockCryptoDataProvider,
    CryptoMarketService,
    CoinDcxBrokerService,
    CryptoPortfolioService,
    CryptoWatchlistService,
    {
      provide: CRYPTO_DATA_PROVIDER,
      useFactory: (coinDcxProvider: CoinDcxMarketDataProvider, mockProvider: MockCryptoDataProvider) => {
        const providerEnv = process.env.CRYPTO_DATA_PROVIDER || 'coindcx';
        if (providerEnv.toLowerCase() === 'mock') {
          return mockProvider;
        }
        return coinDcxProvider;
      },
      inject: [CoinDcxMarketDataProvider, MockCryptoDataProvider],
    },
  ],
  exports: [
    CryptoMarketService,
    CoinDcxBrokerService,
    CryptoPortfolioService,
    CryptoWatchlistService,
    CoinDcxMarketDataProvider,
    MockCryptoDataProvider,
    CRYPTO_DATA_PROVIDER,
  ],
})
export class CryptoModule {}
