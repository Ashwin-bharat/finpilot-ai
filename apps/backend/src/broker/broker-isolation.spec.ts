import { Test, TestingModule } from '@nestjs/testing';
import { BrokerService } from './broker.service';
import { PrismaService } from '../prisma/prisma.service';
import { MarketService } from '../market/market.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { WalletService } from '../wallet/wallet.service';
import { BadRequestException } from '@nestjs/common';
import { TradingMode, TransactionType } from '@prisma/client';

describe('STRICT Multi-Tenant Broker Isolation & Per-User Credential Tests', () => {
  let service: BrokerService;
  let mockPrisma: any;
  let mockMarket: any;
  let mockPortfolio: any;
  let mockWallet: any;

  // In-memory mock database store simulating Prisma
  let credentialsStore: Array<{
    id: string;
    userId: string;
    brokerName: string;
    clientCode?: string | null;
    encryptedApiKey: string;
    encryptedPin?: string | null;
    encryptedTotpSecret?: string | null;
    encryptedApiSecret?: string | null;
    encryptedJwtToken?: string | null;
    encryptedRefreshToken?: string | null;
    encryptedFeedToken?: string | null;
    sessionExpiresAt?: Date | null;
  }> = [];

  const usersStore: Record<string, any> = {
    'user-alice': {
      id: 'user-alice',
      email: 'alice@example.com',
      tradingMode: TradingMode.LIVE,
      liveTradingEnabled: true,
      cryptoTradingMode: TradingMode.PAPER,
      cryptoLiveTradingEnabled: false,
    },
    'user-bob': {
      id: 'user-bob',
      email: 'bob@example.com',
      tradingMode: TradingMode.LIVE,
      liveTradingEnabled: true,
      cryptoTradingMode: TradingMode.PAPER,
      cryptoLiveTradingEnabled: false,
    },
  };

  beforeEach(async () => {
    credentialsStore = [];

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where, include }) => {
          const u = usersStore[where.id];
          if (!u) return Promise.resolve(null);
          const res = { ...u };
          if (include?.brokerCredentials) {
            res.brokerCredentials = credentialsStore.filter((c) => c.userId === where.id);
          }
          if (include?.cryptoBrokerCredential) {
            res.cryptoBrokerCredential = null;
          }
          return Promise.resolve(res);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          if (usersStore[where.id]) {
            Object.assign(usersStore[where.id], data);
            return Promise.resolve(usersStore[where.id]);
          }
          return Promise.resolve(null);
        }),
      },
      brokerCredential: {
        upsert: jest.fn().mockImplementation(({ where, create, update }) => {
          const { userId, brokerName } = where.userId_brokerName;
          const idx = credentialsStore.findIndex((c) => c.userId === userId && c.brokerName === brokerName);
          if (idx >= 0) {
            Object.assign(credentialsStore[idx], update);
            return Promise.resolve(credentialsStore[idx]);
          } else {
            const newRecord = { id: `cred-${Date.now()}-${Math.random()}`, ...create };
            credentialsStore.push(newRecord);
            return Promise.resolve(newRecord);
          }
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const { userId, brokerName } = where.userId_brokerName;
          const found = credentialsStore.find((c) => c.userId === userId && c.brokerName === brokerName);
          return Promise.resolve(found || null);
        }),
        deleteMany: jest.fn().mockImplementation(({ where }) => {
          const prevLen = credentialsStore.length;
          credentialsStore = credentialsStore.filter(
            (c) => !(c.userId === where.userId && (!where.brokerName || c.brokerName === where.brokerName)),
          );
          return Promise.resolve({ count: prevLen - credentialsStore.length });
        }),
      },
      brokerOrder: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'order-live-1',
            ...data,
            executedAt: new Date(),
          }),
        ),
      },
    };

    mockMarket = {
      getStockBySymbol: jest.fn().mockResolvedValue({
        symbol: 'TCS.NS',
        name: 'Tata Consultancy Services',
        currentPrice: 3500.0,
      }),
    };

    mockPortfolio = {
      createTransaction: jest.fn().mockResolvedValue({ id: 'tx-1' }),
    };

    mockWallet = {
      debitForPaperTrade: jest.fn().mockResolvedValue({ id: 'w-1' }),
      creditForPaperTrade: jest.fn().mockResolvedValue({ id: 'w-2' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrokerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MarketService, useValue: mockMarket },
        { provide: PortfolioService, useValue: mockPortfolio },
        { provide: WalletService, useValue: mockWallet },
      ],
    }).compile();

    service = module.get<BrokerService>(BrokerService);
  });

  describe('1. Zero Shared Environment Variable Fallback', () => {
    it('should REJECT Angel One connect with empty/missing credentials, even if process.env exists', async () => {
      // Temporarily simulate process.env having rogue developer variables
      process.env.ANGEL_ONE_API_KEY = 'rogue_dev_key';
      process.env.ANGEL_ONE_CLIENT_CODE = 'ROGUE123';

      try {
        await expect(
          service.connect('user-alice', {} as any),
        ).rejects.toThrow(BadRequestException);
      } finally {
        delete process.env.ANGEL_ONE_API_KEY;
        delete process.env.ANGEL_ONE_CLIENT_CODE;
      }
    });

    it('should REJECT Zerodha connect when API Key or Secret are missing', async () => {
      await expect(
        service.connectZerodha('user-alice', { apiKey: '', apiSecret: '' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Cross-Tenant Status & Credential Leakage Prevention', () => {
    it('should strictly isolate connected broker status between Alice and Bob', async () => {
      // Alice connects her own Angel One credentials
      await service.connect('user-alice', {
        apiKey: 'alice_api_key_123',
        clientCode: 'ALICE_CODE',
        pin: '1234',
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });

      // Alice checks status -> sees connected & her client code
      const aliceStatus = await service.getStatus('user-alice');
      expect(aliceStatus.brokerConnected).toBe(true);
      expect(aliceStatus.brokerClientCode).toBe('ALICE_CODE');

      // Bob checks status -> sees NOT connected & null client code
      const bobStatus = await service.getStatus('user-bob');
      expect(bobStatus.brokerConnected).toBe(false);
      expect(bobStatus.brokerClientCode).toBeNull();
      expect(bobStatus.sessionExpiresAt).toBeNull();
    });

    it('should return isolated multi-broker lists in getAllBrokersStatus', async () => {
      // Alice connects Angel One & Zerodha
      await service.connect('user-alice', {
        apiKey: 'alice_key',
        clientCode: 'ALICE_CODE',
        pin: '1234',
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });
      await service.connectZerodha('user-alice', {
        apiKey: 'alice_kite_key',
        apiSecret: 'alice_kite_secret',
      });

      // Bob connects only Zerodha with his own key
      await service.connectZerodha('user-bob', {
        apiKey: 'bob_kite_key',
        apiSecret: 'bob_kite_secret',
      });

      const aliceAll = await service.getAllBrokersStatus('user-alice');
      const bobAll = await service.getAllBrokersStatus('user-bob');

      const aliceAngel = aliceAll.brokers.find((b) => b.brokerName === 'ANGEL_ONE');
      const aliceZerodha = aliceAll.brokers.find((b) => b.brokerName === 'ZERODHA');

      const bobAngel = bobAll.brokers.find((b) => b.brokerName === 'ANGEL_ONE');
      const bobZerodha = bobAll.brokers.find((b) => b.brokerName === 'ZERODHA');

      // Alice has both connected
      expect(aliceAngel?.connected).toBe(true);
      expect(aliceAngel?.clientCode).toBe('ALICE_CODE');
      expect(aliceZerodha?.connected).toBe(true);

      // Bob has Angel One NOT connected, Zerodha connected
      expect(bobAngel?.connected).toBe(false);
      expect(bobAngel?.clientCode).toBeNull();
      expect(bobZerodha?.connected).toBe(true);
    });
  });

  describe('3. Cross-Tenant Live Order Hijacking Prevention', () => {
    it('should PREVENT Bob from executing LIVE orders using Alice credentials', async () => {
      // Alice has connected broker credentials
      await service.connect('user-alice', {
        apiKey: 'alice_api_key',
        clientCode: 'ALICE999',
        pin: '9999',
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });

      // Bob has NO broker credentials
      // Bob attempts to place a LIVE trade
      await expect(
        service.placeOrder('user-bob', {
          symbol: 'TCS.NS',
          type: TransactionType.BUY,
          quantity: 10,
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify prisma mock was queried strictly with Bob's user ID
      expect(mockPrisma.brokerCredential.findUnique).toHaveBeenCalledWith({
        where: { userId_brokerName: { userId: 'user-bob', brokerName: 'ANGEL_ONE' } },
      });
    });
  });

  describe('4. Disconnection Scope Isolation', () => {
    it('should only disconnect the calling user broker without affecting other tenants', async () => {
      // Alice connects Angel One
      await service.connect('user-alice', {
        apiKey: 'alice_key',
        clientCode: 'ALICE_CODE',
        pin: '1234',
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });

      // Bob connects Angel One
      await service.connect('user-bob', {
        apiKey: 'bob_key',
        clientCode: 'BOB_CODE',
        pin: '5678',
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });

      expect(credentialsStore.length).toBe(2);

      // Alice disconnects her Angel One broker
      const disconnectRes = await service.disconnect('user-alice', 'ANGEL_ONE');
      expect(disconnectRes.success).toBe(true);

      // Alice is disconnected
      const aliceStatus = await service.getStatus('user-alice');
      expect(aliceStatus.brokerConnected).toBe(false);

      // Bob remains connected!
      const bobStatus = await service.getStatus('user-bob');
      expect(bobStatus.brokerConnected).toBe(true);
      expect(bobStatus.brokerClientCode).toBe('BOB_CODE');
      expect(credentialsStore.length).toBe(1);
      expect(credentialsStore[0].userId).toBe('user-bob');
    });
  });
});
