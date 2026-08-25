import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @ApiProperty({ example: 'TCS.NS', description: 'Stock ticker symbol' })
  @IsString()
  @IsNotEmpty({ message: 'Symbol is required' })
  symbol!: string;

  @ApiProperty({ enum: TransactionType, example: 'BUY', description: 'Transaction type (BUY or SELL)' })
  @IsEnum(TransactionType, { message: 'Type must be BUY or SELL' })
  type!: TransactionType;

  @ApiProperty({ example: 10, description: 'Number of shares/units' })
  @IsNumber()
  @IsPositive({ message: 'Quantity must be greater than 0' })
  quantity!: number;

  @ApiProperty({ example: 3892.45, description: 'Execution price per share' })
  @IsNumber()
  @IsPositive({ message: 'Price must be greater than 0' })
  price!: number;

  @ApiPropertyOptional({ description: 'Target portfolio ID (optional, defaults to primary)' })
  @IsString()
  @IsOptional()
  portfolioId?: string;
}
