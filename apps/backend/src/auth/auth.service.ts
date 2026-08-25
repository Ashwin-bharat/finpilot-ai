import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '@prisma/client';
import { Profile } from 'passport-google-oauth20';

@Injectable()
export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
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
}
