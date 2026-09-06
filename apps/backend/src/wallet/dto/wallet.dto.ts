import { IsNumber, IsPositive, Min, Max, IsString, IsNotEmpty } from 'class-validator';

export class CreateTopupOrderDto {
  @IsNumber()
  @IsPositive()
  @Min(10, { message: 'Minimum top-up amount is ₹10' })
  @Max(500000, { message: 'Maximum top-up amount is ₹5,00,000' })
  amount: number;
}

export class VerifyTopupDto {
  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @IsString()
  @IsNotEmpty()
  razorpayPaymentId: string;

  @IsString()
  @IsNotEmpty()
  razorpaySignature: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
