import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoMarketService } from '../crypto-market.service';
import { CryptoPortfolioService } from '../crypto-portfolio.service';
import { encryptText, decryptText } from '../../common/crypto.util';
import { TradingMode, TransactionType } from '@prisma/client';
import { PlaceCryptoOrderDto, CryptoBrokerOrderResult } from '@finpilot/shared-types';

export interface ConnectCoinDcxDto {
  apiKey?: string;
  apiSecret?: string;
}

export interface ToggleCryptoTradingModeDto {
  mode: 'PAPER' | 'LIVE';
  confirmLiveTrading?: boolean;
}

@Injectable()
export class CoinDcxBrokerService {
  private readonly logger = new Logger(CoinDcxBrokerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoMarketService: CryptoMarketService,
    private readonly cryptoPortfolioService: CryptoPortfolioService,
  ) {}

  /**
   * Generate HMAC-SHA256 signature for CoinDCX private API authentication
   * signature = HMAC-SHA256(JSON.stringify(payload), apiSecret).hexdigest()
   */
  generateHmacSignature(secret: string, payload: any): string {
    const jsonBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(jsonBody).digest('hex');
  }

  /**
   * Connect or update CoinDCX broker credentials for user.
   * Encrypted at rest via AES-256-GCM. Requires user-submitted credentials (no env fallbacks).
   */
  async connect(userId: string, dto?: ConnectCoinDcxDto) {
    const apiKey = dto?.apiKey?.trim();
    const apiSecret = dto?.apiSecret?.trim();

    if (!apiKey || !apiSecret) {
      throw new BadRequestException(
        'CoinDCX API Key and API Secret are required. Please submit your credentials via Settings.',
      );
    }

    const encryptedApiKey = encryptText(apiKey);
    const encryptedApiSecret = encryptText(apiSecret);
    const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day token reference

    const credential = await this.prisma.cryptoBrokerCredential.upsert({
      where: { userId },
      create: {
        userId,
        brokerName: 'COINDCX',
        encryptedApiKey,
        encryptedApiSecret,
        sessionExpiresAt,
      },
      update: {
        brokerName: 'COINDCX',
        encryptedApiKey,
        encryptedApiSecret,
        sessionExpiresAt,
      },
    });

    this.logger.log(`CoinDCX broker connected successfully for user ${userId}`);

    return {
      connected: true,
      brokerName: credential.brokerName,
      sessionExpiresAt: credential.sessionExpiresAt,
    };
  }

  /**
   * Disconnect CoinDCX broker for user
   */
  async disconnect(userId: string) {
    await this.prisma.cryptoBrokerCredential.deleteMany({
      where: { userId },
    });

    this.logger.log(`CoinDCX broker disconnected for user ${userId}`);

    return {
      success: true,
      brokerName: 'COINDCX',
      message: 'CoinDCX broker account disconnected successfully.',
    };
  }

  /**
   * Get CoinDCX broker status for user
   */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { cryptoBrokerCredential: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      tradingMode: user.cryptoTradingMode || 'PAPER',
      liveTradingEnabled: user.cryptoLiveTradingEnabled || false,
      brokerConnected: !!user.cryptoBrokerCredential,
      brokerName: 'COINDCX',
      sessionExpiresAt: user.cryptoBrokerCredential?.sessionExpiresAt || null,
    };
  }

  /**
   * Toggle crypto trading mode (PAPER vs LIVE)
   * Hard Rule: Switching to LIVE requires explicit confirmLiveTrading: true confirmation
   */
  async toggleTradingMode(userId: string, dto: ToggleCryptoTradingModeDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (dto.mode === 'LIVE') {
      if (!dto.confirmLiveTrading) {
        throw new BadRequestException(
          'Switching to LIVE cryptocurrency trading requires explicit on-screen warning confirmation (confirmLiveTrading: true)',
        );
      }

      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          cryptoTradingMode: TradingMode.LIVE,
          cryptoLiveTradingEnabled: true,
        },
      });

      return {
        tradingMode: updated.cryptoTradingMode,
        liveTradingEnabled: updated.cryptoLiveTradingEnabled,
        message: 'LIVE cryptocurrency trading mode enabled. Real money order placement is now active.',
      };
    } else {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          cryptoTradingMode: TradingMode.PAPER,
        },
      });

      return {
        tradingMode: updated.cryptoTradingMode,
        liveTradingEnabled: updated.cryptoLiveTradingEnabled,
        message: 'Switched to PAPER cryptocurrency trading mode (simulated fills).',
      };
    }
  }

  /**
   * Place Crypto Order (Paper or Live)
   */
  async placeOrder(userId: string, dto: PlaceCryptoOrderDto): Promise<CryptoBrokerOrderResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const cleanSymbol = dto.symbol.toUpperCase().trim();
    const quoteRes = await this.cryptoMarketService.getQuote(cleanSymbol);
    const executionPrice = dto.price || quoteRes.data.currentPrice || 100;
    const totalCost = Number((dto.quantity * executionPrice).toFixed(2));

    const isBuy = dto.type === 'BUY';
    const txType = isBuy ? TransactionType.BUY : TransactionType.SELL;

    // CASE A: PAPER TRADING MODE (DEFAULT)
    if (user.cryptoTradingMode === TradingMode.PAPER) {
      this.logger.log(
        `[CoinDCX PAPER] Executing paper order for user ${userId}: ${dto.type} ${dto.quantity} ${cleanSymbol} @ ₹${executionPrice}`,
      );

      // 1. Record simulated transaction and update paper crypto portfolio holdings
      await this.cryptoPortfolioService.executeTransaction(userId, {
        symbol: cleanSymbol,
        type: dto.type,
        quantity: dto.quantity,
        price: executionPrice,
      });

      // 2. Record CryptoBrokerOrder row
      const brokerOrder = await this.prisma.cryptoBrokerOrder.create({
        data: {
          userId,
          symbol: cleanSymbol,
          transactionType: txType,
          quantity: dto.quantity,
          price: executionPrice,
          orderType: dto.orderType || 'MARKET',
          tradingMode: TradingMode.PAPER,
          status: 'COMPLETE',
          statusMessage: 'Simulated paper fill at current live market price',
        },
      });

      return {
        success: true,
        orderId: brokerOrder.id,
        brokerOrderId: null,
        status: 'COMPLETE',
        tradingMode: 'PAPER',
        symbol: cleanSymbol,
        transactionType: dto.type,
        quantity: dto.quantity,
        executedPrice: executionPrice,
        totalCost,
        message: `Paper order executed successfully for ${dto.quantity} ${cleanSymbol} @ ₹${executionPrice.toLocaleString('en-IN')}`,
      };
    }

    // CASE B: LIVE TRADING MODE (REAL MONEY via CoinDCX)
    if (user.cryptoTradingMode === TradingMode.LIVE) {
      if (!user.cryptoLiveTradingEnabled) {
        throw new ForbiddenException(
          'Live cryptocurrency trading is not enabled for this user account',
        );
      }

      const creds = await this.prisma.cryptoBrokerCredential.findUnique({ where: { userId } });
      if (!creds || !creds.encryptedApiKey || !creds.encryptedApiSecret) {
        throw new BadRequestException(
          'No active CoinDCX API credentials found. Connect your CoinDCX API key and secret first.',
        );
      }

      const apiKey = decryptText(creds.encryptedApiKey);
      const apiSecret = decryptText(creds.encryptedApiSecret);

      const timestamp = Date.now();
      const side = isBuy ? 'buy' : 'sell';
      const orderType =
        dto.orderType && dto.orderType.toLowerCase().includes('limit')
          ? 'limit_order'
          : 'market_order';

      const market = `${cleanSymbol}INR`;
      const payload = {
        side,
        order_type: orderType,
        market,
        price_per_unit: executionPrice,
        total_quantity: dto.quantity,
        timestamp,
      };

      const signature = this.generateHmacSignature(apiSecret, payload);
      const url = 'https://api.coindcx.com/exchange/v1/orders/create';

      this.logger.warn(
        `[CoinDCX LIVE REAL MONEY] Placing real order for user ${userId}: ${side.toUpperCase()} ${dto.quantity} ${market} @ ₹${executionPrice}`,
      );

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AUTH-APIKEY': apiKey,
            'X-AUTH-SIGNATURE': signature,
          },
          body: JSON.stringify(payload),
        });

        const resJson = await response.json();

        const brokerOrder = await this.prisma.cryptoBrokerOrder.create({
          data: {
            userId,
            symbol: cleanSymbol,
            transactionType: txType,
            quantity: dto.quantity,
            price: executionPrice,
            orderType: orderType.toUpperCase(),
            tradingMode: TradingMode.LIVE,
            brokerOrderId: resJson?.id || resJson?.orders?.[0]?.id || null,
            status: response.ok ? 'PENDING' : 'REJECTED',
            statusMessage: resJson?.message || (response.ok ? 'Order placed with CoinDCX' : 'Rejected'),
          },
        });

        return {
          success: response.ok,
          orderId: brokerOrder.id,
          brokerOrderId: brokerOrder.brokerOrderId,
          status: brokerOrder.status,
          tradingMode: 'LIVE',
          symbol: cleanSymbol,
          transactionType: dto.type,
          quantity: dto.quantity,
          executedPrice: executionPrice,
          totalCost,
          message: resJson?.message || 'Live cryptocurrency order submitted to CoinDCX exchange',
        };
      } catch (err: any) {
        this.logger.error(`Live CoinDCX order placement error: ${err.message}`);
        throw new BadRequestException(`Live CoinDCX order failed: ${err.message}`);
      }
    }

    throw new BadRequestException('Invalid crypto trading mode');
  }

  /**
   * Get Order Status by ID
   */
  async getOrderStatus(userId: string, orderId: string) {
    const order = await this.prisma.cryptoBrokerOrder.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new BadRequestException('Crypto broker order not found');
    }

    return {
      id: order.id,
      symbol: order.symbol,
      transactionType: order.transactionType,
      quantity: order.quantity,
      price: order.price,
      orderType: order.orderType,
      tradingMode: order.tradingMode,
      brokerOrderId: order.brokerOrderId,
      status: order.status,
      statusMessage: order.statusMessage,
      executedAt: order.executedAt,
    };
  }

  /**
   * Read-only balances from CoinDCX for reconciliation.
   * Does NOT overwrite internal portfolio database.
   */
  async getHoldings(userId: string) {
    const creds = await this.prisma.cryptoBrokerCredential.findUnique({ where: { userId } });
    if (!creds || !creds.encryptedApiKey || !creds.encryptedApiSecret) {
      return { connected: false, holdings: [] };
    }

    const apiKey = decryptText(creds.encryptedApiKey);
    const apiSecret = decryptText(creds.encryptedApiSecret);

    const timestamp = Date.now();
    const payload = { timestamp };
    const signature = this.generateHmacSignature(apiSecret, payload);

    try {
      const response = await fetch('https://api.coindcx.com/exchange/v1/users/balances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-APIKEY': apiKey,
          'X-AUTH-SIGNATURE': signature,
        },
        body: JSON.stringify(payload),
      });

      const resJson = await response.json();
      const activeBalances = Array.isArray(resJson)
        ? resJson.filter((b: any) => parseFloat(b.balance || '0') > 0 || parseFloat(b.locked_balance || '0') > 0)
        : [];

      return {
        connected: true,
        source: 'CoinDCX Exchange (Read-Only Reconciliation)',
        holdings: activeBalances,
      };
    } catch (err: any) {
      this.logger.error(`Fetch CoinDCX balances error: ${err.message}`);
      return { connected: true, source: 'CoinDCX Exchange', holdings: [], error: err.message };
    }
  }
}
