import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MarketService } from './market.service';

@ApiTags('Market')
@Controller()
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @ApiOperation({ summary: 'List or search stocks' })
  @Get('stocks')
  async getStocks(@Query('q') q?: string) {
    return this.marketService.getStocks(q);
  }

  @ApiOperation({ summary: 'Get stock historical OHLC price points for range (1D, 1W, 1M, 1Y, 5Y)' })
  @ApiResponse({ status: 200, description: 'Historical prices retrieved successfully' })
  @Get('stocks/:symbol/history')
  async getStockHistory(@Param('symbol') symbol: string, @Query('range') range?: string) {
    return this.marketService.getHistory(symbol, range || '1m');
  }

  @ApiOperation({ summary: 'Get computed technical indicators (RSI, 50/200 MA, MACD) from raw price data' })
  @ApiResponse({ status: 200, description: 'Technical indicators computed successfully' })
  @Get('stocks/:symbol/indicators')
  async getStockIndicators(@Param('symbol') symbol: string) {
    return this.marketService.getIndicators(symbol);
  }

  @ApiOperation({ summary: 'Get full stock details, historical prices, and authentic fundamentals' })
  @ApiResponse({ status: 200, description: 'Stock details and fundamentals retrieved' })
  @Get('stocks/:symbol')
  async getStockBySymbol(@Param('symbol') symbol: string) {
    return this.marketService.getStockBySymbol(symbol);
  }

  @ApiOperation({ summary: 'Get trending stocks' })
  @Get('market/trending')
  async getTrending() {
    return this.marketService.getTrending();
  }

  @ApiOperation({ summary: 'Get top gaining stocks' })
  @Get('market/top-gainers')
  async getTopGainers() {
    return this.marketService.getTopGainers();
  }

  @ApiOperation({ summary: 'Get top losing stocks' })
  @Get('market/top-losers')
  async getTopLosers() {
    return this.marketService.getTopLosers();
  }

  @ApiOperation({ summary: 'Get top movers including indices, gainers and losers' })
  @Get('market/top-movers')
  async getTopMovers() {
    return this.marketService.getTopMovers();
  }
}
