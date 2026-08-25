'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';

export function useRequireAuth() {
  const { user, accessToken, loading, refreshSession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  return {
    user,
    accessToken,
    loading,
    refreshSession,
    isReady: !loading && !!user,
  };
}
