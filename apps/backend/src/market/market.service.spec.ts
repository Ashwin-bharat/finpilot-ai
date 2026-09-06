import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';
import { IndicatorsService } from './indicators.service';
import { MARKET_DATA_PROVIDER } from './providers/market-data-provider.interface';

describe('MarketService - Dual-Listed Grouping & Security Master Search', () => {
  let marketService: MarketService;
  let prismaMock: any;
  let mockProvider: any;

  beforeEach(async () => {
    prismaMock = {
      stock: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const allStocks = [
            { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd.', exchange: 'NSE', sector: 'Energy' },
            { symbol: 'RELIANCE.BO', name: 'Reliance Industries Limited', exchange: 'BSE', sector: 'Energy' },
            { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd.', exchange: 'NSE', sector: 'Information Technology' },
            { symbol: 'TCS.BO', name: 'Tata Consultancy Services Limited', exchange: 'BSE', sector: 'Information Technology' },
            { symbol: '7SEAS.BO', name: '7Seas Entertainment Ltd.', exchange: 'BSE', sector: 'Diversified' },
            { symbol: 'COCHINSHIP.NS', name: 'Cochin Shipyard Ltd.', exchange: 'NSE', sector: 'Capital Goods' },
            { symbol: 'MRF.NS', name: 'MRF Limited', exchange: 'NSE', sector: 'Automobile' },
            { symbol: 'MRF.BO', name: 'MRF Limited', exchange: 'BSE', sector: 'Automobile' },
            { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSE', sector: 'Financial Services' },
            { symbol: 'SBIN.BO', name: 'State Bank of India', exchange: 'BSE', sector: 'Financial Services' },
          ];

          if (!where || !where.OR) return Promise.resolve(allStocks);

          return Promise.resolve(allStocks);
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    mockProvider = {
      getQuote: jest.fn().mockResolvedValue({
        id: 'RELIANCE.NS',
        symbol: 'RELIANCE.NS',
        name: 'Reliance Industries Ltd.',
        sector: 'Energy',
        industry: 'Oil & Gas',
        exchange: 'NSE',
        currency: 'INR',
        currentPrice: 2980.0,
        change: 45.0,
        changePercent: 1.53,
      }),
      getHistory: jest.fn().mockResolvedValue([]),
      getTopMovers: jest.fn().mockResolvedValue({ gainers: [], losers: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: IndicatorsService, useValue: { calculateIndicators: jest.fn() } },
        { provide: MARKET_DATA_PROVIDER, useValue: mockProvider },
      ],
    }).compile();

    marketService = module.get<MarketService>(MarketService);
  });

  it('groups dual-listed stock (RELIANCE.NS and RELIANCE.BO) into ONE search result with both exchange options', async () => {
    const results = await marketService.searchStocks('RELIANCE');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('RELIANCE.NS');
    expect(results[0].exchanges).toEqual(['NSE', 'BSE']);
    expect(results[0].exchangeSymbols).toEqual({
      NSE: 'RELIANCE.NS',
      BSE: 'RELIANCE.BO',
    });
  });

  it('groups dual-listed stock TCS into ONE search result', async () => {
    const results = await marketService.searchStocks('TCS');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('TCS.NS');
    expect(results[0].exchanges).toEqual(['NSE', 'BSE']);
    expect(results[0].exchangeSymbols).toEqual({
      NSE: 'TCS.NS',
      BSE: 'TCS.BO',
    });
  });

  it('correctly returns a BSE-only company with BSE exchange tag', async () => {
    const results = await marketService.searchStocks('7SEAS');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('7SEAS.BO');
    expect(results[0].exchanges).toEqual(['BSE']);
    expect(results[0].exchangeSymbols).toEqual({
      BSE: '7SEAS.BO',
    });
  });

  it('resolves SBI alias to SBIN.NS with dual exchange listings', async () => {
    const results = await marketService.searchStocks('sbi');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('SBIN.NS');
    expect(results[0].name).toBe('State Bank of India');
    expect(results[0].exchanges).toContain('NSE');
    expect(results[0].exchanges).toContain('BSE');
  });

  it('finds and groups MRF as top result with dual exchange listings', async () => {
    const results = await marketService.searchStocks('mrf');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].symbol).toBe('MRF.NS');
    expect(results[0].name).toBe('MRF Limited');
    expect(results[0].exchanges).toContain('NSE');
    expect(results[0].exchanges).toContain('BSE');
  });
});
