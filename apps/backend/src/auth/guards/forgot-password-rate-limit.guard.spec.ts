import { ForgotPasswordRateLimitGuard } from './forgot-password-rate-limit.guard';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

describe('ForgotPasswordRateLimitGuard', () => {
  let guard: ForgotPasswordRateLimitGuard;

  beforeEach(() => {
    guard = new ForgotPasswordRateLimitGuard();
  });

  function createMockContext(ip: string, email: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          ip,
          body: { email },
        }),
      }),
    } as any;
  }

  it('should allow up to 5 password reset requests within the window', () => {
    const ctx = createMockContext('192.168.1.50', 'user@finpilot.ai');

    for (let i = 0; i < 5; i++) {
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('should throw HttpException 429 on the 6th request from the same IP/email', () => {
    const ctx = createMockContext('192.168.1.51', 'spammer@finpilot.ai');

    for (let i = 0; i < 5; i++) {
      guard.canActivate(ctx);
    }

    try {
      guard.canActivate(ctx);
      fail('Expected HttpException 429');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(err.message).toContain('Too many password reset requests');
    }
  });

  it('should isolate rate limits across different IP addresses or emails', () => {
    const ctxUserA = createMockContext('192.168.1.60', 'alice@finpilot.ai');
    const ctxUserB = createMockContext('192.168.1.61', 'bob@finpilot.ai');

    for (let i = 0; i < 5; i++) {
      guard.canActivate(ctxUserA);
    }

    // Alice is now rate-limited
    expect(() => guard.canActivate(ctxUserA)).toThrow(HttpException);

    // Bob can still make requests
    expect(guard.canActivate(ctxUserB)).toBe(true);
  });
});
