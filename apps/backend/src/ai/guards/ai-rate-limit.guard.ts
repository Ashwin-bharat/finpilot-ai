import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private userRequestMap = new Map<string, number[]>();
  private readonly WINDOW_MS = 60 * 1000; // 1 minute window
  private readonly MAX_REQUESTS_PER_WINDOW = 15; // Max 15 requests per user per minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.ip || 'anonymous';

    const now = Date.now();
    const userTimestamps = this.userRequestMap.get(userId) || [];

    // Filter out timestamps outside the current window
    const validTimestamps = userTimestamps.filter((ts) => now - ts < this.WINDOW_MS);

    if (validTimestamps.length >= this.MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded for AI Assistant queries. Please wait a moment before asking more questions.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    validTimestamps.push(now);
    this.userRequestMap.set(userId, validTimestamps);

    return true;
  }
}
