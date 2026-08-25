import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatMessageDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiRateLimitGuard } from './guards/ai-rate-limit.guard';

@ApiTags('AI Assistant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({ summary: 'Send message to AI Financial Assistant and receive structured analysis' })
  @ApiResponse({ status: 201, description: 'AI recommendation computed with real tool grounding' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @UseGuards(AiRateLimitGuard)
  @Post('chat')
  async chat(@Req() req: any, @Body() dto: ChatMessageDto) {
    return this.aiService.chat(req.user.id, dto);
  }

  @ApiOperation({ summary: 'List all previous chat sessions for authenticated user' })
  @ApiResponse({ status: 200, description: 'Chat sessions retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('chat/sessions')
  async getSessions(@Req() req: any) {
    return this.aiService.getUserSessions(req.user.id);
  }

  @ApiOperation({ summary: 'Get a specific chat session with full message history and structured analyses' })
  @ApiResponse({ status: 200, description: 'Chat session retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @Get('chat/sessions/:id')
  async getSessionById(@Req() req: any, @Param('id') id: string) {
    return this.aiService.getSessionById(req.user.id, id);
  }
}
