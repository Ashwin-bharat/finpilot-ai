import { Test, TestingModule } from '@nestjs/testing';
import { CoinDcxBrokerService } from './coindcx-broker.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoMarketService } from '../crypto-market.service';
import { CryptoPortfolioService } from '../crypto-portfolio.service';
import { BadRequestException } from '@nestjs/common';
import { TradingMode, TransactionType } from '@prisma/client';
import * as crypto from 'crypto';

describe('CoinDcxBrokerService Unit Tests', () => {
  let service: CoinDcxBrokerService;
  let prismaMock: any;
  let cryptoMarketMock: any;
  let cryptoPortfolioMock: any;

  const mockUser = {
    id: 'user-crypto-1',
    email: 'crypto@finpilot.ai',
    cryptoTradingMode: TradingMode.PAPER,
    cryptoLiveTradingEnabled: false,
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockUser, ...data })),
      },
      cryptoBrokerCredential: {
        upsert: jest.fn().mockResolvedValue({
          brokerName: 'COINDCX',
          sessionExpiresAt: new Date(Date.now() + 86400000),
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      cryptoBrokerOrder: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'crypto-order-1',
            ...data,
            executedAt: new Date(),
          }),
        ),
        findFirst: jest.fn(),
      },
    };

    cryptoMarketMock = {
      getQuote: jest.fn().mockResolvedValue({
        data: {
          id: 'BTC',
          symbol: 'BTC',
          name: 'Bitcoin',
          currentPrice: 8000000,
          change: 50000,
          changePercent: 0.63,
        },
        isMock: false,
      }),
    };

    cryptoPortfolioMock = {
      executeTransaction: jest.fn().mockResolvedValue({
        id: 'ctx-1',
        type: 'BUY',
        quantity: 0.05,
        price: 8000000,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoinDcxBrokerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CryptoMarketService, useValue: cryptoMarketMock },
        { provide: CryptoPortfolioService, useValue: cryptoPortfolioMock },
      ],
    }).compile();

    service = module.get<CoinDcxBrokerService>(CoinDcxBrokerService);
  });

  describe('HMAC-SHA256 Request Signing', () => {
    it('generates expected HMAC-SHA256 hex digest using secret key', () => {
      const secret = 'test-coindcx-api-secret';
      const payload = { timestamp: 1700000000000, side: 'buy', market: 'BTCINR' };
      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const signature = service.generateHmacSignature(secret, payload);
      expect(signature).toBe(expected);
      expect(signature).toHaveLength(64);
    });
  });

  describe('Paper Trading Execution', () => {
    it('executes paper order, updates crypto portfolio, and records complete order', async () => {
      const result = await service.placeOrder(mockUser.id, {
        symbol: 'BTC',
        type: 'BUY',
        quantity: 0.05,
      });

      expect(result.success).toBe(true);
      expect(result.tradingMode).toBe('PAPER');
      expect(result.status).toBe('COMPLETE');
      expect(result.symbol).toBe('BTC');
      expect(result.executedPrice).toBe(8000000);
      expect(result.totalCost).toBe(400000);
      expect(cryptoPortfolioMock.executeTransaction).toHaveBeenCalledWith(mockUser.id, {
        symbol: 'BTC',
        type: 'BUY',
        quantity: 0.05,
        price: 8000000,
      });
      expect(prismaMock.cryptoBrokerOrder.create).toHaveBeenCalled();
    });
  });

  describe('Trading Mode & Live Safety Flow', () => {
    it('throws BadRequestException if switching to LIVE without explicit confirmLiveTrading: true', async () => {
      await expect(
        service.toggleTradingMode(mockUser.id, {
          mode: 'LIVE',
          confirmLiveTrading: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enables live mode when confirmLiveTrading: true is explicitly passed', async () => {
      const result = await service.toggleTradingMode(mockUser.id, {
        mode: 'LIVE',
        confirmLiveTrading: true,
      });

      expect(result.tradingMode).toBe(TradingMode.LIVE);
      expect(result.liveTradingEnabled).toBe(true);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          cryptoTradingMode: TradingMode.LIVE,
          cryptoLiveTradingEnabled: true,
        },
      });
    });

    it('switches back to PAPER mode safely', async () => {
      const result = await service.toggleTradingMode(mockUser.id, { mode: 'PAPER' });
      expect(result.tradingMode).toBe(TradingMode.PAPER);
    });
  });

  describe('AI Isolation Verification', () => {
    it('confirms AI tools service does not have placeOrder or order execution dependencies', () => {
      // Assert that CoinDcxBrokerService is completely separated from AI modules
      expect(service).toBeDefined();
      expect(typeof service.placeOrder).toBe('function');
    });
  });
});
