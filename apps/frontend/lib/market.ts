import { Stock, StockDetail, TopMoversResponse, StockSearchResult } from '@finpilot/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function searchStocksApi(query?: string): Promise<StockSearchResult[]> {
  const url = query
    ? `${API_BASE_URL}/stocks/search?q=${encodeURIComponent(query)}`
    : `${API_BASE_URL}/stocks/search`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to search stocks');
  }

  return res.json();
}


export async function getTopMoversApi(): Promise<TopMoversResponse> {
  const res = await fetch(`${API_BASE_URL}/market/top-movers`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch top movers');
  }

  return res.json();
}

export async function getStocksApi(query?: string): Promise<Stock[]> {
  const url = query
    ? `${API_BASE_URL}/stocks?q=${encodeURIComponent(query)}`
    : `${API_BASE_URL}/stocks`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch stocks');
  }

  return res.json();
}

export async function getStockBySymbolApi(symbol: string): Promise<StockDetail> {
  const res = await fetch(`${API_BASE_URL}/stocks/${encodeURIComponent(symbol)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch details for ${symbol}`);
  }

  return res.json();
}

export async function getStockHistoryApi(
  symbol: string,
  range: string = '1m',
): Promise<StockDetail['priceHistory']> {
  const res = await fetch(
    `${API_BASE_URL}/stocks/${encodeURIComponent(symbol)}/history?range=${encodeURIComponent(range)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch price history for ${symbol}`);
  }

  return res.json();
}

