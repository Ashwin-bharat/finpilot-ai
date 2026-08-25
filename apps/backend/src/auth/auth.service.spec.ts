import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { UsersService } from '../users/users.service';

describe('AuthService - Unit Tests', () => {
  let service: AuthService;
  let mockAuthRepository: any;
  let mockUsersService: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockAuthRepository = {
      storeRefreshToken: jest.fn().mockResolvedValue({ id: 'token-1' }),
      findValidRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue({ id: 'token-1', revoked: true }),
      revokeAllUserRefreshTokens: jest.fn().mockResolvedValue({ count: 1 }),
    };

    mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock_access_token_123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('1. Password Hashing and Verification Round-Trip', () => {
    it('should hash password during signup and verify correctly on login', async () => {
      const rawPassword = 'SecurePassword123!';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockImplementation((data) =>
        Promise.resolve({
          id: 'user-1',
          email: data.email,
          fullName: data.fullName,
          passwordHash: data.passwordHash,
          avatarUrl: null,
          createdAt: new Date(),
        }),
      );

      // 1. Test signup hashes password
      const signupRes = await service.signup({
        email: 'test@example.com',
        fullName: 'Test User',
        password: rawPassword,
      });

      expect(signupRes.result.user.email).toBe('test@example.com');
      const createdHash = mockUsersService.create.mock.calls[0][0].passwordHash;
      expect(await bcrypt.compare(rawPassword, createdHash)).toBe(true);

      // 2. Test login verifies hashed password
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: hashedPassword,
        avatarUrl: null,
        createdAt: new Date(),
      });

      const loginRes = await service.login({
        email: 'test@example.com',
        password: rawPassword,
      });

      expect(loginRes.result.tokens.accessToken).toBe('mock_access_token_123');
      expect(loginRes.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException on login when password does not match', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        fullName: 'Test User',
        createdAt: new Date(),
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ConflictException during signup if email is already registered', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 'existing-id', email: 'duplicate@example.com' });

      await expect(
        service.signup({
          email: 'duplicate@example.com',
          fullName: 'Duplicate User',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. Refresh Token Rotation and Rejection', () => {
    it('should revoke old refresh token and issue a new token pair on refresh (Rotation)', async () => {
      const validRefreshToken = 'valid_refresh_token_abc123';
      mockAuthRepository.findValidRefreshToken.mockResolvedValue({
        id: 'token-rec-1',
        userId: 'user-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      mockUsersService.findById.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        createdAt: new Date(),
      });

      const result = await service.refresh(validRefreshToken);

      // Verify old refresh token was revoked
      expect(mockAuthRepository.revokeRefreshToken).toHaveBeenCalledWith('token-rec-1');

      // Verify new tokens generated
      expect(result.result.tokens.accessToken).toBe('mock_access_token_123');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(validRefreshToken);
    });

    it('should throw UnauthorizedException if refresh token is revoked or expired or invalid', async () => {
      mockAuthRepository.findValidRefreshToken.mockResolvedValue(null);

      await expect(service.refresh('revoked_or_invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if no refresh token string is provided', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(UnauthorizedException);
    });
  });
});
