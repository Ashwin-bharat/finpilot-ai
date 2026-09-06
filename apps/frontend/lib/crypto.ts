import {
  CryptoAsset,
  CryptoAssetQuote,
  CryptoPricePoint,
  CryptoTopMoversResponse,
  CryptoPortfolio,
  CryptoWatchlist,
  CryptoBrokerStatus,
  PlaceCryptoOrderDto,
  CryptoBrokerOrderResult,
  TechnicalIndicators,
} from '@finpilot/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function getCryptoTopMoversApi(): Promise<CryptoTopMoversResponse> {
  const res = await fetch(`${API_BASE_URL}/crypto/top-movers`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch crypto top movers');
  }

  const json = await res.json();
  return json.data || json;
}

export async function getCryptoQuoteApi(symbol: string): Promise<CryptoAssetQuote> {
  const res = await fetch(`${API_BASE_URL}/crypto/quote/${encodeURIComponent(symbol)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch quote for ${symbol}`);
  }

  const json = await res.json();
  return json.data || json;
}

export async function getCryptoHistoryApi(
  symbol: string,
  range: string = '1M',
): Promise<CryptoPricePoint[]> {
  const res = await fetch(
    `${API_BASE_URL}/crypto/history/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch crypto history for ${symbol}`);
  }

  const json = await res.json();
  return json.data || json;
}

export async function getCryptoIndicatorsApi(symbol: string): Promise<TechnicalIndicators> {
  const res = await fetch(`${API_BASE_URL}/crypto/indicators/${encodeURIComponent(symbol)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to calculate indicators for crypto ${symbol}`);
  }

  const json = await res.json();
  return json.data || json;
}

export async function searchCryptoApi(query?: string): Promise<CryptoAsset[]> {
  const url = query
    ? `${API_BASE_URL}/crypto/search?q=${encodeURIComponent(query)}`
    : `${API_BASE_URL}/crypto/search`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to search crypto assets');
  }

  return res.json();
}

// Portfolio
export async function getCryptoPortfolioApi(token: string): Promise<CryptoPortfolio> {
  const res = await fetch(`${API_BASE_URL}/crypto/portfolio`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch crypto portfolio');
  }

  return res.json();
}

export async function createCryptoTransactionApi(
  dto: { symbol: string; type: 'BUY' | 'SELL'; quantity: number; price?: number },
  token: string,
) {
  const res = await fetch(`${API_BASE_URL}/crypto/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to record crypto transaction');
  }

  return res.json();
}

// Watchlist
export async function getCryptoWatchlistsApi(token: string): Promise<CryptoWatchlist[]> {
  const res = await fetch(`${API_BASE_URL}/crypto/watchlists`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch crypto watchlists');
  }

  return res.json();
}

export async function addCryptoWatchlistItemApi(
  watchlistId: string,
  symbol: string,
  token: string,
) {
  const res = await fetch(`${API_BASE_URL}/crypto/watchlists/${watchlistId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ symbol }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to add crypto asset to watchlist');
  }

  return res.json();
}

export async function removeCryptoWatchlistItemApi(
  watchlistId: string,
  cryptoAssetId: string,
  token: string,
) {
  const res = await fetch(
    `${API_BASE_URL}/crypto/watchlists/${watchlistId}/items/${cryptoAssetId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error('Failed to remove crypto asset from watchlist');
  }

  return res.json();
}

// Broker & Real Money Trading
export async function getCryptoBrokerStatusApi(token: string): Promise<CryptoBrokerStatus> {
  const res = await fetch(`${API_BASE_URL}/crypto/broker/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch crypto broker status');
  }

  return res.json();
}

export async function toggleCryptoTradingModeApi(
  mode: 'PAPER' | 'LIVE',
  confirmLiveTrading: boolean,
  token: string,
) {
  const res = await fetch(`${API_BASE_URL}/crypto/broker/toggle-mode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode, confirmLiveTrading }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to toggle crypto trading mode');
  }

  return res.json();
}

export async function placeCryptoBrokerOrderApi(
  dto: PlaceCryptoOrderDto,
  token: string,
): Promise<CryptoBrokerOrderResult> {
  const res = await fetch(`${API_BASE_URL}/crypto/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to place crypto order');
  }

  return res.json();
}
