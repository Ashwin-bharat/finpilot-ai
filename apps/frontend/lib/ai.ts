import { AiChatSession, StructuredAiRecommendation, SendChatMessageInput } from '@finpilot/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function sendChatMessageApi(
  input: SendChatMessageInput,
  accessToken: string,
): Promise<{ sessionId: string; message: string; structuredAnalysis: StructuredAiRecommendation }> {
  const res = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to communicate with AI Assistant' }));
    throw new Error(err.message || 'Failed to communicate with AI Assistant');
  }

  return res.json();
}

export async function getChatSessionsApi(accessToken: string): Promise<AiChatSession[]> {
  const res = await fetch(`${API_BASE_URL}/ai/chat/sessions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch chat sessions');
  }

  return res.json();
}

export async function getChatSessionByIdApi(sessionId: string, accessToken: string): Promise<AiChatSession> {
  const res = await fetch(`${API_BASE_URL}/ai/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch chat session details');
  }

  return res.json();
}
