import { TechnicalIndicators } from '@finpilot/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function getIndicatorsApi(symbol: string): Promise<TechnicalIndicators> {
  const res = await fetch(`${API_BASE_URL}/stocks/${encodeURIComponent(symbol)}/indicators`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to calculate indicators for ${symbol}`);
  }

  return res.json();
}
