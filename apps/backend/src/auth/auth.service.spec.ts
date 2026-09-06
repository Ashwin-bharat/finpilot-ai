import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

describe('AuthService - Unit Tests', () => {
  let service: AuthService;
  let mockAuthRepository: any;
  let mockUsersService: any;
  let mockJwtService: any;
  let mockMailService: any;

  beforeEach(async () => {
    mockAuthRepository = {
      storeRefreshToken: jest.fn().mockResolvedValue({ id: 'token-1' }),
      findValidRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue({ id: 'token-1', revoked: true }),
      revokeAllUserRefreshTokens: jest.fn().mockResolvedValue({ count: 1 }),
      storePasswordResetToken: jest.fn().mockResolvedValue({ id: 'reset-1' }),
      findValidPasswordResetToken: jest.fn(),
      markPasswordResetTokenUsed: jest.fn().mockResolvedValue({ id: 'reset-1' }),
      invalidateUserPasswordResetTokens: jest.fn().mockResolvedValue({ count: 1 }),
    };

    mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByGoogleId: jest.fn(),
      updateGoogleId: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock_access_token_123'),
    };

    mockMailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
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

  describe('3. Google OAuth Strategy User Validation', () => {
    it('should find existing user by Google ID and return user profile', async () => {
      const googleProfile: any = {
        id: 'google-uid-12345',
        displayName: 'Google User',
        emails: [{ value: 'googleuser@gmail.com' }],
        photos: [{ value: 'https://avatar.google.com/pic.png' }],
      };

      mockUsersService.findByGoogleId.mockResolvedValue({
        id: 'user-google-1',
        email: 'googleuser@gmail.com',
        fullName: 'Google User',
        googleId: 'google-uid-12345',
      });

      const user = await service.validateGoogleUser(googleProfile);
      expect(user.id).toBe('user-google-1');
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('should link Google ID to existing email account if user previously signed up via password', async () => {
      const googleProfile: any = {
        id: 'google-uid-new',
        displayName: 'Existing User',
        emails: [{ value: 'existing@gmail.com' }],
        photos: [{ value: 'https://avatar.google.com/existing.png' }],
      };

      mockUsersService.findByGoogleId.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-existing-1',
        email: 'existing@gmail.com',
        fullName: 'Existing User',
        googleId: null,
      });
      mockUsersService.updateGoogleId.mockResolvedValue({
        id: 'user-existing-1',
        email: 'existing@gmail.com',
        googleId: 'google-uid-new',
      });

      const user = await service.validateGoogleUser(googleProfile);
      expect(mockUsersService.updateGoogleId).toHaveBeenCalledWith(
        'user-existing-1',
        'google-uid-new',
        'https://avatar.google.com/existing.png',
      );
      expect(user.id).toBe('user-existing-1');
    });

    it('should create a new user when neither Google ID nor email exist', async () => {
      const googleProfile: any = {
        id: 'google-uid-brand-new',
        displayName: 'Brand New User',
        emails: [{ value: 'brandnew@gmail.com' }],
        photos: [],
      };

      mockUsersService.findByGoogleId.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 'user-new-1',
        email: 'brandnew@gmail.com',
        fullName: 'Brand New User',
        googleId: 'google-uid-brand-new',
      });

      const user = await service.validateGoogleUser(googleProfile);
      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'brandnew@gmail.com',
          fullName: 'Brand New User',
          googleId: 'google-uid-brand-new',
        }),
      );
      expect(user.id).toBe('user-new-1');
    });

    it('should throw UnauthorizedException if Google profile provides no email', async () => {
      const googleProfile: any = {
        id: 'google-no-email',
        displayName: 'No Email',
        emails: [],
      };

      await expect(service.validateGoogleUser(googleProfile)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('4. Forgot Password & Reset Password Security Flow', () => {
    it('should generate a time-limited token, store its SHA-256 hash, and send email for valid user', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-pwd-1',
        email: 'trader@example.com',
        fullName: 'Pro Trader',
      });

      const response = await service.forgotPassword({ email: 'trader@example.com' });

      expect(response.message).toContain('If an account with that email exists');
      expect(mockAuthRepository.invalidateUserPasswordResetTokens).toHaveBeenCalledWith('user-pwd-1');
      expect(mockAuthRepository.storePasswordResetToken).toHaveBeenCalledWith(
        'user-pwd-1',
        expect.any(String), // SHA-256 hash
        expect.any(Date),   // Expiration in 15 mins
      );
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'trader@example.com',
          userName: 'Pro Trader',
          resetLink: expect.stringContaining('/reset-password?token='),
        }),
      );
    });

    it('should return identical success message even if email does not exist (Anti-Enumeration)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const response = await service.forgotPassword({ email: 'nonexistent@example.com' });

      expect(response.message).toContain('If an account with that email exists');
      expect(mockAuthRepository.storePasswordResetToken).not.toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should reset password, mark token as used, and revoke ALL active refresh tokens', async () => {
      const rawToken = 'sample_raw_reset_token_64chars_abcdef123456';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      mockAuthRepository.findValidPasswordResetToken.mockResolvedValue({
        id: 'token-rec-99',
        userId: 'user-pwd-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // valid
      });

      const newPassword = 'BrandNewPassword!2026';
      const response = await service.resetPassword({
        token: rawToken,
        newPassword,
      });

      expect(response.message).toContain('Password has been reset successfully');
      // Verify password was updated with a bcrypt hash
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(
        'user-pwd-1',
        expect.any(String),
      );
      const passedHash = mockUsersService.updatePassword.mock.calls[0][1];
      expect(await bcrypt.compare(newPassword, passedHash)).toBe(true);

      // Verify token marked used
      expect(mockAuthRepository.markPasswordResetTokenUsed).toHaveBeenCalledWith('token-rec-99');

      // CRITICAL: Verify all existing user refresh tokens were revoked to force re-login everywhere
      expect(mockAuthRepository.revokeAllUserRefreshTokens).toHaveBeenCalledWith('user-pwd-1');
    });

    it('should reject password reset when token is invalid or expired', async () => {
      mockAuthRepository.findValidPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'invalid_or_expired_token',
          newPassword: 'ValidPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
