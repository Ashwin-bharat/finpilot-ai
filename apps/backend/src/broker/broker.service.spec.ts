import { Test, TestingModule } from '@nestjs/testing';
import { BrokerService } from './broker.service';
import { PrismaService } from '../prisma/prisma.service';
import { MarketService } from '../market/market.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { BadRequestException } from '@nestjs/common';
import { TradingMode, TransactionType } from '@prisma/client';

import { WalletService } from '../wallet/wallet.service';

describe('BrokerService Unit Tests', () => {
  let service: BrokerService;
  let prismaMock: any;
  let marketMock: any;
  let portfolioMock: any;
  let walletMock: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@finpilot.ai',
    tradingMode: TradingMode.PAPER,
    liveTradingEnabled: false,
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockUser, ...data })),
      },
      brokerCredential: {
        upsert: jest.fn().mockResolvedValue({
          clientCode: 'TEST_CLIENT_CODE',
          sessionExpiresAt: new Date(Date.now() + 86400000),
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      brokerOrder: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'order-999',
            ...data,
            executedAt: new Date(),
          }),
        ),
        findFirst: jest.fn(),
      },
    };

    marketMock = {
      getStockBySymbol: jest.fn().mockResolvedValue({
        symbol: 'TCS.NS',
        name: 'Tata Consultancy Services',
        currentPrice: 3250.5,
      }),
    };

    portfolioMock = {
      createTransaction: jest.fn().mockResolvedValue({
        id: 'tx-123',
        type: 'BUY',
        quantity: 5,
        price: 3250.5,
      }),
    };

    walletMock = {
      debitForPaperTrade: jest.fn().mockResolvedValue({
        id: 'wtx-1',
        amount: 16252.5,
      }),
      creditForPaperTrade: jest.fn().mockResolvedValue({
        id: 'wtx-2',
        amount: 16252.5,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrokerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MarketService, useValue: marketMock },
        { provide: PortfolioService, useValue: portfolioMock },
        { provide: WalletService, useValue: walletMock },
      ],
    }).compile();

    service = module.get<BrokerService>(BrokerService);
  });

  describe('TOTP & Session Generation', () => {
    it('should generate a valid 6-digit TOTP code using otplib', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const code = service.generateTotp(secret);
      expect(code).toBeDefined();
      expect(code).toMatch(/^\d{6}$/);
    });
  });

  describe('Trading Mode Safety Guards', () => {
    it('should reject switching to LIVE mode without explicit confirmLiveTrading flag', async () => {
      await expect(
        service.toggleTradingMode('user-123', { mode: TradingMode.LIVE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow switching to LIVE mode when confirmLiveTrading is true', async () => {
      const res = await service.toggleTradingMode('user-123', {
        mode: TradingMode.LIVE,
        confirmLiveTrading: true,
      });

      expect(res.tradingMode).toBe(TradingMode.LIVE);
      expect(res.liveTradingEnabled).toBe(true);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { tradingMode: TradingMode.LIVE, liveTradingEnabled: true },
      });
    });

    it('should allow switching back to PAPER mode', async () => {
      const res = await service.toggleTradingMode('user-123', { mode: TradingMode.PAPER });
      expect(res.tradingMode).toBe(TradingMode.PAPER);
    });
  });

  describe('Paper Mode Order Execution', () => {
    it('should execute simulated fill in PAPER mode without calling live broker endpoint', async () => {
      const orderDto = {
        symbol: 'TCS.NS',
        type: TransactionType.BUY,
        quantity: 10,
      };

      const result = await service.placeOrder('user-123', orderDto);

      expect(result.success).toBe(true);
      expect(result.tradingMode).toBe('PAPER');
      expect(result.status).toBe('COMPLETE');
      expect(result.executedPrice).toBe(3250.5);
      expect(result.totalCost).toBe(32505);

      // Verify simulated transaction recorded in portfolio
      expect(portfolioMock.createTransaction).toHaveBeenCalledWith('user-123', {
        symbol: 'TCS.NS',
        type: 'BUY',
        quantity: 10,
        price: 3250.5,
      });

      // Verify BrokerOrder row created in DB with PAPER mode
      expect(prismaMock.brokerOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          symbol: 'TCS.NS',
          transactionType: 'BUY',
          quantity: 10,
          tradingMode: TradingMode.PAPER,
          status: 'COMPLETE',
        }),
      });
    });
  });
});
