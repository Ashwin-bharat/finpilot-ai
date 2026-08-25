import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiPropertyOptional({ example: 'session-uuid', description: 'Existing chat session ID, or omit to start a new session' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({ example: 'Should I buy TCS? Analyze its fundamentals and technicals.', description: 'User message or query' })
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  message!: string;

  @ApiPropertyOptional({ example: 'TCS.NS', description: 'Optional stock context symbol if navigating from a stock detail page' })
  @IsString()
  @IsOptional()
  symbolContext?: string;
}
