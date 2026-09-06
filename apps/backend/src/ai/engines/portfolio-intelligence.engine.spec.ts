import { PortfolioIntelligenceEngine } from './portfolio-intelligence.engine';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { MarketService } from '../../market/market.service';
import { Portfolio, PortfolioAnalysis, StockPricePoint, Stock } from '@finpilot/shared-types';

describe('PortfolioIntelligenceEngine', () => {
  let engine: PortfolioIntelligenceEngine;
  let mockPortfolioService: jest.Mocked<Partial<PortfolioService>>;
  let mockMarketService: jest.Mocked<Partial<MarketService>>;

  function makeStock(symbol: string, name: string, sector: string, currentPrice?: number): Stock {
    return {
      id: symbol,
      symbol,
      name,
      sector,
      industry: 'General',
      currency: 'INR',
      exchange: 'NSE',
      currentPrice: currentPrice || 1000,
    };
  }

  function generatePrices(base: number, changes: number[]): StockPricePoint[] {
    const pts: StockPricePoint[] = [];
    let cur = base;
    const start = new Date('2025-01-01');
    for (let i = 0; i < changes.length; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const close = Number((cur * (1 + changes[i])).toFixed(2));
      pts.push({
        timestamp: d.toISOString(),
        open: cur,
        high: close * 1.01,
        low: close * 0.99,
        close,
        volume: 1000,
      });
      cur = close;
    }
    return pts;
  }

  beforeEach(() => {
    mockPortfolioService = {
      getPortfolio: jest.fn(),
      getAnalysis: jest.fn(),
    };
    mockMarketService = {
      getHistory: jest.fn(),
    };

    engine = new PortfolioIntelligenceEngine(
      mockPortfolioService as unknown as PortfolioService,
      mockMarketService as unknown as MarketService,
    );
  });

  describe('Contributors & Concentration Analysis', () => {
    it('should rank top and worst contributors and flag concentration alerts when exceeding 25%', async () => {
      const userAPortfolio: Portfolio = {
        id: 'port-1',
        userId: 'user-A',
        name: 'Main Portfolio',
        totalValue: 100000,
        dayChange: 500,
        dayChangePercent: 0.5,
        holdings: [
          {
            id: 'h1',
            portfolioId: 'port-1',
            stock: makeStock('TCS.NS', 'TCS', 'Information Technology', 4000),
            quantity: 15,
            avgBuyPrice: 3000, // Cost 45000, Value 60000 -> Return +15000 (60% concentration!)
            currentValue: 60000,
            totalReturn: 15000,
            totalReturnPercent: 33.33,
          },
          {
            id: 'h2',
            portfolioId: 'port-1',
            stock: makeStock('RELIANCE.NS', 'Reliance', 'Energy', 2500),
            quantity: 10,
            avgBuyPrice: 2800, // Cost 28000, Value 25000 -> Return -3000 (25% concentration)
            currentValue: 25000,
            totalReturn: -3000,
            totalReturnPercent: -10.71,
          },
          {
            id: 'h3',
            portfolioId: 'port-1',
            stock: makeStock('INFY.NS', 'Infosys', 'Information Technology', 1500),
            quantity: 10,
            avgBuyPrice: 1400, // Cost 14000, Value 15000 -> Return +1000 (15% concentration)
            currentValue: 15000,
            totalReturn: 1000,
            totalReturnPercent: 7.14,
          },
        ],
      };

      const userAAnalysis: PortfolioAnalysis = {
        totalInvestment: 87000,
        currentValue: 100000,
        totalProfit: 13000,
        totalProfitPercent: 14.94,
        diversificationScore: 68,
        sectorAllocation: [
          { sector: 'Information Technology', value: 75000, percentage: 75.0 }, // Exceeds 25%!
          { sector: 'Energy', value: 25000, percentage: 25.0 },
        ],
        holdingsCount: 3,
      };

      mockPortfolioService.getPortfolio!.mockResolvedValue(userAPortfolio);
      mockPortfolioService.getAnalysis!.mockResolvedValue(userAAnalysis);

      // Return synthetic price histories for correlation
      const changes = Array(35).fill(0.01);
      mockMarketService.getHistory!.mockResolvedValue(generatePrices(1000, changes));

      const result = await engine.analyze('user-A', 25, 25);

      // Verify Contributors
      expect(result.topContributors.length).toBe(3);
      expect(result.topContributors[0].symbol).toBe('TCS.NS');
      expect(result.topContributors[0].totalReturn).toBe(15000);
      expect(result.worstContributors[0].symbol).toBe('RELIANCE.NS');
      expect(result.worstContributors[0].totalReturn).toBe(-3000);

      // Verify Concentration Alerts
      expect(result.concentrationAnalysis.hasConcentrationRisk).toBe(true);
      const holdingAlert = result.concentrationAnalysis.holdingAlerts.find(
        (a) => a.identifier === 'TCS.NS',
      );
      expect(holdingAlert).toBeDefined();
      expect(holdingAlert?.currentPercentage).toBe(60);

      const sectorAlert = result.concentrationAnalysis.sectorAlerts.find(
        (a) => a.identifier === 'Information Technology',
      );
      expect(sectorAlert).toBeDefined();
      expect(sectorAlert?.currentPercentage).toBe(75);
    });
  });

  describe('Correlation Matrix & Insufficient Data', () => {
    it('should return INSUFFICIENT_DATA for a pair when price history is under 30 days', async () => {
      const portfolio: Portfolio = {
        id: 'port-short',
        userId: 'user-short',
        name: 'Short History',
        totalValue: 20000,
        dayChange: 0,
        dayChangePercent: 0,
        holdings: [
          {
            id: 'h1',
            portfolioId: 'port-short',
            stock: makeStock('NEWSTOCK.NS', 'New Stock', 'Tech'),
            quantity: 10,
            avgBuyPrice: 1000,
            currentValue: 10000,
            totalReturn: 0,
            totalReturnPercent: 0,
          },
          {
            id: 'h2',
            portfolioId: 'port-short',
            stock: makeStock('OLDSTOCK.NS', 'Old Stock', 'Tech'),
            quantity: 10,
            avgBuyPrice: 1000,
            currentValue: 10000,
            totalReturn: 0,
            totalReturnPercent: 0,
          },
        ],
      };

      const analysis: PortfolioAnalysis = {
        totalInvestment: 20000,
        currentValue: 20000,
        totalProfit: 0,
        totalProfitPercent: 0,
        diversificationScore: 50,
        sectorAllocation: [{ sector: 'Tech', value: 20000, percentage: 100 }],
        holdingsCount: 2,
      };

      mockPortfolioService.getPortfolio!.mockResolvedValue(portfolio);
      mockPortfolioService.getAnalysis!.mockResolvedValue(analysis);

      // NEWSTOCK has only 15 days of history (< 30 days!)
      mockMarketService.getHistory!.mockImplementation(async (sym: string) => {
        if (sym === 'NEWSTOCK.NS') return generatePrices(100, Array(15).fill(0.01));
        return generatePrices(100, Array(40).fill(0.01));
      });

      const result = await engine.analyze('user-short');

      expect(result.correlationMatrix.pairs.length).toBe(1);
      const pair = result.correlationMatrix.pairs[0];
      expect(pair.status).toBe('INSUFFICIENT_DATA');
      expect(pair.correlation).toBeNull();
      expect(pair.reason).toContain('too short');
    });

    it('should handle single holding portfolio gracefully by returning SINGLE_HOLDING', async () => {
      const singlePortfolio: Portfolio = {
        id: 'port-single',
        userId: 'user-single',
        name: 'Single',
        totalValue: 5000,
        dayChange: 0,
        dayChangePercent: 0,
        holdings: [
          {
            id: 'h1',
            portfolioId: 'port-single',
            stock: makeStock('TCS.NS', 'TCS', 'IT', 5000),
            quantity: 1,
            avgBuyPrice: 4000,
            currentValue: 5000,
            totalReturn: 1000,
            totalReturnPercent: 25,
          },
        ],
      };

      mockPortfolioService.getPortfolio!.mockResolvedValue(singlePortfolio);
      mockPortfolioService.getAnalysis!.mockResolvedValue({
        totalInvestment: 4000,
        currentValue: 5000,
        totalProfit: 1000,
        totalProfitPercent: 25,
        diversificationScore: 35,
        sectorAllocation: [{ sector: 'IT', value: 5000, percentage: 100 }],
        holdingsCount: 1,
      });

      const result = await engine.analyze('user-single');

      expect(result.correlationMatrix.status).toBe('SINGLE_HOLDING');
      expect(result.correlationMatrix.pairs.length).toBe(0);
    });

    it('should handle empty portfolio gracefully by returning EMPTY_PORTFOLIO', async () => {
      mockPortfolioService.getPortfolio!.mockResolvedValue({
        id: 'port-empty',
        userId: 'user-empty',
        name: 'Empty',
        totalValue: 0,
        dayChange: 0,
        dayChangePercent: 0,
        holdings: [],
      });
      mockPortfolioService.getAnalysis!.mockResolvedValue({
        totalInvestment: 0,
        currentValue: 0,
        totalProfit: 0,
        totalProfitPercent: 0,
        diversificationScore: 0,
        sectorAllocation: [],
        holdingsCount: 0,
      });

      const result = await engine.analyze('user-empty');

      expect(result.correlationMatrix.status).toBe('EMPTY_PORTFOLIO');
      expect(result.holdingsCount).toBe(0);
      expect(result.topContributors.length).toBe(0);
    });
  });

  describe('STRICT Multi-Tenant Isolation', () => {
    it('should strictly scope all data and intelligence metrics to the authenticated user and prevent cross-tenant access', async () => {
      const userAData: Portfolio = {
        id: 'port-A',
        userId: 'user-alice-123',
        name: 'Alice Portfolio',
        totalValue: 50000,
        dayChange: 100,
        dayChangePercent: 0.2,
        holdings: [
          {
            id: 'h-alice-1',
            portfolioId: 'port-A',
            stock: makeStock('TCS.NS', 'TCS', 'IT', 4000),
            quantity: 10,
            avgBuyPrice: 3500,
            currentValue: 40000,
            totalReturn: 5000,
            totalReturnPercent: 14.28,
          },
        ],
      };

      const userBData: Portfolio = {
        id: 'port-B',
        userId: 'user-bob-456',
        name: 'Bob Portfolio',
        totalValue: 80000,
        dayChange: 300,
        dayChangePercent: 0.38,
        holdings: [
          {
            id: 'h-bob-1',
            portfolioId: 'port-B',
            stock: makeStock('TATAMOTORS.NS', 'Tata Motors', 'Automobile', 800),
            quantity: 100,
            avgBuyPrice: 600,
            currentValue: 80000,
            totalReturn: 20000,
            totalReturnPercent: 33.33,
          },
        ],
      };

      mockPortfolioService.getPortfolio!.mockImplementation(async (userId: string) => {
        if (userId === 'user-alice-123') return userAData;
        if (userId === 'user-bob-456') return userBData;
        throw new Error('Tenant not found');
      });

      mockPortfolioService.getAnalysis!.mockImplementation(async (userId: string) => {
        if (userId === 'user-alice-123') {
          return {
            totalInvestment: 35000,
            currentValue: 40000,
            totalProfit: 5000,
            totalProfitPercent: 14.28,
            diversificationScore: 40,
            sectorAllocation: [{ sector: 'IT', value: 40000, percentage: 100 }],
            holdingsCount: 1,
          };
        }
        if (userId === 'user-bob-456') {
          return {
            totalInvestment: 60000,
            currentValue: 80000,
            totalProfit: 20000,
            totalProfitPercent: 33.33,
            diversificationScore: 40,
            sectorAllocation: [{ sector: 'Automobile', value: 80000, percentage: 100 }],
            holdingsCount: 1,
          };
        }
        throw new Error('Tenant not found');
      });

      // 1. Request for Alice
      const resultAlice = await engine.analyze('user-alice-123');
      expect(resultAlice.userId).toBe('user-alice-123');
      expect(resultAlice.portfolioId).toBe('port-A');
      expect(resultAlice.topContributors[0].symbol).toBe('TCS.NS');
      expect(resultAlice.topContributors.some((c) => c.symbol === 'TATAMOTORS.NS')).toBe(false);

      // 2. Request for Bob
      const resultBob = await engine.analyze('user-bob-456');
      expect(resultBob.userId).toBe('user-bob-456');
      expect(resultBob.portfolioId).toBe('port-B');
      expect(resultBob.topContributors[0].symbol).toBe('TATAMOTORS.NS');
      expect(resultBob.topContributors.some((c) => c.symbol === 'TCS.NS')).toBe(false);

      // Verify portfolioService was called with respective userIds
      expect(mockPortfolioService.getPortfolio).toHaveBeenCalledWith('user-alice-123');
      expect(mockPortfolioService.getPortfolio).toHaveBeenCalledWith('user-bob-456');
    });
  });
});
