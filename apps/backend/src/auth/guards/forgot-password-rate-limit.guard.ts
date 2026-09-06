import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface AttemptRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class ForgotPasswordRateLimitGuard implements CanActivate {
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_REQUESTS = 5;
  private readonly attempts = new Map<string, AttemptRecord>();

  canActivate(context: ExecutionContext): boolean {
    // Allow bypassing in unit tests if specified
    if (process.env.NODE_ENV === 'test_disable_ratelimit') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip =
      request.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown-ip';

    const email = request.body?.email ? String(request.body.email).toLowerCase().trim() : '';
    const key = `${ip}:${email}`;
    const now = Date.now();

    // Clean up expired entries periodically
    if (this.attempts.size > 1000) {
      for (const [k, v] of this.attempts.entries()) {
        if (now > v.resetTime) {
          this.attempts.delete(k);
        }
      }
    }

    const record = this.attempts.get(key);

    if (!record || now > record.resetTime) {
      this.attempts.set(key, {
        count: 1,
        resetTime: now + this.WINDOW_MS,
      });
      return true;
    }

    if (record.count >= this.MAX_REQUESTS) {
      const remainingSeconds = Math.ceil((record.resetTime - now) / 1000);
      throw new HttpException(
        `Too many password reset requests. Please wait ${remainingSeconds} seconds before trying again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count += 1;
    return true;
  }
}
