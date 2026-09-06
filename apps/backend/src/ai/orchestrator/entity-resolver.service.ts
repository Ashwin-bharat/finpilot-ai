import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketService } from '../../market/market.service';
import { EntityResolutionResult, MatchedEntity, AssetType, AssetClass } from '@finpilot/shared-types';

const COMMON_STOPWORDS = new Set([
  'THE', 'IS', 'AND', 'OR', 'FOR', 'TO', 'IN', 'ON', 'AT', 'BY', 'WITH', 'ABOUT', 'ME', 'MY',
  'TELL', 'DID', 'WILL', 'BE', 'WHAT', 'HOW', 'WHY', 'WHEN', 'WHERE', 'SHOULD', 'BUY', 'SELL',
  'STOCK', 'STOCKS', 'SHARE', 'SHARES', 'PRICE', 'PRICES', 'ANALYSIS', 'ANALYZE', 'BULLISH',
  'BEARISH', 'TODAY', 'TARGET', 'OUTLOOK', 'VIEW', 'ANY', 'SOME', 'GOOD', 'BAD', 'NOW', 'PLEASE',
  'CHECK', 'GIVE', 'SHOW', 'LOOK', 'LOOKING', 'RATE', 'RATING', 'LEVEL', 'LEVELS', 'PORTFOLIO',
  'HOLDING', 'HOLDINGS', 'COMPARE', 'VERSUS', 'VS', 'PERFORMANCE', 'UPDATE', 'NEWS', 'COMPANY',
  'RSI', 'PE', 'RATIO', 'EPS', 'ROE', 'ROCE', 'DEBT', 'MACD', 'CHART', 'INVEST', 'INVESTING',
]);

const POPULAR_CRYPTO_ALIASES: Record<string, { symbol: string; name: string }> = {
  'BITCOIN': { symbol: 'BTC', name: 'Bitcoin' },
  'BTC': { symbol: 'BTC', name: 'Bitcoin' },
  'DOGECOIN': { symbol: 'DOGE', name: 'Dogecoin' },
  'DOGE': { symbol: 'DOGE', name: 'Dogecoin' },
  'ETHEREUM': { symbol: 'ETH', name: 'Ethereum' },
  'ETHER': { symbol: 'ETH', name: 'Ethereum' },
  'ETH': { symbol: 'ETH', name: 'Ethereum' },
  'SOLANA': { symbol: 'SOL', name: 'Solana' },
  'SOL': { symbol: 'SOL', name: 'Solana' },
  'RIPPLE': { symbol: 'XRP', name: 'XRP' },
  'XRP': { symbol: 'XRP', name: 'XRP' },
  'CARDANO': { symbol: 'ADA', name: 'Cardano' },
  'ADA': { symbol: 'ADA', name: 'Cardano' },
  'SHIBA': { symbol: 'SHIB', name: 'Shiba Inu' },
  'SHIBA INU': { symbol: 'SHIB', name: 'Shiba Inu' },
  'SHIB': { symbol: 'SHIB', name: 'Shiba Inu' },
  'POLKADOT': { symbol: 'DOT', name: 'Polkadot' },
  'DOT': { symbol: 'DOT', name: 'Polkadot' },
  'AVALANCHE': { symbol: 'AVAX', name: 'Avalanche' },
  'AVAX': { symbol: 'AVAX', name: 'Avalanche' },
  'CHAINLINK': { symbol: 'LINK', name: 'Chainlink' },
  'LINK': { symbol: 'LINK', name: 'Chainlink' },
  'POLYGON': { symbol: 'MATIC', name: 'Polygon' },
  'MATIC': { symbol: 'MATIC', name: 'Polygon' },
  'LITECOIN': { symbol: 'LTC', name: 'Litecoin' },
  'LTC': { symbol: 'LTC', name: 'Litecoin' },
  'UNISWAP': { symbol: 'UNI', name: 'Uniswap' },
  'UNI': { symbol: 'UNI', name: 'Uniswap' },
  'NEAR PROTOCOL': { symbol: 'NEAR', name: 'NEAR Protocol' },
  'NEAR': { symbol: 'NEAR', name: 'NEAR Protocol' },
};

const POPULAR_ALIASES: Record<string, { nse?: string; bse?: string; name: string }> = {
  'MAZDOCK': { nse: 'MAZDOCK.NS', name: 'Mazagon Dock Shipbuilders Ltd' },
  'MAZAGON': { nse: 'MAZDOCK.NS', name: 'Mazagon Dock Shipbuilders Ltd' },
  'BDL': { nse: 'BDL.NS', bse: '541143.BO', name: 'Bharat Dynamics Limited' },
  'BEL': { nse: 'BEL.NS', bse: '500049.BO', name: 'Bharat Electronics Ltd' },
  'HAL': { nse: 'HAL.NS', bse: '541154.BO', name: 'Hindustan Aeronautics Ltd' },
  'TCS': { nse: 'TCS.NS', bse: 'TCS.BO', name: 'Tata Consultancy Services' },
  'INFY': { nse: 'INFY.NS', bse: 'INFY.BO', name: 'Infosys Ltd' },
  'INFOSYS': { nse: 'INFY.NS', bse: 'INFY.BO', name: 'Infosys Ltd' },
  'RELIANCE': { nse: 'RELIANCE.NS', bse: 'RELIANCE.BO', name: 'Reliance Industries Ltd' },
  'RIL': { nse: 'RELIANCE.NS', bse: 'RELIANCE.BO', name: 'Reliance Industries Ltd' },
  'HDFCBANK': { nse: 'HDFCBANK.NS', bse: 'HDFCBANK.BO', name: 'HDFC Bank Ltd' },
  'HDFC BANK': { nse: 'HDFCBANK.NS', bse: 'HDFCBANK.BO', name: 'HDFC Bank Ltd' },
  'TATAMOTORS': { nse: 'TATAMOTORS.NS', bse: 'TATAMOTORS.BO', name: 'Tata Motors Ltd' },
  'TATA MOTORS': { nse: 'TATAMOTORS.NS', bse: 'TATAMOTORS.BO', name: 'Tata Motors Ltd' },
  'SBIN': { nse: 'SBIN.NS', bse: 'SBIN.BO', name: 'State Bank of India' },
  'SBI': { nse: 'SBIN.NS', bse: 'SBIN.BO', name: 'State Bank of India' },
  'ICICIBANK': { nse: 'ICICIBANK.NS', bse: 'ICICIBANK.BO', name: 'ICICI Bank Ltd' },
  'ICICI BANK': { nse: 'ICICIBANK.NS', bse: 'ICICIBANK.BO', name: 'ICICI Bank Ltd' },
  'ITC': { nse: 'ITC.NS', bse: 'ITC.BO', name: 'ITC Ltd' },
  'WIPRO': { nse: 'WIPRO.NS', bse: 'WIPRO.BO', name: 'Wipro Ltd' },
  'BHARTIARTL': { nse: 'BHARTIARTL.NS', bse: 'BHARTIARTL.BO', name: 'Bharti Airtel Ltd' },
  'AIRTEL': { nse: 'BHARTIARTL.NS', bse: 'BHARTIARTL.BO', name: 'Bharti Airtel Ltd' },
  'BLUEJET': { bse: 'BLUEJET.BO', nse: 'BLUEJET.NS', name: 'Blue Jet Healthcare Ltd' },
  'BLUE JET': { bse: 'BLUEJET.BO', nse: 'BLUEJET.NS', name: 'Blue Jet Healthcare Ltd' },
  'BLUE JET HEALTHCARE': { bse: 'BLUEJET.BO', nse: 'BLUEJET.NS', name: 'Blue Jet Healthcare Ltd' },
  'MAZAGON DOCK': { nse: 'MAZDOCK.NS', name: 'Mazagon Dock Shipbuilders Ltd' },
  'BHARAT DYNAMICS': { nse: 'BDL.NS', bse: '541143.BO', name: 'Bharat Dynamics Limited' },
  'DIVSHKT': { bse: 'DIVSHKT.BO', name: 'Divyashakti Ltd' },
};

@Injectable()
export class EntityResolverService {
  private readonly logger = new Logger(EntityResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketService: MarketService,
  ) {}

  /**
   * Resolve entities referenced in the user's message against the security master
   */
  async resolveEntities(message: string, symbolContext?: string): Promise<EntityResolutionResult> {
    const rawText = message.trim();
    if (!rawText) {
      return { status: 'NONE', symbols: [] };
    }

    // 1. Direct Explicit Ticker Extraction (e.g. TCS.NS, BLUEJET.BO)
    const directTickerMatches = rawText.match(/\b([A-Za-z0-9_\-]{2,20})\.(NS|BO)\b/gi);
    if (directTickerMatches && directTickerMatches.length > 0) {
      const cleanSymbols = Array.from(new Set(directTickerMatches.map((s) => s.toUpperCase())));
      
      // Verify in Security Master
      const verifiedStocks = await this.prisma.stock.findMany({
        where: { symbol: { in: cleanSymbols } },
        select: { symbol: true, name: true, exchange: true, sector: true },
      });

      if (verifiedStocks.length > 0) {
        const foundSymbols = verifiedStocks.map((s) => s.symbol);
        const mappedEntities: MatchedEntity[] = verifiedStocks.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          exchange: s.exchange,
          sector: s.sector || undefined,
          assetType: 'EQUITY',
          assetClass: 'stocks',
        }));
        return {
          status: 'RESOLVED',
          primarySymbol: foundSymbols[0],
          primaryAssetType: 'EQUITY',
          assetType: 'EQUITY',
          assetClass: 'stocks',
          symbols: foundSymbols,
          matchedEntities: mappedEntities,
        };
      }

      // If ticker has .NS or .BO suffix but not found in DB, return NOT_FOUND
      return {
        status: 'NOT_FOUND',
        symbols: [],
        disambiguationPrompt: `The specified security "${cleanSymbols[0]}" was not found in the verified NSE/BSE security master.`,
      };
    }

    // 2. Check if user specified exchange alongside ticker/name (e.g. "TCS on BSE" or "Tata Motors NSE")
    const exchangeExplicitMatch = rawText.match(/\b(BSE|NSE)\b/i);
    const preferredExchange = exchangeExplicitMatch ? exchangeExplicitMatch[1].toUpperCase() : undefined;

    // 3. Extract Candidate Tokens
    const candidateTokens = this.extractCandidateTokens(rawText);

    // 4. Multi-token or Company Search via MarketService.searchStocks()
    const allResolvedSymbols: string[] = [];
    const matchedList: MatchedEntity[] = [];

    for (const token of candidateTokens) {
      // Check popular crypto aliases first
      const cryptoAlias = POPULAR_CRYPTO_ALIASES[token];
      if (cryptoAlias) {
        if (!allResolvedSymbols.includes(cryptoAlias.symbol)) {
          allResolvedSymbols.push(cryptoAlias.symbol);
          matchedList.push({
            symbol: cryptoAlias.symbol,
            name: cryptoAlias.name,
            exchange: 'COINDCX',
            sector: 'Cryptocurrency',
            assetType: 'CRYPTO',
            assetClass: 'crypto',
          });
        }
        if (!rawText.toUpperCase().includes(' VS ') && !rawText.toUpperCase().includes('COMPARE')) break;
        continue;
      }

      // Check popular equity aliases
      const aliasMatch = POPULAR_ALIASES[token];
      if (aliasMatch) {
        // If query mentioned BSE explicitly and BSE ticker is available
        if (preferredExchange === 'BSE' && aliasMatch.bse) {
          allResolvedSymbols.push(aliasMatch.bse);
          matchedList.push({
            symbol: aliasMatch.bse,
            name: aliasMatch.name,
            exchange: 'BSE',
            assetType: 'EQUITY',
            assetClass: 'stocks',
          });
          if (!rawText.toUpperCase().includes(' VS ') && !rawText.toUpperCase().includes('COMPARE')) break;
          continue;
        }

        // If query mentioned NSE explicitly
        if (preferredExchange === 'NSE' && aliasMatch.nse) {
          allResolvedSymbols.push(aliasMatch.nse);
          matchedList.push({
            symbol: aliasMatch.nse,
            name: aliasMatch.name,
            exchange: 'NSE',
            assetType: 'EQUITY',
            assetClass: 'stocks',
          });
          if (!rawText.toUpperCase().includes(' VS ') && !rawText.toUpperCase().includes('COMPARE')) break;
          continue;
        }

        // If company is dual-listed and no exchange was specified by the user:
        // Return structured AMBIGUOUS to ask the user to clarify (e.g. Tata Motors, Blue Jet)
        if (aliasMatch.nse && aliasMatch.bse && !preferredExchange) {
          const isFullCompanyNameOrDualQuery = 
            token === 'TATA MOTORS' ||
            token === 'TATAMOTORS' ||
            token === 'BLUE JET' ||
            token === 'BLUE JET HEALTHCARE' ||
            token === 'BLUEJET' ||
            rawText.toUpperCase().includes('WHICH EXCHANGE') ||
            rawText.toUpperCase().includes('NSE OR BSE') ||
            rawText.toUpperCase().includes('DUAL');

          if (isFullCompanyNameOrDualQuery) {
            return {
              status: 'AMBIGUOUS',
              primaryAssetType: 'EQUITY',
              assetType: 'EQUITY',
              assetClass: 'stocks',
              symbols: [aliasMatch.nse, aliasMatch.bse],
              matchedEntities: [
                { symbol: aliasMatch.nse, name: aliasMatch.name, exchange: 'NSE', assetType: 'EQUITY', assetClass: 'stocks' },
                { symbol: aliasMatch.bse, name: aliasMatch.name, exchange: 'BSE', assetType: 'EQUITY', assetClass: 'stocks' },
              ],
              disambiguationPrompt: `I found multiple securities matching this name, did you mean ${aliasMatch.nse} (NSE) or ${aliasMatch.bse} (BSE)?`,
            };
          }
        }

        const chosenSym = aliasMatch.nse || aliasMatch.bse!;
        allResolvedSymbols.push(chosenSym);
        matchedList.push({
          symbol: chosenSym,
          name: aliasMatch.name,
          exchange: chosenSym.endsWith('.BO') ? 'BSE' : 'NSE',
          assetType: 'EQUITY',
          assetClass: 'stocks',
        });
        if (!rawText.toUpperCase().includes(' VS ') && !rawText.toUpperCase().includes('COMPARE')) break;
        continue;
      }

      // Query CryptoAsset table if token matches crypto symbol or name
      const cryptoAsset = await this.prisma.cryptoAsset.findFirst({
        where: {
          OR: [
            { symbol: { equals: token, mode: 'insensitive' } },
            { name: { equals: token, mode: 'insensitive' } },
          ],
        },
      });

      if (cryptoAsset) {
        if (!allResolvedSymbols.includes(cryptoAsset.symbol)) {
          allResolvedSymbols.push(cryptoAsset.symbol);
          matchedList.push({
            symbol: cryptoAsset.symbol,
            name: cryptoAsset.name,
            exchange: 'COINDCX',
            sector: cryptoAsset.category || 'Cryptocurrency',
            assetType: 'CRYPTO',
            assetClass: 'crypto',
          });
        }
        if (!rawText.toUpperCase().includes(' VS ') && !rawText.toUpperCase().includes('COMPARE')) break;
        continue;
      }

      // Query database / searchStocks
      const searchResults = await this.marketService.searchStocks(token);
      if (searchResults && searchResults.length > 0) {
        // Check for ambiguous multi-company match case (e.g. "TATA" matching Tata Motors, Tata Steel, Tata Power)
        const distinctCompanies = searchResults.filter((sr) => {
          const symBase = sr.symbol.replace(/\.(NS|BO)$/i, '');
          return symBase.startsWith(token) || sr.name.toUpperCase().includes(token);
        });

        if (distinctCompanies.length > 1 && !distinctCompanies.every(c => c.name === distinctCompanies[0].name)) {
          // Multiple different companies match this token! Return structured AMBIGUOUS
          const candidates: MatchedEntity[] = distinctCompanies.slice(0, 4).map((c) => ({
            symbol: c.symbol,
            name: c.name,
            exchange: c.exchange,
            sector: c.sector,
            assetType: 'EQUITY',
            assetClass: 'stocks',
          }));

          const promptList = candidates
            .map((c, idx) => `${idx + 1}. **${c.symbol}** — ${c.name} (${c.exchange})`)
            .join('\n');

          return {
            status: 'AMBIGUOUS',
            primaryAssetType: 'EQUITY',
            assetType: 'EQUITY',
            assetClass: 'stocks',
            symbols: candidates.map((c) => c.symbol),
            matchedEntities: candidates,
            disambiguationPrompt: `I found multiple companies matching "${token}":\n${promptList}\n\nPlease specify the exact ticker symbol you want to examine.`,
          };
        }

        // Single company resolved
        const resolved = distinctCompanies[0] || searchResults[0];

        // Check if this resolved company is dual-listed on both NSE and BSE and user didn't specify exchange
        if (
          !preferredExchange &&
          resolved.exchangeSymbols &&
          resolved.exchangeSymbols['NSE'] &&
          resolved.exchangeSymbols['BSE']
        ) {
          const nseSym = resolved.exchangeSymbols['NSE'];
          const bseSym = resolved.exchangeSymbols['BSE'];
          return {
            status: 'AMBIGUOUS',
            primaryAssetType: 'EQUITY',
            assetType: 'EQUITY',
            assetClass: 'stocks',
            symbols: [nseSym, bseSym],
            matchedEntities: [
              { symbol: nseSym, name: resolved.name, exchange: 'NSE', sector: resolved.sector, assetType: 'EQUITY', assetClass: 'stocks' },
              { symbol: bseSym, name: resolved.name, exchange: 'BSE', sector: resolved.sector, assetType: 'EQUITY', assetClass: 'stocks' },
            ],
            disambiguationPrompt: `I found multiple securities matching this name, did you mean ${nseSym} (NSE) or ${bseSym} (BSE)?`,
          };
        }

        let chosenSymbol = resolved.symbol;
        if (preferredExchange === 'BSE' && resolved.exchangeSymbols?.['BSE']) {
          chosenSymbol = resolved.exchangeSymbols['BSE'];
        } else if (preferredExchange === 'NSE' && resolved.exchangeSymbols?.['NSE']) {
          chosenSymbol = resolved.exchangeSymbols['NSE'];
        }

        if (!allResolvedSymbols.includes(chosenSymbol)) {
          allResolvedSymbols.push(chosenSymbol);
          matchedList.push({
            symbol: chosenSymbol,
            name: resolved.name,
            exchange: preferredExchange || (chosenSymbol.endsWith('.BO') ? 'BSE' : 'NSE'),
            sector: resolved.sector,
            assetType: 'EQUITY',
            assetClass: 'stocks',
          });
        }
      }
    }

    // 5. Fallback to symbolContext if present
    if (allResolvedSymbols.length === 0 && symbolContext) {
      const cleanCtx = symbolContext.toUpperCase().trim();
      const ctxResult = await this.prisma.stock.findFirst({
        where: {
          OR: [
            { symbol: { equals: cleanCtx, mode: 'insensitive' } },
            { symbol: { equals: `${cleanCtx}.NS`, mode: 'insensitive' } },
            { symbol: { equals: `${cleanCtx}.BO`, mode: 'insensitive' } },
          ],
        },
      });

      if (ctxResult) {
        return {
          status: 'RESOLVED',
          primarySymbol: ctxResult.symbol,
          primaryAssetType: 'EQUITY',
          assetType: 'EQUITY',
          assetClass: 'stocks',
          symbols: [ctxResult.symbol],
          matchedEntities: [
            {
              symbol: ctxResult.symbol,
              name: ctxResult.name,
              exchange: ctxResult.exchange,
              sector: ctxResult.sector,
              assetType: 'EQUITY',
              assetClass: 'stocks',
            },
          ],
        };
      }

      const cryptoCtxResult = await this.prisma.cryptoAsset.findFirst({
        where: {
          OR: [
            { symbol: { equals: cleanCtx, mode: 'insensitive' } },
            { name: { equals: cleanCtx, mode: 'insensitive' } },
          ],
        },
      });

      if (cryptoCtxResult) {
        return {
          status: 'RESOLVED',
          primarySymbol: cryptoCtxResult.symbol,
          primaryAssetType: 'CRYPTO',
          assetType: 'CRYPTO',
          assetClass: 'crypto',
          symbols: [cryptoCtxResult.symbol],
          matchedEntities: [
            {
              symbol: cryptoCtxResult.symbol,
              name: cryptoCtxResult.name,
              exchange: 'COINDCX',
              sector: cryptoCtxResult.category || 'Cryptocurrency',
              assetType: 'CRYPTO',
              assetClass: 'crypto',
            },
          ],
        };
      }
    }

    if (allResolvedSymbols.length > 0) {
      const primaryAssetType: AssetType = matchedList[0]?.assetType || 'EQUITY';
      const primaryAssetClass: AssetClass = matchedList[0]?.assetClass || 'stocks';
      return {
        status: 'RESOLVED',
        primarySymbol: allResolvedSymbols[0],
        primaryAssetType,
        assetType: primaryAssetType,
        assetClass: primaryAssetClass,
        symbols: allResolvedSymbols,
        matchedEntities: matchedList,
      };
    }

    // If query appears to be asking for a stock that wasn't found
    const hasEquityIntents = candidateTokens.length > 0 && candidateTokens.some(t => t.length >= 3);
    if (hasEquityIntents) {
      return {
        status: 'NOT_FOUND',
        symbols: [],
        disambiguationPrompt: `No matching security found in NSE or BSE databases for "${candidateTokens[0]}". Please check the spelling or ticker format (e.g. TCS.NS or 500112.BO).`,
      };
    }

    return {
      status: 'NONE',
      symbols: [],
    };
  }

  /**
   * Extract meaningful candidate keywords/tokens from query
   */
  private extractCandidateTokens(text: string): string[] {
    const cleaned = text.replace(/[^A-Za-z0-9_\-.\s]/g, ' ');
    const words = cleaned.split(/\s+/).filter(Boolean);

    // Filter out common stopwords and exchange mentions
    const filteredWords = words.filter((w) => {
      const u = w.toUpperCase().replace(/\.(NS|BO)$/i, '');
      return u.length >= 2 && !COMMON_STOPWORDS.has(u) && !/^\d+$/.test(u) && u !== 'NSE' && u !== 'BSE';
    });

    const candidates: string[] = [];

    // 1. Multi-word phrases (3-gram, 2-gram)
    for (let len = Math.min(3, filteredWords.length); len >= 2; len--) {
      for (let i = 0; i <= filteredWords.length - len; i++) {
        const phrase = filteredWords.slice(i, i + len).map((w) => w.toUpperCase()).join(' ');
        if (!candidates.includes(phrase)) {
          candidates.push(phrase);
        }
        const concatenated = phrase.replace(/\s+/g, '');
        if (!candidates.includes(concatenated)) {
          candidates.push(concatenated);
        }
      }
    }

    // 2. Individual words
    for (const w of filteredWords) {
      const upper = w.toUpperCase().replace(/\.(NS|BO)$/i, '');
      if (!candidates.includes(upper)) {
        candidates.push(upper);
      }
    }

    return candidates;
  }
}
