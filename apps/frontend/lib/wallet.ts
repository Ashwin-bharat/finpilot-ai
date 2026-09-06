import {
  Wallet,
  CreateTopupOrderResponse,
  VerifyTopupRequest,
  VerifyTopupResponse,
  WalletTransactionsResponse,
} from '@finpilot/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Fetch current user's paper trading wallet
 */
export async function getWalletApi(token: string): Promise<Wallet> {
  const res = await fetch(`${API_BASE_URL}/wallet`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch wallet details');
  }

  return res.json();
}

/**
 * Create Razorpay top-up order
 */
export async function createTopupOrderApi(
  amount: number,
  token: string,
): Promise<CreateTopupOrderResponse> {
  const res = await fetch(`${API_BASE_URL}/wallet/topup/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to initialize top-up order');
  }

  return res.json();
}

/**
 * Verify Razorpay payment and credit wallet
 */
export async function verifyTopupApi(
  data: VerifyTopupRequest,
  token: string,
): Promise<VerifyTopupResponse> {
  const res = await fetch(`${API_BASE_URL}/wallet/topup/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Payment verification failed');
  }

  return res.json();
}

/**
 * Fetch paginated transaction history
 */
export async function getWalletTransactionsApi(
  token: string,
  page = 1,
  limit = 20,
): Promise<WalletTransactionsResponse> {
  const res = await fetch(`${API_BASE_URL}/wallet/transactions?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch wallet transactions');
  }

  return res.json();
}
