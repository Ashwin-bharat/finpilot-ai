import { Watchlist, CreateWatchlistInput, AddWatchlistItemInput } from '@finpilot/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function getWatchlistsApi(accessToken: string): Promise<Watchlist[]> {
  const res = await fetch(`${API_BASE_URL}/watchlists`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch watchlists' }));
    throw new Error(err.message || 'Failed to fetch watchlists');
  }

  return res.json();
}

export async function createWatchlistApi(
  input: CreateWatchlistInput,
  accessToken: string,
): Promise<Watchlist> {
  const res = await fetch(`${API_BASE_URL}/watchlists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create watchlist' }));
    throw new Error(err.message || 'Failed to create watchlist');
  }

  return res.json();
}

export async function addWatchlistItemApi(
  watchlistId: string,
  input: AddWatchlistItemInput,
  accessToken: string,
): Promise<{ message: string; item: any }> {
  const res = await fetch(`${API_BASE_URL}/watchlists/${encodeURIComponent(watchlistId)}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to add stock to watchlist' }));
    throw new Error(err.message || 'Failed to add stock to watchlist');
  }

  return res.json();
}

export async function removeWatchlistItemApi(
  watchlistId: string,
  stockId: string,
  accessToken: string,
): Promise<{ message: string }> {
  const res = await fetch(
    `${API_BASE_URL}/watchlists/${encodeURIComponent(watchlistId)}/items/${encodeURIComponent(stockId)}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to remove stock from watchlist' }));
    throw new Error(err.message || 'Failed to remove stock from watchlist');
  }

  return res.json();
}
