import {
  CryptoAsset,
  CryptoAssetQuote,
  CryptoPricePoint,
  CryptoTopMoversResponse,
} from '@finpilot/shared-types';

export const CRYPTO_DATA_PROVIDER = 'CRYPTO_DATA_PROVIDER';

export interface CryptoDataProvider {
  getQuote(symbol: string): Promise<CryptoAssetQuote>;
  getHistory(symbol: string, range?: string): Promise<CryptoPricePoint[]>;
  getTopMovers(): Promise<CryptoTopMoversResponse>;
  searchCrypto(query: string): Promise<CryptoAsset[]>;
}
