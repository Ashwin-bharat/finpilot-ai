import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateExplanationStyleDto {
  @ApiProperty({
    enum: ['BEGINNER', 'ADVANCED'],
    example: 'BEGINNER',
    description: 'Preferred explanation style for AI assistant responses',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['BEGINNER', 'ADVANCED'], {
    message: 'explanationStyle must be either BEGINNER or ADVANCED',
  })
  explanationStyle!: 'BEGINNER' | 'ADVANCED';
}
