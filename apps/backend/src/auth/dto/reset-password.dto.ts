import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a9f1b2c3d4e5f60718293a4b5c6d7e8f...', description: 'Password reset token received via email' })
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  token!: string;

  @ApiProperty({ example: 'NewSecureP@ss123', description: 'New password (min 8 chars)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}
