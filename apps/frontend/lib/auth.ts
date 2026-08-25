import { UserProfile, AuthTokens, LoginResponse, SignupInput, LoginInput } from '@finpilot/shared-types';

export { type SignupInput, type LoginInput };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function signupApi(input: SignupInput): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Failed to sign up' }));
    throw new Error(errorData.message || 'Signup failed');
  }

  return res.json();
}

export async function loginApi(input: LoginInput): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Invalid credentials' }));
    throw new Error(errorData.message || 'Login failed');
  }

  return res.json();
}

export async function refreshApi(): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Session expired' }));
    throw new Error(errorData.message || 'Refresh failed');
  }

  return res.json();
}

export async function logoutApi(accessToken?: string): Promise<{ message: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Logout failed' }));
    throw new Error(errorData.message || 'Logout failed');
  }

  return res.json();
}

export async function getMeApi(accessToken: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Unauthorized' }));
    throw new Error(errorData.message || 'Failed to fetch user');
  }

  return res.json();
}
