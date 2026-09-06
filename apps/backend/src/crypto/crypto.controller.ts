import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CoinDcxBrokerService, ConnectCoinDcxDto, ToggleCryptoTradingModeDto } from './broker/coindcx-broker.service';
import { CryptoMarketService } from './crypto-market.service';
import { CryptoPortfolioService, CreateCryptoTransactionDto } from './crypto-portfolio.service';
import { CryptoWatchlistService } from './crypto-watchlist.service';
import { PlaceCryptoOrderDto } from '@finpilot/shared-types';

// In-memory rate limiting map for crypto operations (max 10 order/connect operations / minute / user)
const userCryptoRequestCounts = new Map<string, { count: number; resetAt: number }>();

function enforceCryptoRateLimit(userId: string, limit = 10, windowMs = 60000) {
  const now = Date.now();
  const userRate = userCryptoRequestCounts.get(userId) || { count: 0, resetAt: now + windowMs };

  if (now > userRate.resetAt) {
    userRate.count = 1;
    userRate.resetAt = now + windowMs;
  } else {
    userRate.count++;
  }

  userCryptoRequestCounts.set(userId, userRate);

  if (userRate.count > limit) {
    throw new HttpException(
      'Rate limit exceeded. Maximum 10 crypto order/connect operations per minute allowed.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Controller('crypto')
export class CryptoController {
  constructor(
    private readonly brokerService: CoinDcxBrokerService,
    private readonly marketService: CryptoMarketService,
    private readonly portfolioService: CryptoPortfolioService,
    private readonly watchlistService: CryptoWatchlistService,
  ) {}

  // ==========================================
  // Public Market Data Endpoints
  // ==========================================

  @Get('top-movers')
  async getTopMovers() {
    return this.marketService.getTopMovers();
  }

  @Get('quote/:symbol')
  async getQuote(@Param('symbol') symbol: string) {
    return this.marketService.getQuote(symbol);
  }

  @Get('history/:symbol')
  async getHistory(@Param('symbol') symbol: string, @Query('range') range?: string) {
    return this.marketService.getHistory(symbol, range || '1M');
  }

  @Get('indicators/:symbol')
  async getIndicators(@Param('symbol') symbol: string) {
    return this.marketService.getIndicators(symbol);
  }

  @Get('search')
  async searchCrypto(@Query('q') q: string) {
    return this.marketService.searchCrypto(q || '');
  }

  // ==========================================
  // Authenticated Broker & Order Endpoints
  // ==========================================

  @UseGuards(JwtAuthGuard)
  @Post('broker/connect')
  async connectBroker(@Request() req: any, @Body() dto: ConnectCoinDcxDto) {
    enforceCryptoRateLimit(req.user.id);
    return this.brokerService.connect(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('broker/status')
  async getBrokerStatus(@Request() req: any) {
    return this.brokerService.getStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('broker')
  async disconnectBroker(@Request() req: any) {
    return this.brokerService.disconnect(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('broker/toggle-mode')
  async toggleMode(@Request() req: any, @Body() dto: ToggleCryptoTradingModeDto) {
    return this.brokerService.toggleTradingMode(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('orders')
  async placeOrder(@Request() req: any, @Body() dto: PlaceCryptoOrderDto) {
    enforceCryptoRateLimit(req.user.id);
    return this.brokerService.placeOrder(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id')
  async getOrderStatus(@Request() req: any, @Param('id') id: string) {
    return this.brokerService.getOrderStatus(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('holdings')
  async getHoldings(@Request() req: any) {
    return this.brokerService.getHoldings(req.user.id);
  }

  // ==========================================
  // Authenticated Crypto Portfolio Endpoints
  // ==========================================

  @UseGuards(JwtAuthGuard)
  @Get('portfolio')
  async getPortfolio(@Request() req: any) {
    return this.portfolioService.getPortfolio(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('transactions')
  async getTransactions(@Request() req: any) {
    return this.portfolioService.getTransactions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('transactions')
  async createTransaction(@Request() req: any, @Body() dto: CreateCryptoTransactionDto) {
    return this.portfolioService.executeTransaction(req.user.id, dto);
  }

  // ==========================================
  // Authenticated Crypto Watchlist Endpoints
  // ==========================================

  @UseGuards(JwtAuthGuard)
  @Get('watchlists')
  async getWatchlists(@Request() req: any) {
    return this.watchlistService.getWatchlists(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('watchlists/:id/items')
  async addWatchlistItem(
    @Request() req: any,
    @Param('id') watchlistId: string,
    @Body('symbol') symbol: string,
  ) {
    return this.watchlistService.addItem(req.user.id, watchlistId, symbol);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('watchlists/:id/items/:cryptoAssetId')
  async removeWatchlistItem(
    @Request() req: any,
    @Param('id') watchlistId: string,
    @Param('cryptoAssetId') cryptoAssetId: string,
  ) {
    return this.watchlistService.removeItem(req.user.id, watchlistId, cryptoAssetId);
  }
}
