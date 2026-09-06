import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { User } from '@prisma/client';
import { Profile } from 'passport-google-oauth20';

@Injectable()
export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      explanationStyle: user.explanationStyle,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.authRepository.storeRefreshToken(userId, tokenHash, expiresAt);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  async signup(dto: SignupDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
    });

    const { accessToken, refreshToken, expiresIn } = await this.generateTokens(user.id, user.email);

    return {
      result: {
        user: this.sanitizeUser(user),
        tokens: {
          accessToken,
          expiresIn,
        },
      },
      refreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { accessToken, refreshToken, expiresIn } = await this.generateTokens(user.id, user.email);

    return {
      result: {
        user: this.sanitizeUser(user),
        tokens: {
          accessToken,
          expiresIn,
        },
      },
      refreshToken,
    };
  }

  async refresh(refreshTokenString?: string) {
    if (!refreshTokenString) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(refreshTokenString);
    const validRecord = await this.authRepository.findValidRefreshToken(tokenHash);

    if (!validRecord) {
      throw new UnauthorizedException('Invalid, revoked, or expired refresh token');
    }

    // Revoke old refresh token (rotation)
    await this.authRepository.revokeRefreshToken(validRecord.id);

    const user = await this.usersService.findById(validRecord.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { accessToken, refreshToken, expiresIn } = await this.generateTokens(user.id, user.email);

    return {
      result: {
        user: this.sanitizeUser(user),
        tokens: {
          accessToken,
          expiresIn,
        },
      },
      refreshToken,
    };
  }

  async logout(userId: string) {
    await this.authRepository.revokeAllUserRefreshTokens(userId);
    return { message: 'Logged out successfully' };
  }

  async validateGoogleUser(profile: Profile) {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    if (!email) {
      throw new UnauthorizedException('Google account does not contain a verified email');
    }

    const googleId = profile.id;
    const fullName = profile.displayName || email.split('@')[0];
    const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : undefined;

    let user = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      user = await this.usersService.findByEmail(email);
      if (user) {
        user = await this.usersService.updateGoogleId(user.id, googleId, avatarUrl);
      } else {
        user = await this.usersService.create({
          email,
          fullName,
          googleId,
          avatarUrl,
        });
      }
    }

    return user;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);

    // Uniform response prevents email enumeration attacks
    const successMessage = 'If an account with that email exists, a password reset link has been sent.';

    if (!user) {
      return { message: successMessage };
    }

    // Invalidate existing unused tokens for this user
    await this.authRepository.invalidateUserPasswordResetTokens(user.id);

    // Generate cryptographic 32-byte (64 hex characters) token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.authRepository.storePasswordResetToken(user.id, tokenHash, expiresAt);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordResetEmail({
      to: user.email,
      resetLink,
      userName: user.fullName,
    });

    return { message: successMessage };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (!dto.token || !dto.newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    const tokenHash = this.hashToken(dto.token);
    const tokenRecord = await this.authRepository.findValidPasswordResetToken(tokenHash);

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Hash the new password securely
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    // Update password in DB
    await this.usersService.updatePassword(tokenRecord.userId, passwordHash);

    // Invalidate this reset token
    await this.authRepository.markPasswordResetTokenUsed(tokenRecord.id);

    // Revoke all existing refresh tokens for this user (force logout on all devices)
    await this.authRepository.revokeAllUserRefreshTokens(tokenRecord.userId);

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }
}
