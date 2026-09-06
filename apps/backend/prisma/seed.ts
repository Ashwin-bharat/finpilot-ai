/**
 * FinPilot Database Seed Script
 * 
 * NOTE: This is manually-sourced seed data for top Indian equities (NSE tickers)
 * to provide authentic fundamental financial metrics (P/E, P/B, ROE, ROCE, EPS,
 * Debt-to-Equity, Market Cap) for development and demonstration.
 * Sources: Publicly reported NSE/BSE filings and audited FY2024-25 Q3 corporate reports.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface StockSeedData {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  currency: string;
  fundamentals: {
    peRatio: number;
    pbRatio: number;
    roe: number;
    roce: number;
    eps: number;
    debtToEquity: number;
    marketCap: number; // in INR
    fiscalPeriod: string;
  };
}

const SEED_STOCKS: StockSeedData[] = [
  {
    symbol: 'TCS.NS',
    name: 'Tata Consultancy Services Ltd.',
    sector: 'Information Technology',
    industry: 'IT Services',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 30.2,
      pbRatio: 12.8,
      roe: 49.5,
      roce: 61.2,
      eps: 128.4,
      debtToEquity: 0.04,
      marketCap: 14120000000000, // ₹14.12 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'INFY.NS',
    name: 'Infosys Limited',
    sector: 'Information Technology',
    industry: 'IT Services',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 24.8,
      pbRatio: 7.2,
      roe: 31.8,
      roce: 40.5,
      eps: 62.1,
      debtToEquity: 0.09,
      marketCap: 6420000000000, // ₹6.42 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'RELIANCE.NS',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy',
    industry: 'Oil & Gas / Retail / Telecom',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 27.4,
      pbRatio: 2.1,
      roe: 9.8,
      roce: 10.4,
      eps: 108.7,
      debtToEquity: 0.44,
      marketCap: 20180000000000, // ₹20.18 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'HDFCBANK.NS',
    name: 'HDFC Bank Ltd.',
    sector: 'Financial Services',
    industry: 'Private Bank',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 18.6,
      pbRatio: 2.7,
      roe: 16.4,
      roce: 17.2,
      eps: 88.5,
      debtToEquity: 1.15,
      marketCap: 12850000000000, // ₹12.85 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'TATAMOTORS.NS',
    name: 'Tata Motors Ltd.',
    sector: 'Automobile',
    industry: 'Automobiles & EV',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 10.5,
      pbRatio: 3.9,
      roe: 48.2,
      roce: 24.6,
      eps: 94.2,
      debtToEquity: 0.62,
      marketCap: 3670000000000, // ₹3.67 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'SBIN.NS',
    name: 'State Bank of India',
    sector: 'Financial Services',
    industry: 'Public Bank',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 11.2,
      pbRatio: 1.45,
      roe: 16.8,
      roce: 14.1,
      eps: 74.8,
      debtToEquity: 1.35,
      marketCap: 7650000000000, // ₹7.65 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'MRF.NS',
    name: 'MRF Limited',
    sector: 'Automobile',
    industry: 'Tyres & Rubber Products',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 26.4,
      pbRatio: 3.2,
      roe: 14.9,
      roce: 17.5,
      eps: 4920.0,
      debtToEquity: 0.18,
      marketCap: 552000000000, // ₹55,200 Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'ICICIBANK.NS',
    name: 'ICICI Bank Ltd.',
    sector: 'Financial Services',
    industry: 'Private Bank',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 18.2,
      pbRatio: 3.1,
      roe: 18.5,
      roce: 16.9,
      eps: 69.4,
      debtToEquity: 1.05,
      marketCap: 8950000000000, // ₹8.95 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'BHARTIARTL.NS',
    name: 'Bharti Airtel Ltd.',
    sector: 'Telecommunication',
    industry: 'Telecom Services',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 52.8,
      pbRatio: 7.9,
      roe: 16.2,
      roce: 14.8,
      eps: 31.4,
      debtToEquity: 1.62,
      marketCap: 9480000000000, // ₹9.48 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'ITC.NS',
    name: 'ITC Limited',
    sector: 'Consumer Goods',
    industry: 'FMCG / Diversified',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 27.8,
      pbRatio: 7.4,
      roe: 28.6,
      roce: 37.1,
      eps: 16.5,
      debtToEquity: 0.01,
      marketCap: 5850000000000, // ₹5.85 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
  {
    symbol: 'LT.NS',
    name: 'Larsen & Toubro Ltd.',
    sector: 'Construction',
    industry: 'Engineering & Construction',
    exchange: 'NSE',
    currency: 'INR',
    fundamentals: {
      peRatio: 34.6,
      pbRatio: 4.8,
      roe: 15.4,
      roce: 17.8,
      eps: 104.2,
      debtToEquity: 0.98,
      marketCap: 5020000000000, // ₹5.02 Lakh Crore
      fiscalPeriod: 'FY2024-25 Q3',
    },
  },
];

export async function seedFundamentals() {
  console.log('Seeding stock fundamentals database...');

  for (const s of SEED_STOCKS) {
    const stock = await prisma.stock.upsert({
      where: { symbol: s.symbol },
      update: {
        name: s.name,
        sector: s.sector,
        industry: s.industry,
        exchange: s.exchange,
        currency: s.currency,
      },
      create: {
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        industry: s.industry,
        exchange: s.exchange,
        currency: s.currency,
      },
    });

    const existingFund = await prisma.stockFundamental.findFirst({
      where: { stockId: stock.id },
    });

    if (existingFund) {
      await prisma.stockFundamental.update({
        where: { id: existingFund.id },
        data: {
          ...s.fundamentals,
        },
      });
    } else {
      await prisma.stockFundamental.create({
        data: {
          stockId: stock.id,
          ...s.fundamentals,
        },
      });
    }

    console.log(`Seeded fundamentals for ${s.symbol}`);
  }

  // Seed default test user
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {
      fullName: 'Test Investor',
      passwordHash,
    },
    create: {
      email: 'test@example.com',
      fullName: 'Test Investor',
      passwordHash,
    },
  });

  // Seed default watchlist
  const existingWatchlist = await prisma.watchlist.findFirst({
    where: { userId: testUser.id },
  });
  if (!existingWatchlist) {
    const tcs = await prisma.stock.findUnique({ where: { symbol: 'TCS.NS' } });
    const infy = await prisma.stock.findUnique({ where: { symbol: 'INFY.NS' } });
    const rel = await prisma.stock.findUnique({ where: { symbol: 'RELIANCE.NS' } });

    await prisma.watchlist.create({
      data: {
        userId: testUser.id,
        name: 'My Watchlist',
        items: {
          create: [
            ...(tcs ? [{ stockId: tcs.id }] : []),
            ...(infy ? [{ stockId: infy.id }] : []),
            ...(rel ? [{ stockId: rel.id }] : []),
          ],
        },
      },
    });
  }

  console.log(`Seeded test user test@example.com (Password: Password123!)`);
  console.log('Stock fundamentals seeding completed successfully.');
}

if (require.main === module) {
  seedFundamentals()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
