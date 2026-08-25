import { Controller, Get, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Portfolio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @ApiOperation({ summary: 'Get current user portfolio and live holdings' })
  @ApiResponse({ status: 200, description: 'Portfolio retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  async getPortfolio(@Req() req: any) {
    return this.portfolioService.getPortfolio(req.user.id);
  }

  @ApiOperation({ summary: 'Record a new portfolio buy or sell transaction' })
  @ApiResponse({ status: 201, description: 'Transaction executed and holding updated' })
  @ApiResponse({ status: 400, description: 'Invalid transaction or insufficient shares' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('transactions')
  async createTransaction(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.portfolioService.createTransaction(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Get transaction history for user portfolio' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('transactions')
  async getTransactions(@Req() req: any) {
    return this.portfolioService.getTransactions(req.user.id);
  }

  @ApiOperation({ summary: 'Get real-time computed portfolio analytics, diversification score and sector distribution' })
  @ApiResponse({ status: 200, description: 'Portfolio analysis computed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('analysis')
  async getAnalysis(@Req() req: any) {
    return this.portfolioService.getAnalysis(req.user.id);
  }
}
