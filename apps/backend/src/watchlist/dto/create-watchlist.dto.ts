import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WatchlistType } from '@prisma/client';

export class CreateWatchlistDto {
  @ApiProperty({ example: 'Tech Growth', description: 'Name of the watchlist' })
  @IsString()
  @IsNotEmpty({ message: 'Watchlist name is required' })
  name!: string;

  @ApiPropertyOptional({ enum: WatchlistType, example: 'CUSTOM', description: 'Type of watchlist' })
  @IsEnum(WatchlistType)
  @IsOptional()
  type?: WatchlistType;
}
