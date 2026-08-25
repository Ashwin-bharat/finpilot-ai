import { Portfolio, PortfolioAnalysis, Transaction, CreateTransactionInput } from '@finpilot/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function getPortfolioApi(accessToken: string): Promise<Portfolio> {
  const res = await fetch(`${API_BASE_URL}/portfolio`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch portfolio' }));
    throw new Error(err.message || 'Failed to fetch portfolio');
  }

  return res.json();
}

export async function getPortfolioAnalysisApi(accessToken: string): Promise<PortfolioAnalysis> {
  const res = await fetch(`${API_BASE_URL}/portfolio/analysis`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch portfolio analysis' }));
    throw new Error(err.message || 'Failed to fetch portfolio analysis');
  }

  return res.json();
}

export async function createTransactionApi(
  input: CreateTransactionInput,
  accessToken: string,
): Promise<{ message: string; transaction: any }> {
  const res = await fetch(`${API_BASE_URL}/portfolio/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to execute transaction' }));
    throw new Error(err.message || 'Failed to execute transaction');
  }

  return res.json();
}

export async function getTransactionsApi(accessToken: string): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE_URL}/portfolio/transactions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch transactions' }));
    throw new Error(err.message || 'Failed to fetch transactions');
  }

  return res.json();
}
