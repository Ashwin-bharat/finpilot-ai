import { Controller, Post, Get, Delete, Patch, Body, Param, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrokerService } from './broker.service';
import { ConnectBrokerDto, ConnectZerodhaDto, PlaceOrderDto, ToggleTradingModeDto } from './dto/broker.dto';

// In-memory rate limiting map for order placement and connect (max 10 operations / minute / user)
const userRequestCounts = new Map<string, { count: number; resetAt: number }>();

function enforceRateLimit(userId: string, limit = 10, windowMs = 60000) {
  const now = Date.now();
  const userRate = userRequestCounts.get(userId) || { count: 0, resetAt: now + windowMs };

  if (now > userRate.resetAt) {
    userRate.count = 1;
    userRate.resetAt = now + windowMs;
  } else {
    userRate.count++;
  }

  userRequestCounts.set(userId, userRate);

  if (userRate.count > limit) {
    throw new HttpException('Rate limit exceeded. Maximum 10 order/connect operations per minute allowed.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Controller('broker')
@UseGuards(JwtAuthGuard)
export class BrokerController {
  constructor(private readonly brokerService: BrokerService) {}

  @Post('connect')
  async connect(@Request() req: any, @Body() dto: ConnectBrokerDto) {
    enforceRateLimit(req.user.id);
    return this.brokerService.connect(req.user.id, dto);
  }

  @Post('connect/zerodha')
  async connectZerodha(@Request() req: any, @Body() dto: ConnectZerodhaDto) {
    enforceRateLimit(req.user.id);
    return this.brokerService.connectZerodha(req.user.id, dto);
  }

  @Delete(':brokerName')
  async disconnect(@Request() req: any, @Param('brokerName') brokerName: string) {
    return this.brokerService.disconnect(req.user.id, brokerName);
  }

  @Get('status')
  async getStatus(@Request() req: any) {
    return this.brokerService.getStatus(req.user.id);
  }

  @Get('all-status')
  async getAllBrokersStatus(@Request() req: any) {
    return this.brokerService.getAllBrokersStatus(req.user.id);
  }

  @Post('orders')
  async placeOrder(@Request() req: any, @Body() dto: PlaceOrderDto) {
    enforceRateLimit(req.user.id);
    return this.brokerService.placeOrder(req.user.id, dto);
  }

  @Get('orders/:id')
  async getOrderStatus(@Request() req: any, @Param('id') id: string) {
    return this.brokerService.getOrderStatus(req.user.id, id);
  }

  @Get('holdings')
  async getHoldings(@Request() req: any) {
    return this.brokerService.getHoldings(req.user.id);
  }
}
