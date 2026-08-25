import { Injectable } from '@nestjs/common';
import { NewsArticle, NewsResponse } from '@finpilot/shared-types';
import { NewsProvider } from './news-provider.interface';

@Injectable()
export class MockNewsProvider implements NewsProvider {
  private mockArticles: NewsArticle[] = [
    {
      id: 'mock-news-1',
      title: 'TCS Q3 constant currency revenue jumps 4.2%, margin resilient amid European expansion',
      source: 'Economic Times',
      url: 'https://economictimes.indiatimes.com',
      publishedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      sentiment: 'POSITIVE',
      sentimentConfidence: 0.88,
      summary: 'Tata Consultancy Services delivered resilient operating margins driven by strong cloud transformation deals and digital enterprise modernization contracts across North America and the UK.',
      relatedStocks: ['TCS.NS'],
    },
    {
      id: 'mock-news-2',
      title: 'RBI Monetary Policy Committee maintains benchmark repo rate at 6.5%, signals inflation vigilance',
      source: 'LiveMint',
      url: 'https://www.livemint.com',
      publishedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      sentiment: 'NEUTRAL',
      sentimentConfidence: 0.75,
      summary: 'The Reserve Bank of India maintained liquidity stance while projecting economic GDP expansion at 7.0% for the upcoming fiscal cycle, keeping banking credit quality robust.',
      relatedStocks: ['HDFCBANK.NS', 'SBIN.NS', 'ICICIBANK.NS'],
    },
    {
      id: 'mock-news-3',
      title: 'Reliance Retail & Jio platforms accelerate capital investment in domestic AI infrastructure and green energy',
      source: 'Business Standard',
      url: 'https://www.business-standard.com',
      publishedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      sentiment: 'POSITIVE',
      sentimentConfidence: 0.82,
      summary: 'Reliance Industries announced scale investments into hyperscale AI compute clusters in Jamnagar, alongside new solar giga-factory commercial operations.',
      relatedStocks: ['RELIANCE.NS'],
    },
    {
      id: 'mock-news-4',
      title: 'Global tech headwinds trigger selective IT hiring and cautious enterprise discretionary spend',
      source: 'Reuters India',
      url: 'https://www.reuters.com',
      publishedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
      sentiment: 'NEGATIVE',
      sentimentConfidence: 0.72,
      summary: 'Enterprise client procurement cycles lengthened slightly in Q3 as global enterprise CIOs prioritize AI automation projects over legacy maintenance engagements.',
      relatedStocks: ['INFY.NS', 'TCS.NS'],
    },
    {
      id: 'mock-news-5',
      title: 'Tata Motors EV deliveries scale new records, passenger vehicle market share expands in domestic segment',
      source: 'CNBC-TV18',
      url: 'https://www.cnbctv18.com',
      publishedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
      sentiment: 'POSITIVE',
      sentimentConfidence: 0.91,
      summary: 'Tata Motors witnessed solid demand traction in electric mobility and luxury Jaguar Land Rover order books, bolstering quarterly cash flows.',
      relatedStocks: ['TATAMOTORS.NS'],
    },
  ];

  async getNews(symbol?: string, limit: number = 5): Promise<NewsResponse> {
    let list = this.mockArticles;

    if (symbol) {
      const cleanSym = symbol.toUpperCase();
      const filtered = this.mockArticles.filter(
        (a) => a.relatedStocks?.some((s) => s.toUpperCase() === cleanSym) || a.title.toUpperCase().includes(cleanSym.replace('.NS', '')),
      );

      if (filtered.length > 0) {
        list = filtered;
      } else {
        // Generate a contextual mock article for this specific stock
        const dynamicArticle: NewsArticle = {
          id: `mock-dyn-${cleanSym.toLowerCase()}`,
          title: `${cleanSym.replace('.NS', '')} advances strategic operations amid institutional accumulation`,
          source: 'Market Wire Feed',
          url: 'https://www.moneycontrol.com',
          publishedAt: new Date().toISOString(),
          sentiment: 'POSITIVE',
          sentimentConfidence: 0.85,
          summary: `Market intelligence indicates steady operational momentum for ${cleanSym} with robust institutional participation and expanding market share in core business verticals.`,
          relatedStocks: [cleanSym],
        };
        list = [dynamicArticle, ...this.mockArticles.slice(0, limit - 1)];
      }
    }

    return {
      articles: list.slice(0, limit),
      isMock: true,
      source: 'mock',
    };
  }
}
