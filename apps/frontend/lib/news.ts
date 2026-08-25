import { NewsResponse } from '@finpilot/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function getNewsApi(symbol?: string, limit: number = 5): Promise<NewsResponse> {
  const url = symbol
    ? `${API_BASE_URL}/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`
    : `${API_BASE_URL}/news?limit=${limit}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch news');
  }

  return res.json();
}
