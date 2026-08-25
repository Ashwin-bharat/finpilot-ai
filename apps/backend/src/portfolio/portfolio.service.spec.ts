import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PortfolioService } from './portfolio.service';
import { PortfolioRepository } from './portfolio.repository';
import { PrismaService } from '../prisma/prisma.service';
import { MARKET_DATA_PROVIDER } from '../market/providers/market-data-provider.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionType } from '@prisma/client';

describe('Portfolio Module - Unit Tests', () => {
  let service: PortfolioService;
  let repository: PortfolioRepository;
  let mockMarketDataProvider: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockMarketDataProvider = {
      getQuote: jest.fn().mockImplementation((symbol: string) => {
        if (symbol === 'TCS.NS') {
          return Promise.resolve({
            id: 'stock-tcs',
            symbol: 'TCS.NS',
            name: 'Tata Consultancy Services',
            sector: 'Technology',
            industry: 'IT Services',
            exchange: 'NSE',
            currency: 'INR',
            currentPrice: 4000,
            change: 50,
            changePercent: 1.25,
          });
        }
        if (symbol === 'INFY.NS') {
          return Promise.resolve({
            id: 'stock-infy',
            symbol: 'INFY.NS',
            name: 'Infosys Ltd',
            sector: 'Technology',
            industry: 'IT Services',
            exchange: 'NSE',
            currency: 'INR',
            currentPrice: 1500,
            change: -10,
            changePercent: -0.66,
          });
        }
        if (symbol === 'TATAMOTORS.NS') {
          return Promise.resolve({
            id: 'stock-tm',
            symbol: 'TATAMOTORS.NS',
            name: 'Tata Motors',
            sector: 'Automobile',
            industry: 'Auto Manufacturers',
            exchange: 'NSE',
            currency: 'INR',
            currentPrice: 1000,
            change: 20,
            changePercent: 2.04,
          });
        }
        return Promise.resolve({
          id: 'stock-gen',
          symbol,
          name: symbol,
          sector: 'Diversified',
          industry: 'General',
          exchange: 'NSE',
          currency: 'INR',
          currentPrice: 100,
          change: 0,
          changePercent: 0,
        });
      }),
    };

    mockPrismaService = {
      portfolio: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      stock: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      holding: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        PortfolioRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MARKET_DATA_PROVIDER,
          useValue: mockMarketDataProvider,
        },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
    repository = module.get<PortfolioRepository>(PortfolioRepository);
  });

  describe('1. BUY transaction - weighted-average buy price calculation', () => {
    it('should correctly calculate weighted-average buy price when purchasing additional shares', async () => {
      const existingHolding = {
        id: 'holding-1',
        portfolioId: 'port-1',
        stockId: 'stock-tcs',
        quantity: 10,
        avgBuyPrice: 3000,
      };

      mockPrismaService.portfolio.findFirst.mockResolvedValue({ id: 'port-1', userId: 'user-1' });
      mockPrismaService.stock.findUnique.mockResolvedValue({ id: 'stock-tcs', symbol: 'TCS.NS' });
      mockPrismaService.holding.findFirst.mockResolvedValue(existingHolding);
      mockPrismaService.transaction.create.mockImplementation(({ data }) => Promise.resolve({ id: 'tx-1', ...data, stock: { symbol: 'TCS.NS' }, executedAt: new Date() }));

      // Buying 10 more shares at 4000:
      // Initial: 10 shares @ 3000 = 30000
      // New buy: 10 shares @ 4000 = 40000
      // Total cost: 70000 / 20 shares = 3500 average price
      await repository.executeTransaction('user-1', {
        symbol: 'TCS.NS',
        type: TransactionType.BUY,
        quantity: 10,
        price: 4000,
      });

      expect(mockPrismaService.holding.update).toHaveBeenCalledWith({
        where: { id: 'holding-1' },
        data: {
          quantity: 20,
          avgBuyPrice: 3500,
        },
      });
    });

    it('should calculate precise weighted-average price across irregular quantities and prices', async () => {
      const existingHolding = {
        id: 'holding-2',
        portfolioId: 'port-1',
        stockId: 'stock-infy',
        quantity: 15,
        avgBuyPrice: 1200, // Cost = 18,000
      };

      mockPrismaService.portfolio.findFirst.mockResolvedValue({ id: 'port-1', userId: 'user-1' });
      mockPrismaService.stock.findUnique.mockResolvedValue({ id: 'stock-infy', symbol: 'INFY.NS' });
      mockPrismaService.holding.findFirst.mockResolvedValue(existingHolding);
      mockPrismaService.transaction.create.mockImplementation(({ data }) => Promise.resolve({ id: 'tx-2', ...data, stock: { symbol: 'INFY.NS' }, executedAt: new Date() }));

      // Buy 25 more shares at 1600 (Cost = 40,000)
      // Total quantity: 40
      // Total cost: 58,000
      // Expected weighted avg: 58000 / 40 = 1450
      await repository.executeTransaction('user-1', {
        symbol: 'INFY.NS',
        type: TransactionType.BUY,
        quantity: 25,
        price: 1600,
      });

      expect(mockPrismaService.holding.update).toHaveBeenCalledWith({
        where: { id: 'holding-2' },
        data: {
          quantity: 40,
          avgBuyPrice: 1450,
        },
      });
    });
  });

  describe('2. SELL transaction - holding reduction and full removal', () => {
    it('should reduce holding quantity on partial sell without changing avgBuyPrice', async () => {
      const existingHolding = {
        id: 'holding-1',
        portfolioId: 'port-1',
        stockId: 'stock-tcs',
        quantity: 20,
        avgBuyPrice: 3500,
      };

      mockPrismaService.portfolio.findFirst.mockResolvedValue({ id: 'port-1', userId: 'user-1' });
      mockPrismaService.stock.findUnique.mockResolvedValue({ id: 'stock-tcs', symbol: 'TCS.NS' });
      mockPrismaService.holding.findFirst.mockResolvedValue(existingHolding);
      mockPrismaService.transaction.create.mockImplementation(({ data }) => Promise.resolve({ id: 'tx-3', ...data, stock: { symbol: 'TCS.NS' }, executedAt: new Date() }));

      await repository.executeTransaction('user-1', {
        symbol: 'TCS.NS',
        type: TransactionType.SELL,
        quantity: 5,
        price: 4200,
      });

      expect(mockPrismaService.holding.update).toHaveBeenCalledWith({
        where: { id: 'holding-1' },
        data: {
          quantity: 15,
        },
      });
    });

    it('should completely delete holding when quantity sold matches quantity held', async () => {
      const existingHolding = {
        id: 'holding-1',
        portfolioId: 'port-1',
        stockId: 'stock-tcs',
        quantity: 15,
        avgBuyPrice: 3500,
      };

      mockPrismaService.portfolio.findFirst.mockResolvedValue({ id: 'port-1', userId: 'user-1' });
      mockPrismaService.stock.findUnique.mockResolvedValue({ id: 'stock-tcs', symbol: 'TCS.NS' });
      mockPrismaService.holding.findFirst.mockResolvedValue(existingHolding);
      mockPrismaService.transaction.create.mockImplementation(({ data }) => Promise.resolve({ id: 'tx-4', ...data, stock: { symbol: 'TCS.NS' }, executedAt: new Date() }));

      await repository.executeTransaction('user-1', {
        symbol: 'TCS.NS',
        type: TransactionType.SELL,
        quantity: 15,
        price: 4200,
      });

      expect(mockPrismaService.holding.delete).toHaveBeenCalledWith({
        where: { id: 'holding-1' },
      });
    });
  });

  describe('3. getAnalysis() math and sector allocation', () => {
    it('should compute sector allocation percentages that sum exactly to 100% and calculate correct totalProfit', async () => {
      const mockPortfolioRecord = {
        id: 'port-1',
        userId: 'user-1',
        name: 'Main Portfolio',
        holdings: [
          {
            id: 'h-1',
            portfolioId: 'port-1',
            quantity: 10,
            avgBuyPrice: 3000, // Total cost = 30,000. Live price = 4000. Live val = 40,000
            stock: {
              id: 'stock-tcs',
              symbol: 'TCS.NS',
              name: 'Tata Consultancy Services',
              sector: 'Technology',
              industry: 'IT Services',
              exchange: 'NSE',
              currency: 'INR',
            },
          },
          {
            id: 'h-2',
            portfolioId: 'port-1',
            quantity: 20,
            avgBuyPrice: 800, // Total cost = 16,000. Live price = 1000. Live val = 20,000
            stock: {
              id: 'stock-tm',
              symbol: 'TATAMOTORS.NS',
              name: 'Tata Motors',
              sector: 'Automobile',
              industry: 'Auto',
              exchange: 'NSE',
              currency: 'INR',
            },
          },
        ],
      };

      mockPrismaService.portfolio.findFirst.mockResolvedValue({ id: 'port-1', userId: 'user-1' });
      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolioRecord);

      const analysis = await service.getAnalysis('user-1');

      // Total investment = 30,000 + 16,000 = 46,000
      expect(analysis.totalInvestment).toBe(46000);

      // Current value = 40,000 (Tech) + 20,000 (Auto) = 60,000
      expect(analysis.currentValue).toBe(60000);

      // Total profit = 60,000 - 46,000 = 14,000
      expect(analysis.totalProfit).toBe(14000);

      // Total profit percent = (14000 / 46000) * 100 = 30.43%
      expect(analysis.totalProfitPercent).toBe(30.43);

      // Sector allocations sum check
      expect(analysis.sectorAllocation.length).toBe(2);
      const percentSum = analysis.sectorAllocation.reduce((sum, s) => sum + s.percentage, 0);
      expect(Number(percentSum.toFixed(2))).toBe(100);

      // Tech = 40000 / 60000 * 100 = 66.67%
      // Auto = 20000 / 60000 * 100 = 33.33%
      const techSector = analysis.sectorAllocation.find((s) => s.sector === 'Technology');
      const autoSector = analysis.sectorAllocation.find((s) => s.sector === 'Automobile');
      expect(techSector?.percentage).toBe(66.67);
      expect(autoSector?.percentage).toBe(33.33);
    });
  });

  describe('4. Edge Cases - Over-selling and invalid DTO validation', () => {
    it('should throw BadRequestException when selling more shares than currently held', async () => {
      const existingHolding = {
        id: 'holding-1',
        portfolioId: 'port-1',
        stockId: 'stock-tcs',
        quantity: 5,
        avgBuyPrice: 3000,
      };

      mockPrismaService.portfolio.findFirst.mockResolvedValue({ id: 'port-1', userId: 'user-1' });
      mockPrismaService.stock.findUnique.mockResolvedValue({ id: 'stock-tcs', symbol: 'TCS.NS' });
      mockPrismaService.holding.findFirst.mockResolvedValue(existingHolding);
      mockPrismaService.transaction.create.mockImplementation(({ data }) => Promise.resolve({ id: 'tx-5', ...data, stock: { symbol: 'TCS.NS' }, executedAt: new Date() }));

      await expect(
        repository.executeTransaction('user-1', {
          symbol: 'TCS.NS',
          type: TransactionType.SELL,
          quantity: 10,
          price: 4000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when attempting to sell a stock with no existing holding', async () => {
      mockPrismaService.portfolio.findFirst.mockResolvedValue({ id: 'port-1', userId: 'user-1' });
      mockPrismaService.stock.findUnique.mockResolvedValue({ id: 'stock-infy', symbol: 'INFY.NS' });
      mockPrismaService.holding.findFirst.mockResolvedValue(null);

      await expect(
        repository.executeTransaction('user-1', {
          symbol: 'INFY.NS',
          type: TransactionType.SELL,
          quantity: 1,
          price: 1500,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject zero or negative transaction quantity at DTO validation layer', async () => {
      const zeroDto = plainToInstance(CreateTransactionDto, {
        symbol: 'TCS.NS',
        type: TransactionType.BUY,
        quantity: 0,
        price: 4000,
      });

      const negativeDto = plainToInstance(CreateTransactionDto, {
        symbol: 'TCS.NS',
        type: TransactionType.BUY,
        quantity: -5,
        price: 4000,
      });

      const zeroErrors = await validate(zeroDto);
      expect(zeroErrors.length).toBeGreaterThan(0);
      expect(zeroErrors[0].constraints).toHaveProperty('isPositive');

      const negativeErrors = await validate(negativeDto);
      expect(negativeErrors.length).toBeGreaterThan(0);
      expect(negativeErrors[0].constraints).toHaveProperty('isPositive');
    });
  });
});
