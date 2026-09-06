import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MARKET_DATA_PROVIDER, MarketDataProvider } from './providers/market-data-provider.interface';
import { IndicatorsService } from './indicators.service';
import { StockFundamentals, StockDetail, StockSearchResult } from '@finpilot/shared-types';

const STOCK_ALIASES: Record<string, string> = {
  SBI: 'SBIN',
  'SBI BANK': 'SBIN',
  'STATE BANK': 'SBIN',
  'STATE BANK OF INDIA': 'SBIN',
  MRF: 'MRF',
  'MRF TYRES': 'MRF',
  'MRF TYRE': 'MRF',
  'MRF LIMITED': 'MRF',
  'L&T': 'LT',
  LT: 'LT',
  LARSEN: 'LT',
  'LARSEN & TOUBRO': 'LT',
  'LARSEN AND TOUBRO': 'LT',
  'M&M': 'M&M',
  MM: 'M&M',
  MAHINDRA: 'M&M',
  'MAHINDRA & MAHINDRA': 'M&M',
  TCS: 'TCS',
  'TATA CONSULTANCY': 'TCS',
  HDFC: 'HDFCBANK',
  'HDFC BANK': 'HDFCBANK',
  ICICI: 'ICICIBANK',
  'ICICI BANK': 'ICICIBANK',
  KOTAK: 'KOTAKBANK',
  'KOTAK BANK': 'KOTAKBANK',
  'KOTAK MAHINDRA': 'KOTAKBANK',
  MARUTI: 'MARUTI',
  'MARUTI SUZUKI': 'MARUTI',
  'BAJAJ AUTO': 'BAJAJ-AUTO',
  BAJAJ: 'BAJAJ-AUTO',
  AIRTEL: 'BHARTIARTL',
  BHARTI: 'BHARTIARTL',
  'BHARTI AIRTEL': 'BHARTIARTL',
  RELIANCE: 'RELIANCE',
  RIL: 'RELIANCE',
  INFY: 'INFY',
  INFOSYS: 'INFY',
  WIPRO: 'WIPRO',
  ITC: 'ITC',
  'TATA MOTORS': 'TATAMOTORS',
  TATAMOTORS: 'TATAMOTORS',
  'TATA POWER': 'TATAPOWER',
  TATAPOWER: 'TATAPOWER',
  'TATA STEEL': 'TATASTEEL',
  TATASTEEL: 'TATASTEEL',
  AXIS: 'AXISBANK',
  'AXIS BANK': 'AXISBANK',
  INDUSIND: 'INDUSINDBK',
  'INDUSIND BANK': 'INDUSINDBK',
  HUL: 'HINDUNILVR',
  'HINDUSTAN UNILEVER': 'HINDUNILVR',
  'ASIAN PAINT': 'ASIANPAINT',
  'ASIAN PAINTS': 'ASIANPAINT',
  'SUN PHARMA': 'SUNPHARMA',
  TITAN: 'TITAN',
  'ADANI ENT': 'ADANIENT',
  'ADANI ENTERPRISES': 'ADANIENT',
  'ADANI PORTS': 'ADANIPORTS',
  NTPC: 'NTPC',
  POWERGRID: 'POWERGRID',
  'COAL INDIA': 'COALINDIA',
};

const MARQUEE_SYMBOLS = new Set([
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'LT', 'MRF',
  'KOTAKBANK', 'HINDUNILVR', 'AXISBANK', 'TATAMOTORS', 'BAJAJ-AUTO', 'MARUTI', 'SUNPHARMA',
  'TITAN', 'TATASTEEL', 'WIPRO', 'ADANIENT', 'ADANIPORTS', 'NTPC', 'POWERGRID', 'COALINDIA',
  'ULTRACEMCO', 'NESTLEIND', 'BAJFINANCE', 'BAJAJFINSV', 'ONGC', 'JSWSTEEL',
]);

const EXTENDED_FALLBACK_STOCKS = [
  { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSE', sector: 'Financial Services' },
  { symbol: 'SBIN.BO', name: 'State Bank of India', exchange: 'BSE', sector: 'Financial Services' },
  { symbol: 'MRF.NS', name: 'MRF Limited', exchange: 'NSE', sector: 'Automobile' },
  { symbol: 'MRF.BO', name: 'MRF Limited', exchange: 'BSE', sector: 'Automobile' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services Limited', exchange: 'NSE', sector: 'IT Services' },
  { symbol: 'TCS.BO', name: 'Tata Consultancy Services Limited', exchange: 'BSE', sector: 'IT Services' },
  { symbol: 'INFY.NS', name: 'Infosys Limited', exchange: 'NSE', sector: 'IT Services' },
  { symbol: 'INFY.BO', name: 'Infosys Limited', exchange: 'BSE', sector: 'IT Services' },
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries Limited', exchange: 'NSE', sector: 'Energy' },
  { symbol: 'RELIANCE.BO', name: 'Reliance Industries Limited', exchange: 'BSE', sector: 'Energy' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', exchange: 'NSE', sector: 'Financial Services' },
  { symbol: 'HDFCBANK.BO', name: 'HDFC Bank Limited', exchange: 'BSE', sector: 'Financial Services' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited', exchange: 'NSE', sector: 'Financial Services' },
  { symbol: 'ICICIBANK.BO', name: 'ICICI Bank Limited', exchange: 'BSE', sector: 'Financial Services' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Limited', exchange: 'NSE', sector: 'Automotive' },
  { symbol: 'TATAMOTORS.BO', name: 'Tata Motors Limited', exchange: 'BSE', sector: 'Automotive' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Limited', exchange: 'NSE', sector: 'Telecommunication' },
  { symbol: 'ITC.NS', name: 'ITC Limited', exchange: 'NSE', sector: 'Consumer Goods' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro Limited', exchange: 'NSE', sector: 'Construction' },
  { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank Limited', exchange: 'NSE', sector: 'Financial Services' },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki India Limited', exchange: 'NSE', sector: 'Automotive' },
  { symbol: 'BAJAJ-AUTO.NS', name: 'Bajaj Auto Limited', exchange: 'NSE', sector: 'Automotive' },
  { symbol: 'WIPRO.NS', name: 'Wipro Limited', exchange: 'NSE', sector: 'IT Services' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever Limited', exchange: 'NSE', sector: 'Consumer Goods' },
  { symbol: 'AXISBANK.NS', name: 'Axis Bank Limited', exchange: 'NSE', sector: 'Financial Services' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints Limited', exchange: 'NSE', sector: 'Paints' },
  { symbol: 'TITAN.NS', name: 'Titan Company Limited', exchange: 'NSE', sector: 'Consumer Goods' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical Industries Limited', exchange: 'NSE', sector: 'Healthcare' },
  { symbol: 'TATASTEEL.NS', name: 'Tata Steel Limited', exchange: 'NSE', sector: 'Metals' },
  { symbol: 'TATAPOWER.NS', name: 'Tata Power Company Limited', exchange: 'NSE', sector: 'Energy' },
];

@Injectable()
export class MarketService {
  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly marketDataProvider: MarketDataProvider,
    private readonly prisma: PrismaService,
    private readonly indicatorsService: IndicatorsService,
  ) {}

  async getStocks(query?: string) {
    if (query && query.trim()) {
      const searchResults = await this.searchStocks(query);
      const topSymbols = searchResults.slice(0, 10).map((r) => r.symbol);
      if (topSymbols.length > 0) {
        return Promise.all(topSymbols.map((s) => this.marketDataProvider.getQuote(s)));
      }
      return [];
    }

    const defaultSymbols = [
      'RELIANCE.NS',
      'TCS.NS',
      'HDFCBANK.NS',
      'INFY.NS',
      'ICICIBANK.NS',
      'SBIN.NS',
      'BHARTIARTL.NS',
      'ITC.NS',
      'LT.NS',
      'TATAMOTORS.NS',
    ];
    return Promise.all(defaultSymbols.map((s) => this.marketDataProvider.getQuote(s)));
  }

  async getStockBySymbol(symbol: string): Promise<StockDetail> {
    const cleanSymbol = symbol.toUpperCase();
    const stock = await this.marketDataProvider.getQuote(cleanSymbol);
    const priceHistory = await this.marketDataProvider.getHistory(cleanSymbol, '1m');

    // Query real fundamentals from DB
    let dbStock = null;
    if (this.prisma?.stock) {
      try {
        dbStock = await this.prisma.stock.findUnique({
          where: { symbol: cleanSymbol },
          include: {
            fundamentals: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        });
      } catch {
        dbStock = null;
      }
    }

    let fundamentals: StockFundamentals | null = null;
    if (dbStock && dbStock.fundamentals && dbStock.fundamentals.length > 0) {
      const f = dbStock.fundamentals[0];
      fundamentals = {
        peRatio: f.peRatio,
        pbRatio: f.pbRatio,
        roe: f.roe,
        roce: f.roce,
        eps: f.eps,
        debtToEquity: f.debtToEquity,
        marketCap: f.marketCap,
        fiscalPeriod: f.fiscalPeriod,
      };
    }

    return {
      ...stock,
      priceHistory,
      fundamentals,
    };
  }

  async getHistory(symbol: string, range: string = '1m') {
    return this.marketDataProvider.getHistory(symbol, range);
  }

  async getIndicators(symbol: string) {
    return this.indicatorsService.calculateIndicators(symbol);
  }

  async getTopMovers() {
    return this.marketDataProvider.getTopMovers();
  }

  async getTopGainers() {
    const movers = await this.marketDataProvider.getTopMovers();
    return movers.gainers;
  }

  async getTopLosers() {
    const movers = await this.marketDataProvider.getTopMovers();
    return movers.losers;
  }

  async getTrending() {
    return Promise.all(
      [
        'TCS.NS',
        'RELIANCE.NS',
        'INFY.NS',
        'HDFCBANK.NS',
        'TATAMOTORS.NS',
        'SBIN.NS',
        'MRF.NS',
        'ICICIBANK.NS',
      ].map((s) => this.marketDataProvider.getQuote(s)),
    );
  }

  async searchStocks(query?: string): Promise<StockSearchResult[]> {
    let rawStocks: { symbol: string; name: string; exchange: string; sector: string }[] = [];

    const rawQ = query ? query.trim() : '';
    const normalizedQ = rawQ.toUpperCase().replace(/[^A-Z0-9\s&]/g, '').trim();
    const cleanQ = normalizedQ.replace(/&/g, 'AND');
    const aliasMatch =
      STOCK_ALIASES[normalizedQ] ||
      STOCK_ALIASES[cleanQ] ||
      STOCK_ALIASES[rawQ.toUpperCase()];

    const tokens = rawQ
      .toUpperCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const isUserSearchingInstrument = /\b(ETF|FUND|BOND|DEBENTURE|INDEX|GOLD|BEES)\b/i.test(rawQ);

    try {
      if (!rawQ) {
        rawStocks = await this.prisma.stock.findMany({
          where: {
            symbol: {
              in: [
                'TCS.NS', 'TCS.BO',
                'RELIANCE.NS', 'RELIANCE.BO',
                'INFY.NS', 'INFY.BO',
                'HDFCBANK.NS', 'HDFCBANK.BO',
                'TATAMOTORS.NS', 'TATAMOTORS.BO',
                'ICICIBANK.NS', 'ICICIBANK.BO',
                'SBIN.NS', 'SBIN.BO',
                'BHARTIARTL.NS', 'BHARTIARTL.BO',
                'ITC.NS', 'ITC.BO',
                'LT.NS', 'LT.BO',
                'MRF.NS', 'MRF.BO',
              ],
            },
          },
          select: {
            symbol: true,
            name: true,
            exchange: true,
            sector: true,
          },
          take: 40,
        });
      } else {
        const orConditions: any[] = [
          { symbol: { startsWith: normalizedQ, mode: 'insensitive' } },
          { symbol: { contains: normalizedQ, mode: 'insensitive' } },
          { name: { contains: rawQ, mode: 'insensitive' } },
        ];

        if (aliasMatch) {
          orConditions.push(
            { symbol: { in: [`${aliasMatch}.NS`, `${aliasMatch}.BO`] } },
            { symbol: { startsWith: aliasMatch, mode: 'insensitive' } },
            { symbol: { contains: aliasMatch, mode: 'insensitive' } },
          );
        }

        for (const token of tokens) {
          if (token.length >= 3) {
            orConditions.push(
              { symbol: { startsWith: token, mode: 'insensitive' } },
              { name: { contains: token, mode: 'insensitive' } },
            );
          }
        }

        rawStocks = await this.prisma.stock.findMany({
          where: {
            OR: orConditions,
          },
          select: {
            symbol: true,
            name: true,
            exchange: true,
            sector: true,
          },
          take: 80,
        });
      }
    } catch {
      // Fallback for offline database or testing environments
      const searchTarget = aliasMatch || normalizedQ;
      rawStocks = EXTENDED_FALLBACK_STOCKS.filter(
        (s) =>
          !searchTarget ||
          s.symbol.toUpperCase().includes(searchTarget) ||
          s.name.toUpperCase().includes(rawQ.toUpperCase()) ||
          tokens.some((t) => s.name.toUpperCase().includes(t)),
      );
    }

    // High-Fidelity Relevance Scoring
    const scoredStocks = rawStocks.map((stock) => {
      const cleanSym = stock.symbol.toUpperCase().replace(/\.(NS|BO)$/i, '');
      const stockName = stock.name.toUpperCase();
      let score = 0;

      // 1. Exact symbol or alias match
      if (cleanSym === normalizedQ) {
        score += 1500;
      } else if (aliasMatch && cleanSym === aliasMatch) {
        score += 1300;
      } else if (cleanSym.startsWith(normalizedQ)) {
        score += 700 - Math.min(cleanSym.length - normalizedQ.length, 15) * 10;
      } else if (aliasMatch && cleanSym.startsWith(aliasMatch)) {
        score += 600;
      } else if (cleanSym.includes(normalizedQ)) {
        score += 300;
      }

      // 2. Company Name Match
      if (stockName === rawQ.toUpperCase() || stockName === normalizedQ) {
        score += 1000;
      } else if (stockName.startsWith(rawQ.toUpperCase()) || stockName.startsWith(normalizedQ)) {
        score += 450;
      } else if (stockName.includes(rawQ.toUpperCase())) {
        score += 250;
      }

      // 3. Multi-word Token Matching
      if (tokens.length > 1) {
        const matchingTokens = tokens.filter(
          (t) => cleanSym.includes(t) || stockName.includes(t),
        );
        if (matchingTokens.length === tokens.length) {
          score += 400; // All tokens matched
        } else {
          score += matchingTokens.length * 100;
        }
      }

      // 4. Marquee Stock Boost
      if (MARQUEE_SYMBOLS.has(cleanSym)) {
        score += 400;
      }

      // 5. Listing Preference: NSE primary listings are preferred for equity
      if (stock.exchange === 'NSE' || stock.symbol.endsWith('.NS')) {
        score += 150;
      }

      // 6. Noise Instrument Penalty (ETFs, Mutual Funds, Bonds)
      const isNoise =
        /\b(ETF|BEES|MUTUAL FUND|BOND|DEBENTURE|INDEX FUND|NIFTY 50 ETF|SENSEX ETF|SERIES)\b/i.test(
          stock.name,
        ) ||
        cleanSym.includes('-') ||
        cleanSym.length > 12;

      if (isNoise && !isUserSearchingInstrument) {
        score -= 600;
      }

      return { stock, score, cleanSym };
    });

    // Group dual-listed stocks (NSE + BSE) by base identifier / company name
    const groupedMap = new Map<
      string,
      {
        baseKey: string;
        primarySymbol: string;
        name: string;
        sector: string;
        exchanges: string[];
        exchangeSymbols: Record<string, string>;
        score: number;
      }
    >();

    for (const item of scoredStocks) {
      const { stock, score, cleanSym } = item;
      const baseSymbol = cleanSym;

      // Normalized company name key for grouping
      const normalizedName = stock.name
        .toUpperCase()
        .replace(/\b(LTD|LIMITED|PVT|PRIVATE|CORP|CORPORATION|INDIA)\b/g, '')
        .replace(/[^A-Z0-9]/g, '')
        .trim();

      const groupKey = baseSymbol.length >= 2 ? baseSymbol : normalizedName || cleanSym;
      const exchange = stock.exchange || (stock.symbol.endsWith('.BO') ? 'BSE' : 'NSE');

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          baseKey: groupKey,
          primarySymbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          exchanges: [exchange],
          exchangeSymbols: { [exchange]: stock.symbol },
          score,
        });
      } else {
        const existing = groupedMap.get(groupKey)!;
        if (!existing.exchanges.includes(exchange)) {
          existing.exchanges.push(exchange);
          // Dual listing bonus!
          existing.score += 200;
        }
        existing.exchangeSymbols[exchange] = stock.symbol;
        existing.score = Math.max(existing.score, score);

        // Prioritize NSE as the primary default symbol
        if (exchange === 'NSE') {
          existing.primarySymbol = stock.symbol;
          existing.name = stock.name;
        }
      }
    }

    return Array.from(groupedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map((g) => ({
        symbol: g.primarySymbol,
        name: g.name,
        exchange: g.exchanges.join(', '),
        sector: g.sector,
        exchanges: g.exchanges,
        exchangeSymbols: g.exchangeSymbols,
      }));
  }
}
