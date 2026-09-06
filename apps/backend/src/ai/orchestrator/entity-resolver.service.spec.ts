import { Test, TestingModule } from '@nestjs/testing';
import { EntityResolverService } from './entity-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketService } from '../../market/market.service';

describe('EntityResolverService', () => {
  let service: EntityResolverService;
  let prismaMock: any;
  let marketMock: any;

  beforeEach(async () => {
    prismaMock = {
      stock: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const syms: string[] = where.symbol.in || [];
          const matched: any[] = [];
          for (const s of syms) {
            if (s === 'TCS.NS') {
              matched.push({ symbol: 'TCS.NS', name: 'Tata Consultancy Services', exchange: 'NSE', sector: 'IT Services' });
            }
            if (s === 'BLUEJET.BO') {
              matched.push({ symbol: 'BLUEJET.BO', name: 'Blue Jet Healthcare Ltd', exchange: 'BSE', sector: 'Healthcare' });
            }
          }
          return Promise.resolve(matched);
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      cryptoAsset: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const sym = where?.OR?.[0]?.symbol?.equals;
          const name = where?.OR?.[1]?.name?.equals;
          if (sym === 'BTC' || sym === 'BITCOIN' || name === 'BTC' || name === 'BITCOIN') {
            return Promise.resolve({ symbol: 'BTC', name: 'Bitcoin', category: 'Layer 1' });
          }
          if (sym === 'ETH' || sym === 'ETHEREUM' || name === 'ETH' || name === 'ETHEREUM') {
            return Promise.resolve({ symbol: 'ETH', name: 'Ethereum', category: 'Smart Contracts' });
          }
          if (sym === 'DOGE' || sym === 'DOGECOIN' || name === 'DOGE' || name === 'DOGECOIN') {
            return Promise.resolve({ symbol: 'DOGE', name: 'Dogecoin', category: 'Memecoin' });
          }
          return Promise.resolve(null);
        }),
      },
    };

    marketMock = {
      searchStocks: jest.fn().mockImplementation((query: string) => {
        const q = query.toUpperCase();
        if (q === 'TATA') {
          return Promise.resolve([
            { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Ltd', exchange: 'NSE', sector: 'Automobile' },
            { symbol: 'TATASTEEL.NS', name: 'Tata Steel Ltd', exchange: 'NSE', sector: 'Metals' },
            { symbol: 'TATAPOWER.NS', name: 'Tata Power Ltd', exchange: 'NSE', sector: 'Utilities' },
          ]);
        }
        if (q.includes('BLUEJET') || q.includes('BLUE JET')) {
          return Promise.resolve([
            {
              symbol: 'BLUEJET.NS',
              name: 'Blue Jet Healthcare Ltd',
              exchange: 'NSE, BSE',
              sector: 'Healthcare',
              exchanges: ['NSE', 'BSE'],
              exchangeSymbols: { NSE: 'BLUEJET.NS', BSE: 'BLUEJET.BO' },
            },
          ]);
        }
        if (q === 'MAZDOCK' || q.includes('MAZAGON')) {
          return Promise.resolve([
            { symbol: 'MAZDOCK.NS', name: 'Mazagon Dock Shipbuilders Ltd', exchange: 'NSE', sector: 'Capital Goods' },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityResolverService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MarketService, useValue: marketMock },
      ],
    }).compile();

    service = module.get<EntityResolverService>(EntityResolverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Clean Single Match Resolution', () => {
    it('resolves direct NSE ticker symbol (TCS.NS)', async () => {
      const res = await service.resolveEntities('What is the RSI of TCS.NS?');
      expect(res.status).toBe('RESOLVED');
      expect(res.primarySymbol).toBe('TCS.NS');
      expect(res.symbols).toEqual(['TCS.NS']);
    });

    it('resolves direct BSE ticker symbol (BLUEJET.BO)', async () => {
      const res = await service.resolveEntities('Check price of BLUEJET.BO');
      expect(res.status).toBe('RESOLVED');
      expect(res.primarySymbol).toBe('BLUEJET.BO');
      expect(res.symbols).toEqual(['BLUEJET.BO']);
    });

    it('resolves alias with explicit exchange preference (Tata Motors on NSE)', async () => {
      const res = await service.resolveEntities('Analyze Tata Motors on NSE');
      expect(res.status).toBe('RESOLVED');
      expect(res.primarySymbol).toBe('TATAMOTORS.NS');
      expect(res.symbols).toEqual(['TATAMOTORS.NS']);
    });

    it('resolves alias for single-exchange security (MAZDOCK)', async () => {
      const res = await service.resolveEntities('Tell me about MAZDOCK');
      expect(res.status).toBe('RESOLVED');
      expect(res.primarySymbol).toBe('MAZDOCK.NS');
      expect(res.symbols).toEqual(['MAZDOCK.NS']);
    });
  });

  describe('Ambiguous Multi-Match Resolution', () => {
    it('identifies dual-listed company name without exchange and requests disambiguation (Tata Motors)', async () => {
      const res = await service.resolveEntities('Tell me about Tata Motors');
      expect(res.status).toBe('AMBIGUOUS');
      expect(res.symbols).toContain('TATAMOTORS.NS');
      expect(res.symbols).toContain('TATAMOTORS.BO');
      expect(res.disambiguationPrompt).toContain('TATAMOTORS.NS (NSE) or TATAMOTORS.BO (BSE)?');
    });

    it('identifies dual-listed database result and requests disambiguation (Blue Jet Healthcare)', async () => {
      const res = await service.resolveEntities('What is the outlook for Blue Jet Healthcare?');
      expect(res.status).toBe('AMBIGUOUS');
      expect(res.symbols).toContain('BLUEJET.NS');
      expect(res.symbols).toContain('BLUEJET.BO');
      expect(res.disambiguationPrompt).toContain('BLUEJET.NS (NSE) or BLUEJET.BO (BSE)?');
    });

    it('identifies ambiguous query matching multiple distinct companies (TATA)', async () => {
      const res = await service.resolveEntities('Tell me about TATA');
      expect(res.status).toBe('AMBIGUOUS');
      expect(res.symbols.length).toBeGreaterThanOrEqual(2);
      expect(res.disambiguationPrompt).toContain('I found multiple companies matching "TATA"');
    });
  });

  describe('Not-Found Resolution', () => {
    it('returns NOT_FOUND for unknown ticker with suffix', async () => {
      const res = await service.resolveEntities('What about UNKNOWNSTOCK.NS?');
      expect(res.status).toBe('NOT_FOUND');
      expect(res.symbols).toEqual([]);
      expect(res.disambiguationPrompt).toContain('was not found in the verified NSE/BSE security master');
    });

    it('returns NOT_FOUND for unknown company query', async () => {
      const res = await service.resolveEntities('Analyze FictionalCorpIndia');
      expect(res.status).toBe('NOT_FOUND');
      expect(res.symbols).toEqual([]);
      expect(res.disambiguationPrompt).toContain('No matching security found in NSE or BSE databases');
    });
  });

  describe('Cryptocurrency Resolution', () => {
    it('resolves single cryptocurrency with assetType CRYPTO (what is the RSI of Bitcoin)', async () => {
      const res = await service.resolveEntities('what is the RSI of Bitcoin');
      expect(res.status).toBe('RESOLVED');
      expect(res.primarySymbol).toBe('BTC');
      expect(res.assetType).toBe('CRYPTO');
      expect(res.assetClass).toBe('crypto');
      expect(res.symbols).toEqual(['BTC']);
      expect(res.matchedEntities?.[0]?.assetType).toBe('CRYPTO');
    });

    it('resolves comparative cryptocurrency query with both entities tagged as CRYPTO (bitcoin vs dogecoin)', async () => {
      const res = await service.resolveEntities('bitcoin vs dogecoin');
      expect(res.status).toBe('RESOLVED');
      expect(res.assetType).toBe('CRYPTO');
      expect(res.symbols).toEqual(['BTC', 'DOGE']);
      expect(res.matchedEntities?.[0]?.symbol).toBe('BTC');
      expect(res.matchedEntities?.[0]?.assetType).toBe('CRYPTO');
      expect(res.matchedEntities?.[1]?.symbol).toBe('DOGE');
      expect(res.matchedEntities?.[1]?.assetType).toBe('CRYPTO');
    });
  });
});
