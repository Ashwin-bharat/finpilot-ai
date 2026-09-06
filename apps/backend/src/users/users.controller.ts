import { Controller, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BrokerService } from '../broker/broker.service';
import { UsersService } from './users.service';
import { ToggleTradingModeDto } from '../broker/dto/broker.dto';
import { UpdateExplanationStyleDto } from './dto/explanation-style.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly brokerService: BrokerService,
    private readonly usersService: UsersService,
  ) {}

  @Patch('trading-mode')
  async toggleTradingMode(@Request() req: any, @Body() dto: ToggleTradingModeDto) {
    return this.brokerService.toggleTradingMode(req.user.id, dto);
  }

  @Patch('explanation-style')
  async updateExplanationStyle(@Request() req: any, @Body() dto: UpdateExplanationStyleDto) {
    const user = await this.usersService.updateExplanationStyle(req.user.id, dto.explanationStyle);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      explanationStyle: user.explanationStyle,
    };
  }
}
