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
    let message = 'Invalid credentials';
    try {
      const errorData = await res.json();
      message = errorData.message || (res.status === 401 ? 'Invalid credentials' : `Server error (${res.status})`);
    } catch {
      message = `Server error (${res.status}): Failed to reach backend API`;
    }
    throw new Error(message);
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

export async function updateExplanationStyleApi(
  explanationStyle: 'BEGINNER' | 'ADVANCED',
  accessToken: string,
): Promise<{ id: string; email: string; fullName: string; explanationStyle: 'BEGINNER' | 'ADVANCED' }> {
  const res = await fetch(`${API_BASE_URL}/users/explanation-style`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ explanationStyle }),
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Failed to update explanation style' }));
    throw new Error(errorData.message || 'Failed to update explanation style');
  }

  return res.json();
}

export async function forgotPasswordApi(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Failed to request password reset' }));
    throw new Error(errorData.message || 'Failed to request password reset');
  }

  return res.json();
}

export async function resetPasswordApi(token: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: 'Failed to reset password' }));
    throw new Error(errorData.message || 'Failed to reset password');
  }

  return res.json();
}

