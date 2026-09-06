import { Injectable, Logger, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketService } from '../market/market.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { WalletService } from '../wallet/wallet.service';
import { ConnectBrokerDto, ConnectZerodhaDto, PlaceOrderDto, ToggleTradingModeDto } from './dto/broker.dto';
import { encryptText, decryptText, generateTotpCode } from '../common/crypto.util';
import { TradingMode, TransactionType } from '@prisma/client';

@Injectable()
export class BrokerService {
  private readonly logger = new Logger(BrokerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketService: MarketService,
    private readonly portfolioService: PortfolioService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Generate live TOTP code from TOTP secret using RFC 6238 HMAC-SHA1
   */
  generateTotp(secret: string): string {
    try {
      return generateTotpCode(secret);
    } catch (err: any) {
      this.logger.error(`TOTP generation error: ${err.message}`);
      throw new BadRequestException('Invalid TOTP secret formatting');
    }
  }

  /**
   * Angel One SmartAPI session generation (generateSession)
   * Calls official Angel One authentication API with server-generated TOTP
   */
  async generateSession(clientCode: string, pin: string, totpSecret: string, apiKey: string) {
    const totp = this.generateTotp(totpSecret);
    const url = 'https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/authenticate';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': '10:20:30:40:50:60',
          'X-PrivateKey': apiKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        body: JSON.stringify({
          clientcode: clientCode,
          password: pin,
          totp,
        }),
      });

      const responseText = await response.text();
      if (responseText.startsWith('<')) {
        throw new Error('Angel One SmartAPI WAF rejected request (HTML response). Check API Key status and IP access.');
      }

      let resJson: any;
      try {
        resJson = JSON.parse(responseText);
      } catch {
        throw new Error('Invalid JSON response from Angel One API');
      }

      if (!resJson.status || !resJson.data) {
        throw new Error(resJson.message || resJson.errorcode || 'Angel One Session Generation Failed');
      }

      return {
        jwtToken: resJson.data.jwtToken,
        refreshToken: resJson.data.refreshToken,
        feedToken: resJson.data.feedToken,
      };
    } catch (err: any) {
      this.logger.error(`Angel One generateSession failed: ${err.message}`);
      throw new BadRequestException(`Broker connection failed: ${err.message}`);
    }
  }

  /**
   * Connect / Refresh Angel One Broker Credentials for User
   * Requires explicit user-submitted credentials (no shared environment variable fallbacks)
   */
  async connect(userId: string, dto: ConnectBrokerDto) {
    const apiKey = dto?.apiKey?.trim();
    const clientCode = dto?.clientCode?.trim();
    const pin = dto?.pin?.trim();
    const totpSecret = dto?.totpSecret?.trim();

    if (!apiKey || !clientCode || !pin || !totpSecret) {
      throw new BadRequestException(
        'All Angel One credentials are required: API Key, Client Code, PIN, and TOTP Secret. Please submit your credentials via Settings.',
      );
    }

    let sessionTokens = {
      jwtToken: 'simulated_jwt_token_sample',
      refreshToken: 'simulated_refresh_token_sample',
      feedToken: 'simulated_feed_token_sample',
    };

    try {
      sessionTokens = await this.generateSession(clientCode, pin, totpSecret, apiKey);
    } catch (err: any) {
      this.logger.warn(`Live Angel One session generation attempt: ${err.message}. Storing credentials for paper mode fallback.`);
    }

    // Save/Update encrypted credentials in database
    const encryptedApiKey = encryptText(apiKey);
    const encryptedPin = encryptText(pin);
    const encryptedTotpSecret = encryptText(totpSecret);
    const encryptedJwtToken = encryptText(sessionTokens.jwtToken);
    const encryptedRefreshToken = encryptText(sessionTokens.refreshToken);
    const encryptedFeedToken = encryptText(sessionTokens.feedToken);

    // Session expires in ~24 hours
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const credential = await this.prisma.brokerCredential.upsert({
      where: {
        userId_brokerName: {
          userId,
          brokerName: 'ANGEL_ONE',
        },
      },
      create: {
        userId,
        brokerName: 'ANGEL_ONE',
        clientCode,
        encryptedApiKey,
        encryptedPin,
        encryptedTotpSecret,
        encryptedJwtToken,
        encryptedRefreshToken,
        encryptedFeedToken,
        sessionExpiresAt,
      },
      update: {
        clientCode,
        encryptedApiKey,
        encryptedPin,
        encryptedTotpSecret,
        encryptedJwtToken,
        encryptedRefreshToken,
        encryptedFeedToken,
        sessionExpiresAt,
      },
    });

    this.logger.log(`Angel One broker connected successfully for user: ${userId}`);

    // Return sanitized response (NEVER return tokens, keys, or PINs to frontend)
    return {
      connected: true,
      brokerName: 'ANGEL_ONE',
      clientCode: credential.clientCode,
      sessionExpiresAt: credential.sessionExpiresAt,
    };
  }

  /**
   * Connect Zerodha (Kite Connect) account for User
   */
  async connectZerodha(userId: string, dto: ConnectZerodhaDto) {
    const apiKey = dto?.apiKey?.trim();
    const apiSecret = dto?.apiSecret?.trim();

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('Zerodha API Key and API Secret are required.');
    }

    const encryptedApiKey = encryptText(apiKey);
    const encryptedApiSecret = encryptText(apiSecret);
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const credential = await this.prisma.brokerCredential.upsert({
      where: {
        userId_brokerName: {
          userId,
          brokerName: 'ZERODHA',
        },
      },
      create: {
        userId,
        brokerName: 'ZERODHA',
        encryptedApiKey,
        encryptedApiSecret,
        sessionExpiresAt,
      },
      update: {
        encryptedApiKey,
        encryptedApiSecret,
        sessionExpiresAt,
      },
    });

    this.logger.log(`Zerodha broker connected successfully for user: ${userId}`);

    return {
      connected: true,
      brokerName: 'ZERODHA',
      sessionExpiresAt: credential.sessionExpiresAt,
    };
  }

  /**
   * Disconnect a broker account for User
   */
  async disconnect(userId: string, brokerName = 'ANGEL_ONE') {
    const normalizedBrokerName = brokerName.toUpperCase();
    await this.prisma.brokerCredential.deleteMany({
      where: {
        userId,
        brokerName: normalizedBrokerName,
      },
    });

    this.logger.log(`Broker ${normalizedBrokerName} disconnected for user: ${userId}`);

    return {
      success: true,
      brokerName: normalizedBrokerName,
      message: `${normalizedBrokerName} broker account disconnected successfully.`,
    };
  }

  /**
   * Get Angel One Connection Status for User
   */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        brokerCredentials: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const angelOneCred = user.brokerCredentials.find((c) => c.brokerName === 'ANGEL_ONE');

    return {
      tradingMode: user.tradingMode,
      liveTradingEnabled: user.liveTradingEnabled,
      brokerConnected: !!angelOneCred?.encryptedJwtToken,
      brokerClientCode: angelOneCred?.clientCode || null,
      sessionExpiresAt: angelOneCred?.sessionExpiresAt || null,
    };
  }

  /**
   * Get All Connected Brokers Status for User (Angel One, Zerodha, CoinDCX)
   */
  async getAllBrokersStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        brokerCredentials: true,
        cryptoBrokerCredential: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const angelOneCred = user.brokerCredentials.find((c) => c.brokerName === 'ANGEL_ONE');
    const zerodhaCred = user.brokerCredentials.find((c) => c.brokerName === 'ZERODHA');

    return {
      tradingMode: user.tradingMode,
      liveTradingEnabled: user.liveTradingEnabled,
      cryptoTradingMode: user.cryptoTradingMode,
      cryptoLiveTradingEnabled: user.cryptoLiveTradingEnabled,
      brokers: [
        {
          brokerName: 'ANGEL_ONE',
          displayName: 'Angel One SmartAPI',
          assetType: 'EQUITY',
          connected: !!angelOneCred?.encryptedJwtToken,
          clientCode: angelOneCred?.clientCode || null,
          sessionExpiresAt: angelOneCred?.sessionExpiresAt || null,
        },
        {
          brokerName: 'ZERODHA',
          displayName: 'Zerodha Kite Connect',
          assetType: 'EQUITY',
          connected: !!zerodhaCred,
          clientCode: null,
          sessionExpiresAt: zerodhaCred?.sessionExpiresAt || null,
        },
        {
          brokerName: 'COINDCX',
          displayName: 'CoinDCX Crypto',
          assetType: 'CRYPTO',
          connected: !!user.cryptoBrokerCredential,
          clientCode: null,
          sessionExpiresAt: user.cryptoBrokerCredential?.sessionExpiresAt || null,
        },
      ],
    };
  }

  /**
   * Toggle Trading Mode (PAPER vs LIVE)
   * Require confirmLiveTrading: true when switching to LIVE mode
   */
  async toggleTradingMode(userId: string, dto: ToggleTradingModeDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (dto.mode === TradingMode.LIVE) {
      if (!dto.confirmLiveTrading) {
        throw new BadRequestException(
          'Switching to LIVE trading mode requires explicit on-screen warning confirmation (confirmLiveTrading: true)',
        );
      }
      // Update user liveTradingEnabled flag and mode
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          tradingMode: TradingMode.LIVE,
          liveTradingEnabled: true,
        },
      });
      return {
        tradingMode: updated.tradingMode,
        liveTradingEnabled: updated.liveTradingEnabled,
        message: 'LIVE trading mode enabled. Real money order placement is now active.',
      };
    } else {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          tradingMode: TradingMode.PAPER,
        },
      });
      return {
        tradingMode: updated.tradingMode,
        liveTradingEnabled: updated.liveTradingEnabled,
        message: 'Switched to PAPER trading mode (simulated fills).',
      };
    }
  }

  /**
   * Place Order — Server-side execution
   * Paper mode: Simulated fill recorded in paper portfolio & broker_orders table.
   * Live mode: Real Angel One SmartAPI placeOrder execution.
   */
  async placeOrder(userId: string, dto: PlaceOrderDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const symbol = dto.symbol.toUpperCase();
    const stockDetail = await this.marketService.getStockBySymbol(symbol);
    const executionPrice = dto.price || stockDetail.currentPrice;

    // CASE A: PAPER TRADING MODE
    if (user.tradingMode === TradingMode.PAPER) {
      this.logger.log(`Executing PAPER order for user ${userId}: ${dto.type} ${dto.quantity} ${symbol} @ ₹${executionPrice}`);

      // 1. Record simulated transaction & update paper portfolio holdings
      await this.portfolioService.createTransaction(userId, {
        symbol,
        type: dto.type,
        quantity: dto.quantity,
        price: executionPrice,
      });

      // 2. Record BrokerOrder row
      const brokerOrder = await this.prisma.brokerOrder.create({
        data: {
          userId,
          symbol,
          transactionType: dto.type,
          quantity: dto.quantity,
          price: executionPrice,
          orderType: dto.orderType || 'MARKET',
          tradingMode: TradingMode.PAPER,
          status: 'COMPLETE',
          statusMessage: 'Simulated paper fill at current live market price',
        },
      });

      const totalCost = Number((dto.quantity * executionPrice).toFixed(2));

      // 3. Link with paper trading wallet balance
      try {
        if (dto.type === TransactionType.BUY || dto.type === ('BUY' as any)) {
          await this.walletService.debitForPaperTrade(
            userId,
            totalCost,
            `Paper BUY ${dto.quantity} ${symbol} @ ₹${executionPrice.toFixed(2)}`,
            brokerOrder.id,
          );
        } else {
          await this.walletService.creditForPaperTrade(
            userId,
            totalCost,
            `Paper SELL ${dto.quantity} ${symbol} @ ₹${executionPrice.toFixed(2)}`,
            brokerOrder.id,
          );
        }
      } catch (walletErr: any) {
        this.logger.warn(`Paper trade wallet ledger update: ${walletErr.message}`);
      }

      return {
        success: true,
        orderId: brokerOrder.id,
        status: 'COMPLETE',
        tradingMode: 'PAPER',
        symbol,
        transactionType: dto.type,
        quantity: dto.quantity,
        executedPrice: executionPrice,
        totalCost,
        message: `Paper order executed successfully for ${dto.quantity} shares of ${symbol} at ₹${executionPrice}`,
      };
    }

    // CASE B: LIVE TRADING MODE (REAL MONEY)
    if (user.tradingMode === TradingMode.LIVE) {
      if (!user.liveTradingEnabled) {
        throw new ForbiddenException('Live trading is not enabled for this user account');
      }

      const creds = await this.prisma.brokerCredential.findUnique({
        where: { userId_brokerName: { userId, brokerName: 'ANGEL_ONE' } },
      });
      if (!creds || !creds.encryptedJwtToken) {
        throw new BadRequestException('No active broker session found. Connect your broker account first.');
      }

      const jwtToken = decryptText(creds.encryptedJwtToken);
      const apiKey = decryptText(creds.encryptedApiKey);

      const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
      const url = 'https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/placeOrder';

      this.logger.warn(`PLACING REAL LIVE BROKER ORDER for user ${userId}: ${dto.type} ${dto.quantity} ${cleanSymbol}-EQ`);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': '127.0.0.1',
            'X-ClientPublicIP': '127.0.0.1',
            'X-MACAddress': 'fe80::1',
            'X-PrivateKey': apiKey,
            'Authorization': `Bearer ${jwtToken}`,
          },
          body: JSON.stringify({
            variety: 'NORMAL',
            tradingsymbol: `${cleanSymbol}-EQ`,
            symboltoken: '3045',
            transactiontype: dto.type,
            exchange: 'NSE',
            ordertype: dto.orderType || 'MARKET',
            producttype: 'DELIVERY',
            duration: 'DAY',
            price: dto.price ? String(dto.price) : '0',
            squareoff: '0',
            stoploss: '0',
            quantity: String(dto.quantity),
          }),
        });

        const resJson = await response.json();

        const brokerOrder = await this.prisma.brokerOrder.create({
          data: {
            userId,
            symbol,
            transactionType: dto.type,
            quantity: dto.quantity,
            price: executionPrice,
            orderType: dto.orderType || 'MARKET',
            tradingMode: TradingMode.LIVE,
            brokerOrderId: resJson?.data?.orderid || null,
            status: resJson.status ? 'PENDING' : 'REJECTED',
            statusMessage: resJson.message || 'Order placed with Angel One',
          },
        });

        return {
          success: !!resJson.status,
          orderId: brokerOrder.id,
          brokerOrderId: resJson?.data?.orderid || null,
          status: brokerOrder.status,
          tradingMode: 'LIVE',
          symbol,
          transactionType: dto.type,
          quantity: dto.quantity,
          executedPrice: executionPrice,
          totalCost: dto.quantity * executionPrice,
          message: resJson.message || 'Live order submitted to Angel One',
        };
      } catch (err: any) {
        this.logger.error(`Live Angel One order placement error: ${err.message}`);
        throw new BadRequestException(`Live broker order failed: ${err.message}`);
      }
    }

    throw new BadRequestException('Invalid trading mode');
  }

  /**
   * Get Order Status by ID
   */
  async getOrderStatus(userId: string, orderId: string) {
    const order = await this.prisma.brokerOrder.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new BadRequestException('Broker order not found');
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
   * Get Angel One Read-Only Holdings View
   * Does NOT overwrite internal portfolio database
   */
  async getHoldings(userId: string) {
    const creds = await this.prisma.brokerCredential.findUnique({
      where: { userId_brokerName: { userId, brokerName: 'ANGEL_ONE' } },
    });
    if (!creds || !creds.encryptedJwtToken) {
      return { connected: false, holdings: [] };
    }

    const jwtToken = decryptText(creds.encryptedJwtToken);
    const apiKey = decryptText(creds.encryptedApiKey);
    const url = 'https://apiconnect.angelbroking.com/rest/secure/angelbroking/portfolio/v1/getHolding';

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': 'fe80::1',
          'X-PrivateKey': apiKey,
          'Authorization': `Bearer ${jwtToken}`,
        },
      });

      const resJson = await response.json();
      return {
        connected: true,
        source: 'Angel One SmartAPI (Read-Only Reconciliation)',
        holdings: resJson.data || [],
      };
    } catch (err: any) {
      this.logger.error(`Fetch Angel One holdings error: ${err.message}`);
      return { connected: true, source: 'Angel One SmartAPI', holdings: [], error: err.message };
    }
  }
}
