import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddWatchlistItemDto {
  @ApiProperty({ example: 'INFY.NS', description: 'Stock ticker symbol to add to watchlist' })
  @IsString()
  @IsNotEmpty({ message: 'Stock symbol is required' })
  symbol!: string;
}
