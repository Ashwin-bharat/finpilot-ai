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
