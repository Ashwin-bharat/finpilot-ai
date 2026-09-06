import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { ForgotPasswordRateLimitGuard } from './guards/forgot-password-rate-limit.guard';

function extractRefreshToken(req: Request): string | undefined {
  if (req.cookies && req.cookies['refresh_token']) {
    return req.cookies['refresh_token'];
  }
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookieStr) => {
      const [key, val] = cookieStr.trim().split('=');
      if (key && val) acc[key] = decodeURIComponent(val);
      return acc;
    }, {} as Record<string, string>);
    return cookies['refresh_token'];
  }
  return undefined;
}

const COOKIE_NAME = 'refresh_token';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { result, refreshToken } = await this.authService.signup(dto);
    setRefreshCookie(res, refreshToken);
    return result;
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { result, refreshToken } = await this.authService.login(dto);
    setRefreshCookie(res, refreshToken);
    return result;
  }

  @ApiOperation({ summary: 'Refresh access token using httpOnly refresh_token cookie' })
  @ApiResponse({ status: 200, description: 'Tokens successfully refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = extractRefreshToken(req);
    const { result, refreshToken: newRefreshToken } = await this.authService.refresh(token);
    setRefreshCookie(res, newRefreshToken);
    return result;
  }

  @ApiOperation({ summary: 'Log out user and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const response = await this.authService.logout(req.user.id);
    clearRefreshCookie(res);
    return response;
  }

  @ApiOperation({ summary: 'Initiate Google OAuth2 authentication flow' })
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Passport initiates redirect to Google
  }

  @ApiOperation({ summary: 'Google OAuth2 callback handler' })
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.generateTokens(req.user.id, req.user.email);
    setRefreshCookie(res, tokens.refreshToken);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/dashboard?token=${tokens.accessToken}`);
  }

  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    return req.user;
  }

  @ApiOperation({ summary: 'Request password reset link via email' })
  @ApiResponse({ status: 200, description: 'Password reset request acknowledged' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @UseGuards(ForgotPasswordRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Reset password using emailed reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
