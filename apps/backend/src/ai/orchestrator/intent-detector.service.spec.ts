import { Test, TestingModule } from '@nestjs/testing';
import { IntentDetectorService } from './intent-detector.service';

describe('IntentDetectorService', () => {
  let service: IntentDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IntentDetectorService],
    }).compile();

    service = module.get<IntentDetectorService>(IntentDetectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('8 Query Intent Classifications (Spec Examples)', () => {
    it('1. TECHNICAL_ANALYSIS: classifies indicator, chart, momentum, and MA queries', async () => {
      const q1 = await service.detectIntent('What is the RSI of TCS?');
      expect(q1.intent).toBe('TECHNICAL_ANALYSIS');

      const q2 = await service.detectIntent('Is Mazagon Dock above its 50 MA?');
      expect(q2.intent).toBe('TECHNICAL_ANALYSIS');

      const q3 = await service.detectIntent('Show MACD momentum for BDL.NS');
      expect(q3.intent).toBe('TECHNICAL_ANALYSIS');
    });

    it('2. FUNDAMENTAL_ANALYSIS: classifies P/E, P/B, ROE, debt, and valuation queries', async () => {
      const q1 = await service.detectIntent('What is the PE ratio of Reliance?');
      expect(q1.intent).toBe('FUNDAMENTAL_ANALYSIS');

      const q2 = await service.detectIntent('Is HDFC Bank undervalued based on PB ratio and ROE?');
      expect(q2.intent).toBe('FUNDAMENTAL_ANALYSIS');

      const q3 = await service.detectIntent('Tell me about TCS debt to equity');
      expect(q3.intent).toBe('FUNDAMENTAL_ANALYSIS');
    });

    it('3. STOCK_COMPARISON: classifies comparative queries between two equities', async () => {
      const q1 = await service.detectIntent('Compare TCS.NS and INFY.NS');
      expect(q1.intent).toBe('STOCK_COMPARISON');

      const q2 = await service.detectIntent('Which is better TCS vs Wipro?');
      expect(q2.intent).toBe('STOCK_COMPARISON');

      const q3 = await service.detectIntent('MAZDOCK.NS vs BDL.NS comparison');
      expect(q3.intent).toBe('STOCK_COMPARISON');
    });

    it('4. PORTFOLIO_ANALYSIS: classifies user portfolio, diversification, and holdings queries', async () => {
      const q1 = await service.detectIntent('How is my portfolio doing?');
      expect(q1.intent).toBe('PORTFOLIO_ANALYSIS');

      const q2 = await service.detectIntent('What is my portfolio diversification score?');
      expect(q2.intent).toBe('PORTFOLIO_ANALYSIS');

      const q3 = await service.detectIntent('Review my holdings and asset allocation');
      expect(q3.intent).toBe('PORTFOLIO_ANALYSIS');
    });

    it('5. MARKET_ANALYSIS: classifies Nifty, Sensex, top gainers, and broad market queries', async () => {
      const q1 = await service.detectIntent('How is the market doing today?');
      expect(q1.intent).toBe('MARKET_ANALYSIS');

      const q2 = await service.detectIntent('What are the top gainers on NSE today?');
      expect(q2.intent).toBe('MARKET_ANALYSIS');

      const q3 = await service.detectIntent('Nifty outlook and broad market momentum');
      expect(q3.intent).toBe('MARKET_ANALYSIS');
    });

    it('6. NEWS_ANALYSIS: classifies media, headline, announcement, and news queries', async () => {
      const q1 = await service.detectIntent('Latest news on Tata Motors');
      expect(q1.intent).toBe('NEWS_ANALYSIS');

      const q2 = await service.detectIntent('Any recent news and headlines about Reliance?');
      expect(q2.intent).toBe('NEWS_ANALYSIS');
    });

    it('7. GENERAL_FINANCIAL_QUESTION: classifies educational and conceptual questions', async () => {
      const q1 = await service.detectIntent('What is RSI?');
      expect(q1.intent).toBe('GENERAL_FINANCIAL_QUESTION');

      const q2 = await service.detectIntent('How does PE ratio work?');
      expect(q2.intent).toBe('GENERAL_FINANCIAL_QUESTION');

      const q3 = await service.detectIntent('What is a stop loss?');
      expect(q3.intent).toBe('GENERAL_FINANCIAL_QUESTION');
    });

    it('8. STOCK_ANALYSIS: classifies comprehensive single-stock inquiries', async () => {
      const q1 = await service.detectIntent('Analyze TCS.NS');
      expect(q1.intent).toBe('STOCK_ANALYSIS');

      const q2 = await service.detectIntent('Tell me about Mazagon Dock');
      expect(q2.intent).toBe('STOCK_ANALYSIS');

      const q3 = await service.detectIntent('Should I invest in Infosys?');
      expect(q3.intent).toBe('STOCK_ANALYSIS');
    });
  });
});
