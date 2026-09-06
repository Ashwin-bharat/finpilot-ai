import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, Min, IsBoolean } from 'class-validator';
import { TransactionType, TradingMode } from '@prisma/client';

export class ConnectBrokerDto {
  @IsString()
  @IsNotEmpty({ message: 'Angel One API Key is required' })
  apiKey: string;

  @IsString()
  @IsNotEmpty({ message: 'Angel One Client Code is required' })
  clientCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Angel One PIN is required' })
  pin: string;

  @IsString()
  @IsNotEmpty({ message: 'Angel One TOTP Secret is required' })
  totpSecret: string;
}

export class ConnectZerodhaDto {
  @IsString()
  @IsNotEmpty({ message: 'Zerodha API Key is required' })
  apiKey: string;

  @IsString()
  @IsNotEmpty({ message: 'Zerodha API Secret is required' })
  apiSecret: string;
}

export class PlaceOrderDto {
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType; // BUY | SELL

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  orderType?: string; // MARKET | LIMIT
}

export class ToggleTradingModeDto {
  @IsEnum(TradingMode)
  @IsNotEmpty()
  mode: TradingMode; // PAPER | LIVE

  @IsBoolean()
  @IsOptional()
  confirmLiveTrading?: boolean;
}
