const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface BrokerInfo {
  brokerName: 'ANGEL_ONE' | 'ZERODHA' | 'COINDCX';
  displayName: string;
  assetType: 'EQUITY' | 'CRYPTO';
  connected: boolean;
  clientCode: string | null;
  sessionExpiresAt: string | null;
}

export interface MultiBrokerStatus {
  tradingMode: 'PAPER' | 'LIVE';
  liveTradingEnabled: boolean;
  cryptoTradingMode?: 'PAPER' | 'LIVE';
  cryptoLiveTradingEnabled?: boolean;
  brokers: BrokerInfo[];
}

export interface BrokerStatus {
  tradingMode: 'PAPER' | 'LIVE';
  liveTradingEnabled: boolean;
  brokerConnected: boolean;
  brokerClientCode: string | null;
  sessionExpiresAt: string | null;
}

export interface PlaceOrderParams {
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  orderType?: string;
}

export async function getBrokerStatusApi(token?: string): Promise<BrokerStatus> {
  if (!token) {
    return {
      tradingMode: 'PAPER',
      liveTradingEnabled: false,
      brokerConnected: false,
      brokerClientCode: null,
      sessionExpiresAt: null,
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/broker/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return {
        tradingMode: 'PAPER',
        liveTradingEnabled: false,
        brokerConnected: false,
        brokerClientCode: null,
        sessionExpiresAt: null,
      };
    }

    return await res.json();
  } catch {
    return {
      tradingMode: 'PAPER',
      liveTradingEnabled: false,
      brokerConnected: false,
      brokerClientCode: null,
      sessionExpiresAt: null,
    };
  }
}

export async function getAllBrokersStatusApi(token?: string): Promise<MultiBrokerStatus> {
  const fallback: MultiBrokerStatus = {
    tradingMode: 'PAPER',
    liveTradingEnabled: false,
    cryptoTradingMode: 'PAPER',
    cryptoLiveTradingEnabled: false,
    brokers: [
      {
        brokerName: 'ANGEL_ONE',
        displayName: 'Angel One SmartAPI',
        assetType: 'EQUITY',
        connected: false,
        clientCode: null,
        sessionExpiresAt: null,
      },
      {
        brokerName: 'ZERODHA',
        displayName: 'Zerodha Kite Connect',
        assetType: 'EQUITY',
        connected: false,
        clientCode: null,
        sessionExpiresAt: null,
      },
      {
        brokerName: 'COINDCX',
        displayName: 'CoinDCX Crypto',
        assetType: 'CRYPTO',
        connected: false,
        clientCode: null,
        sessionExpiresAt: null,
      },
    ],
  };

  if (!token) return fallback;

  try {
    const res = await fetch(`${API_BASE_URL}/broker/all-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export async function connectAngelOneApi(
  credentials: { apiKey: string; clientCode: string; pin: string; totpSecret: string },
  token?: string,
) {
  const res = await fetch(`${API_BASE_URL}/broker/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to connect Angel One broker account');
  }

  return await res.json();
}

export async function connectZerodhaApi(
  credentials: { apiKey: string; apiSecret: string },
  token?: string,
) {
  const res = await fetch(`${API_BASE_URL}/broker/connect/zerodha`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to connect Zerodha Kite account');
  }

  return await res.json();
}

export async function connectCoinDcxApi(
  credentials: { apiKey: string; apiSecret: string },
  token?: string,
) {
  const res = await fetch(`${API_BASE_URL}/crypto/broker/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(credentials),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to connect CoinDCX broker account');
  }

  return await res.json();
}

export async function disconnectBrokerApi(brokerName: string, token?: string) {
  const endpoint =
    brokerName.toUpperCase() === 'COINDCX'
      ? `${API_BASE_URL}/crypto/broker`
      : `${API_BASE_URL}/broker/${brokerName.toUpperCase()}`;

  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to disconnect ${brokerName}`);
  }

  return await res.json();
}

export async function connectBrokerApi(credentials?: any, token?: string) {
  return connectAngelOneApi(credentials, token);
}

export async function toggleTradingModeApi(mode: 'PAPER' | 'LIVE', confirmLiveTrading?: boolean, token?: string) {
  const res = await fetch(`${API_BASE_URL}/users/trading-mode`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode, confirmLiveTrading }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to update trading mode');
  }

  return await res.json();
}

export async function placeBrokerOrderApi(params: PlaceOrderParams, token?: string) {
  const res = await fetch(`${API_BASE_URL}/broker/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Order execution failed');
  }

  return await res.json();
}

export async function getBrokerHoldingsApi(token?: string) {
  const res = await fetch(`${API_BASE_URL}/broker/holdings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch broker holdings');
  }

  return await res.json();
}
