import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateTopupOrderDto, VerifyTopupDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Request() req: any) {
    return this.walletService.getOrCreateWallet(req.user.id);
  }

  @Post('topup/create-order')
  @HttpCode(HttpStatus.OK)
  async createTopupOrder(@Request() req: any, @Body() dto: CreateTopupOrderDto) {
    return this.walletService.createTopupOrder(req.user.id, dto);
  }

  @Post('topup/verify')
  @HttpCode(HttpStatus.OK)
  async verifyTopup(@Request() req: any, @Body() dto: VerifyTopupDto) {
    return this.walletService.verifyTopup(req.user.id, dto);
  }

  @Get('transactions')
  async getTransactions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.walletService.getTransactions(req.user.id, pageNum, limitNum);
  }
}
